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
    },
  ],
}

module.exports = config
