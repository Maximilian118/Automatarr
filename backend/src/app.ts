import express from "express"
import { graphqlHTTP } from "express-graphql"
import mongoose from "mongoose"
import { MongoMemoryServer } from "mongodb-memory-server"
import Schema from "./graphql/schemas/schemas"
import Resolvers from "./graphql/resolvers/resolvers"
import corsHandler from "./middleware/corsHandler"
import path from "path"
import fs from "fs"
import logger from "./logger"
import { bootPermissions } from "./shared/permissions"
import { allAPIsDeactivated, allLoopsDeactivated } from "./shared/utility"
import { settingsDocType } from "./models/settings"
import { isOnCorrectLAN } from "./shared/network"
import { dataDocType } from "./models/data"
import { botsControl } from "./bots/botsControl"
import { auth } from "./middleware/auth"
import { coreLoops } from "./loops/loops"

// Initialise express.
const app = express()

// Maximum request body size.
app.use(express.json({ limit: "1mb" }))

// Handle CORS Errors.
app.use(corsHandler)

// Make token authentication middleware available in all reducers by passing req.
app.use(auth as any)

// Set up GraphQL
app.use(
  "/graphql",
  graphqlHTTP({
    schema: Schema,
    rootValue: Resolvers,
    graphiql: true,
  }),
)

// Create or use existing directory for database files
const databasePath = path.join(__dirname, "..", "..", "automatarr_database")

// Ensure the directory exists
if (!fs.existsSync(databasePath)) {
  fs.mkdirSync(databasePath)
  logger.success(`Database not found. Creating directory at: ${databasePath}`)
} else {
  logger.success(`Database found at: ${databasePath}`)
}

const startServer = async () => {
  const db_IP = "0.0.0.0"
  const db_PORT = "27020"
  const backend_IP = "0.0.0.0"
  const backend_PORT = "8091"

  // Set up MongoMemoryServer to store data in the local 'database' folder
  let mongoServer

  try {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbPath: databasePath,
        dbName: "automatarr",
        storageEngine: "wiredTiger", // Persistent storage engine
        ip: db_IP,
        port: Number(db_PORT),
      },
    })
  } catch (err) {
    logger.error(`MongoMemoryServer failed to start: ${err}`)
    process.exit(1)
  }

  // Gracefully shut down MongoMemoryServer
  const shutdown = async () => {
    logger.catastrophic("Shutting down MongoMemoryServer...")
    if (mongoServer) {
      await mongoServer.stop()
    }
    process.exit(0)
  }

  // Listen for termination signals
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  process.on("SIGUSR2", async () => {
    // Nodemon uses SIGUSR2 signal to restart
    logger.warn("Restarting server (triggered by Nodemon)...")
    await shutdown() // Gracefully shutdown MongoMemoryServer
    process.kill(process.pid, "SIGUSR2") // Restart Nodemon
  })

  try {
    // Create the MongoDB URI
    const mongoUri = `mongodb://${db_IP}:${db_PORT}/automatarr`

    // Connect to MongoDB using the URI
    await mongoose.connect(mongoUri)

    // Start the server once MongoDB is connected
    app.listen(Number(backend_PORT), backend_IP, () => {
      logger.success(`Server started at ${backend_IP}:${backend_PORT}`)
      logger.success(`MongoDB started at ${mongoUri}`)
    })
  } catch (err) {
    logger.error(`Error starting MongoDB or server: ${err}`)
  }

  // Initialise settings in db if first boot. If settings exists, return settings.
  const bootSettings = (await Resolvers.newSettings()) as settingsDocType // Settings for Automatarr

  // Ping API's with populated credentials to check if backend is running on correct LAN
  isOnCorrectLAN(bootSettings)

  // Initialise data in db if first boot
  await Resolvers.newData()

  // Check that at least one API is active
  if (!allAPIsDeactivated(bootSettings._doc)) {
    // Check connection to Starr Apps
    await Resolvers.checkRadarr({ URL: bootSettings.radarr_URL, KEY: bootSettings.radarr_KEY })
    await Resolvers.checkSonarr({ URL: bootSettings.sonarr_URL, KEY: bootSettings.sonarr_KEY })
    await Resolvers.checkLidarr({ URL: bootSettings.lidarr_URL, KEY: bootSettings.lidarr_KEY })

    // Start Bots
    await botsControl(bootSettings)

    // Collect the latest data from all active APIs
    const data = (await Resolvers.getData()) as dataDocType

    // Check connection to Starr API
    await Resolvers.checkqBittorrent({
      URL: bootSettings.qBittorrent_URL,
      USER: bootSettings.qBittorrent_username,
      PASS: bootSettings.qBittorrent_password,
    })

    // Check Automatarr has the filesystem permissions it needs
    bootPermissions(data)

    // Log if all Loops are deactivated
    allLoopsDeactivated(bootSettings._doc)

    // Start main loops
    coreLoops()
  }
}

// Start the application
startServer()
