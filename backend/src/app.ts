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
import { dynamicLoop } from "./shared/dynamicLoop"
import { bootPermissions } from "./shared/permissions"

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

  // If first run, initialise settings and data
  await Resolvers.newSettings() // Settings for Automatarr
  await Resolvers.newData() // Data retrieved from every API

  // Check connection to every API
  await Resolvers.checkRadarr() // No data passed = Will fetch settings data from db
  await Resolvers.checkSonarr() // No data passed = Will fetch settings data from db
  await Resolvers.checkLidarr() // No data passed = Will fetch settings data from db

  // Collect the latest data from all active APIs
  const data = await Resolvers.getData()

  // Check Automatarr has the filesystem permissions it needs
  bootPermissions(data)

  // Main loops
  // Check for monitored content in libraries that has not been downloaded and is wanted missing
  dynamicLoop("wanted_missing_loop", async (settings) => {
    if (settings.wanted_missing) {
      await Resolvers.search_wanted_missing(settings)
    }
  })
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  dynamicLoop("import_blocked_loop", async (settings) => {
    if (settings.import_blocked) {
      await Resolvers.import_blocked_handler(settings)
    }
  })
}

// Error handling for uncaught exceptions and unhandled rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason)
  setTimeout(() => {
    process.exit(1) // Exit to allow nodemon to restart
  }, 5000) // Restart after 5 seconds
})

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error)
  setTimeout(() => {
    process.exit(1) // Exit to allow nodemon to restart
  }, 5000) // Restart after 5 seconds
})

// Start the application
startServer()
