const config = {
  apps: [
    {
      name: "automatarr-backend",
      script: "./dist/app.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 2000,
      time: false,
      env: {
        NODE_ENV: "production",
        DB_PORT: process.env.DB_PORT || "27020", // Pass it explicitly
      },
    },
  ],
}

module.exports = config
