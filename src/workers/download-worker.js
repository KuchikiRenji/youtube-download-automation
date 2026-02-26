import { Worker } from "bullmq";
import { getQueue, connection, QUEUE_NAME } from "../input/queue.js";
import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";
import { insertDownload, updateDownload, getDownloadByUrl } from "../storage/db.js";
import { extractMetadata } from "../metadata/scraper.js";
import { downloadWithMetrics } from "../download/engine.js";
import * as local from "../storage/local.js";
import * as proxyManager from "../proxy/manager.js";
import * as proxyMiddleware from "../proxy/middleware.js";
import { logger } from "../monitoring/logger.js";

const concurrency = config.download.maxConcurrentWorkers;

async function processVideoJob(job) {
  const { url, sourceType = "video", jobId } = job.data;
  const id = jobId || job.id;
  let proxyUsed = proxyMiddleware.assignStickyProxy(id);
  let attemptNumber = job.attemptsMade || 0;
  const failedWithCurrentProxy = attemptNumber > 0;

  if (config.proxy.rotateOnFailure && failedWithCurrentProxy) {
    proxyUsed = proxyManager.getProxyForJob(id, proxyUsed, true);
  }

  const existing = await getDownloadByUrl(url);
  let downloadId = existing?.id;
  if (!downloadId) {
    const meta = await extractMetadata(url, proxyUsed).catch((e) => {
      logger.warn({ err: e, url }, "Metadata extraction failed, using placeholder");
      return { title: url };
    });
    const insert = await insertDownload({
      id: downloadId || id,
      url,
      sourceType,
      title: meta?.title || url,
      status: "downloading",
      proxyUsed: proxyUsed || null,
      downloadStartedAt: new Date(),
      retryCount: attemptNumber,
    });
    downloadId = insert?.id || id;
  } else {
    await updateDownload(downloadId, {
      status: "downloading",
      proxy_used: proxyUsed,
      download_started_at: new Date(),
      retry_count: attemptNumber,
    });
  }

  const jobDir = path.join(local.getDownloadDir(), id);
  await fs.mkdir(jobDir, { recursive: true });
  const outputTemplate = path.join(jobDir, "%(title).200s [%(id)s].%(ext)s");

  try {
    const result = await downloadWithMetrics(url, {
      proxyUrl: proxyUsed,
      outputTemplate,
      outputDir: jobDir,
      onProgress: (pct) => job.updateProgress(pct),
    });

    if (proxyUsed) await proxyManager.recordProxySuccess(proxyUsed);

    await updateDownload(downloadId, {
      status: "completed",
      download_completed_at: new Date(),
      file_path: result.filePath,
      file_size_bytes: result.fileSizeBytes,
      download_speed_bytes_per_sec: result.downloadSpeedBytesPerSec,
      error_message: null,
    });

    logger.info(
      {
        url,
        downloadId,
        filePath: result.filePath,
        speed: result.downloadSpeedBytesPerSec,
      },
      "Download completed"
    );
    return { success: true, downloadId, filePath: result.filePath };
  } catch (err) {
    if (proxyUsed) await proxyManager.recordProxyFailure(proxyUsed);
    await updateDownload(downloadId, {
      status: "failed",
      error_message: err.message,
      retry_count: attemptNumber + 1,
    });
    logger.error({ err, url, downloadId }, "Download failed");
    throw err;
  }
}

async function processChannelJob(job) {
  const { url } = job.data;
  const YTDlpWrap = (await import("yt-dlp-wrap")).default;
  const path = await YTDlpWrap.downloadFromGithub().catch(() => "yt-dlp");
  const ytDlp = new YTDlpWrap(path);
  const args = ["--flat-playlist", "--print", "url", url];
  return new Promise((resolve, reject) => {
    let out = "";
    const proc = ytDlp.exec(args, {}, (err) => {
      if (err) {
        reject(err);
        return;
      }
      const urls = out
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http"));
      resolve({ videoUrls: urls });
    });
    proc.stdout?.on("data", (d) => (out += d.toString()));
  }).then(async (result) => {
    const { addBulkVideoTasks } = await import("../input/queue.js");
    if (result.videoUrls?.length) {
      await addBulkVideoTasks(result.videoUrls);
      logger.info({ url, count: result.videoUrls.length }, "Channel videos queued");
    }
    return result;
  });
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "channel") {
      return processChannelJob(job);
    }
    return processVideoJob(job);
  },
  {
    connection,
    concurrency,
    limiter: {
      max: concurrency,
      duration: 1000,
    },
  }
);

worker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
  logger.warn({ jobId: job?.id, err: err?.message }, "Job failed");
});

worker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

logger.info({ concurrency, queue: QUEUE_NAME }, "Download worker started");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
