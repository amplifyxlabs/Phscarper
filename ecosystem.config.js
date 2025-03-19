module.exports = {
  apps: [
    {
      name: "ph-scraper",
      script: "./cron-scraper.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      watch: false,
      cron_restart: "30 11 * * *", // Run every day at 5:00 PM IST (11:30 AM UTC)
      env: {
        NODE_ENV: "production",
        HEADLESS: "true",
        MAX_PRODUCTS: "300",
        DELAY_BETWEEN_REQUESTS: "2000",
        DEBUG_MODE: "true",
        MAX_MAKERS_PER_PRODUCT: "5",
        SKIP_COMMENTS: "true"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};