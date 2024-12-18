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
import { allAPIsDeactivated, allLoopsDeactivated, coreLoops } from "./shared/utility"
import { settingsDocType } from "./models/settings"
import { isOnCorrectLAN } from "./shared/network"

// Initialise express.
const app = express()

// Maximum request body size.
app.use(express.json({ limit: "1mb" }))

// Handle CORS Errors.
app.use(corsHandler)

// Set up GraphQL
app.use(
  "/graphql",
  graphqlHTTP({
    schema: Schema,
    rootValue: Resolvers,
    graphiql: true,
  }),
)

// Check if code is running in a Docker container or not
export const isDocker = fs.existsSync("/.dockerenv")

// Create or use existing directory for database files
const databasePath = path.join(__dirname, "..", "..", "automatarr_database")

// Ensure the directory exists
if (!fs.existsSync(databasePath)) {
  fs.mkdirSync(databasePath)
  logger.info(`Database not found. Creating directory at: ${databasePath}`)
} else {
  logger.info(`Database found at: ${databasePath}`)
}

const startServer = async () => {
  const db_IP = process.env.VITE_DATABASE_IP || "127.0.0.1"
  const db_PORT = process.env.VITE_DATABASE_PORT || "27020"
  const backend_IP = "0.0.0.0"
  const backend_PORT = process.env.VITE_BACKEND_PORT || "8091"

  // Set up MongoMemoryServer to store data in the local 'database' folder
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      dbPath: databasePath,
      dbName: "automatarr",
      storageEngine: "wiredTiger", // Use the persistent storage engine
      ip: db_IP,
      port: Number(db_PORT),
    },
  })

  // Gracefully shut down MongoMemoryServer
  const shutdown = async () => {
    logger.info("Shutting down MongoMemoryServer...")
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
    logger.info("Restarting server (triggered by Nodemon)...")
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
      logger.info(`Server started at ${backend_IP}:${backend_PORT}`)
      logger.info(`MongoDB started at ${mongoUri}`)
    })
  } catch (err) {
    logger.info(`Error starting MongoDB or server: ${err}`)
  }

  // Initialise settings in db if first boot
  const bootSettings = (await Resolvers.newSettings()) as settingsDocType // Settings for Automatarr

  // Ping API's with populated credentials to check if backend is running on correct LAN
  isOnCorrectLAN(bootSettings)

  // Initialise data in db if first boot
  await Resolvers.newData()

  // Check connection to every API
  await Resolvers.checkRadarr() // No data passed = Will fetch settings data from db
  await Resolvers.checkSonarr() // No data passed = Will fetch settings data from db
  await Resolvers.checkLidarr() // No data passed = Will fetch settings data from db
  await Resolvers.checkqBittorrent() // No data passed = Will fetch settings data from db

  // Check that at least one API is active
  if (!allAPIsDeactivated(bootSettings._doc)) {
    // Collect the latest data from all active APIs
    const data = await Resolvers.getData()

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
