import "dotenv/config";

const env = (key, defaultValue) => process.env[key] ?? defaultValue;

export const config = {
  redis: {
    url: env("REDIS_URL", "redis://localhost:6379"),
  },
  database: {
    url: env(
      "DATABASE_URL",
      "postgresql://postgres:postgres@localhost:5432/yt_downloads"
    ),
  },
  server: {
    port: parseInt(env("PORT", "3000"), 10),
    basePath: env("API_BASE_PATH", "/api/v1"),
  },
  download: {
    dir: env("DOWNLOAD_DIR", "./downloads"),
    maxConcurrentWorkers: parseInt(env("MAX_CONCURRENT_WORKERS", "4"), 10),
    maxRetriesPerTask: parseInt(env("MAX_RETRIES_PER_TASK", "3"), 10),
    taskTimeoutMs: parseInt(env("TASK_TIMEOUT_MS", "600000"), 10),
  },
  proxy: {
    list: env("PROXY_LIST", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rotateOnFailure: env("PROXY_ROTATE_ON_FAILURE", "true") === "true",
  },
  scheduler: {
    intervalMs: parseInt(env("SCHEDULER_INTERVAL_MS", "5000"), 10),
    autoRetryFailedAfterMs: parseInt(
      env("AUTO_RETRY_FAILED_AFTER_MS", "300000"),
      10
    ),
  },
  log: {
    level: env("LOG_LEVEL", "info"),
  },
};

export default config;
