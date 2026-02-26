import { query } from "../storage/db.js";
import { logger } from "./logger.js";

const metrics = {
  downloadsStarted: 0,
  downloadsCompleted: 0,
  downloadsFailed: 0,
  totalBytesDownloaded: 0,
  downloadDurationsMs: [],
};

export function recordDownloadStarted() {
  metrics.downloadsStarted++;
}

export function recordDownloadCompleted(bytesDownloaded, durationMs) {
  metrics.downloadsCompleted++;
  metrics.totalBytesDownloaded += bytesDownloaded;
  metrics.downloadDurationsMs.push(durationMs);
  if (metrics.downloadDurationsMs.length > 1000) {
    metrics.downloadDurationsMs = metrics.downloadDurationsMs.slice(-500);
  }
}

export function recordDownloadFailed() {
  metrics.downloadsFailed++;
}

export function getSuccessRate() {
  const total = metrics.downloadsCompleted + metrics.downloadsFailed;
  if (total === 0) return 1;
  return metrics.downloadsCompleted / total;
}

export function getFailureCount() {
  return metrics.downloadsFailed;
}

export function getAverageDownloadSpeedBytesPerSec() {
  if (metrics.downloadDurationsMs.length === 0) return 0;
  const totalMs = metrics.downloadDurationsMs.reduce((a, b) => a + b, 0);
  const totalSec = totalMs / 1000;
  if (totalSec === 0) return 0;
  return metrics.totalBytesDownloaded / totalSec;
}

export function getInMemoryMetrics() {
  return {
    downloadsStarted: metrics.downloadsStarted,
    downloadsCompleted: metrics.downloadsCompleted,
    downloadsFailed: metrics.downloadsFailed,
    successRate: getSuccessRate(),
    totalBytesDownloaded: metrics.totalBytesDownloaded,
    avgDownloadSpeedBytesPerSec: getAverageDownloadSpeedBytesPerSec(),
  };
}

export async function recordMetricsSnapshot() {
  try {
    const m = await query(
      `INSERT INTO metrics_snapshots (
        total_completed, total_failed, avg_download_speed_bytes_per_sec, pending_count
      ) SELECT
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        AVG(download_speed_bytes_per_sec) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status IN ('pending', 'downloading'))
      FROM downloads
      RETURNING id`
    );
    return m.rows[0];
  } catch (err) {
    logger.warn({ err }, "Failed to record metrics snapshot");
    return null;
  }
}

export default {
  recordDownloadStarted,
  recordDownloadCompleted,
  recordDownloadFailed,
  getSuccessRate,
  getFailureCount,
  getAverageDownloadSpeedBytesPerSec,
  getInMemoryMetrics,
  recordMetricsSnapshot,
};
