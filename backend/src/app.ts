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
import { dynamicLoop } from "./shared/utility"

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
  // Set up MongoMemoryServer to store data in the local 'database' folder
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      dbPath: databasePath,
      dbName: "automatarr", // Name of the database
      storageEngine: "wiredTiger", // Use the persistent storage engine
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
    // Get the MongoDB URI
    const mongoUri = mongoServer.getUri()

    // Connect to MongoDB using the URI
    await mongoose.connect(mongoUri)

    // Start the server once MongoDB is connected
    const PORT = 8091
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`)
      logger.info(`MongoDB URI: ${mongoUri}`)
    })
  } catch (err) {
    logger.info(`Error starting MongoDB or server: ${err}`)
  }

  // If first run, initialise stats and settings
  await Resolvers.newStats()
  await Resolvers.newSettings()

  // Main loops
  dynamicLoop("import_blocked_loop", async (settings) => {
    if (settings.wanted_missing) {
      await Resolvers.search_wanted_missing(settings)
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
