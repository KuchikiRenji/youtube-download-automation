import { config } from "../config/index.js";
import { getFailedDownloadsOlderThan } from "../storage/db.js";
import { getQueue, addVideoTask } from "../input/queue.js";
import { recordMetricsSnapshot } from "../monitoring/metrics.js";
import { logger } from "../monitoring/logger.js";

const intervalMs = config.scheduler.intervalMs;
const retryAfterMs = config.scheduler.autoRetryFailedAfterMs;

async function retryFailedDownloads() {
  const failed = await getFailedDownloadsOlderThan(retryAfterMs);
  const q = getQueue();
  for (const row of failed) {
    try {
      await addVideoTask(row.url, { jobId: row.id });
      logger.info({ url: row.url, id: row.id }, "Re-queued failed download for retry");
    } catch (err) {
      logger.warn({ err, url: row.url }, "Failed to re-queue failed download");
    }
  }
}

async function recordSnapshot() {
  await recordMetricsSnapshot();
}

async function tick() {
  await retryFailedDownloads();
  await recordSnapshot();
}

function run() {
  logger.info({ intervalMs, retryAfterMs }, "Scheduler started");
  setInterval(tick, intervalMs);
  tick();
}

run();
