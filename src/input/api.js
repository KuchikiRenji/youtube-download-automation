import express from "express";
import { getQueue, addVideoTask, addChannelTask, addBulkVideoTasks, getJobCounts } from "./queue.js";
import { getDownloadById, getMetrics, insertDownload } from "../storage/db.js";
import { getProxySuccessRates } from "../proxy/manager.js";
import { config } from "../config/index.js";
import { logger } from "../monitoring/logger.js";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const basePath = config.server.basePath;

// Normalize URL: support youtu.be, youtube.com/watch, youtube.com/shorts
function normalizeVideoUrl(input) {
  const u = input.trim();
  if (/^https?:\/\/(www\.)?youtube\.com\/(watch\?v=|shorts\/)/.test(u)) return u;
  if (/^https?:\/\/youtu\.be\//.test(u)) return u;
  return null;
}

function normalizeChannelUrl(input) {
  const u = input.trim();
  if (/^https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@)/.test(u)) return u;
  return null;
}

app.post(`${basePath}/tasks/video`, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }
    const normalized = normalizeVideoUrl(url);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid video URL" });
    }
    const taskId = uuidv4();
    const job = await addVideoTask(normalized, { jobId: taskId });
    await insertDownload({
      id: taskId,
      url: normalized,
      sourceType: "video",
      title: null,
      status: "pending",
      proxyUsed: null,
      retryCount: 0,
    }).catch(() => {});
    res.status(202).json({
      taskId: job.id,
      url: normalized,
      message: "Video task queued",
    });
  } catch (err) {
    logger.error({ err }, "Failed to queue video task");
    res.status(500).json({ error: "Failed to queue task" });
  }
});

app.post(`${basePath}/tasks/channel`, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }
    const normalized = normalizeChannelUrl(url);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid channel URL" });
    }
    const job = await addChannelTask(normalized, { jobId: uuidv4() });
    res.status(202).json({
      taskId: job.id,
      url: normalized,
      message: "Channel task queued",
    });
  } catch (err) {
    logger.error({ err }, "Failed to queue channel task");
    res.status(500).json({ error: "Failed to queue task" });
  }
});

app.post(`${basePath}/tasks/bulk`, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "urls must be a non-empty array" });
    }
    const normalized = urls.map((u) => normalizeVideoUrl(String(u))).filter(Boolean);
    if (normalized.length === 0) {
      return res.status(400).json({ error: "No valid video URLs" });
    }
    const jobs = await addBulkVideoTasks(normalized);
    res.status(202).json({
      count: jobs.length,
      taskIds: jobs.map((j) => j.id),
      message: "Bulk tasks queued",
    });
  } catch (err) {
    logger.error({ err }, "Failed to queue bulk tasks");
    res.status(500).json({ error: "Failed to queue tasks" });
  }
});

app.get(`${basePath}/tasks/queue`, async (req, res) => {
  try {
    const counts = await getJobCounts();
    res.json(counts);
  } catch (err) {
    logger.error({ err }, "Failed to get queue counts");
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

app.get(`${basePath}/tasks/:taskId`, async (req, res) => {
  try {
    const record = await getDownloadById(req.params.taskId);
    if (!record) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(record);
  } catch (err) {
    logger.error({ err }, "Failed to get task");
    res.status(500).json({ error: "Failed to get task" });
  }
});

app.get(`${basePath}/metrics`, async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (err) {
    logger.error({ err }, "Failed to get metrics");
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

app.get(`${basePath}/proxies/stats`, async (req, res) => {
  try {
    const stats = await getProxySuccessRates();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "Failed to get proxy stats");
    res.status(500).json({ error: "Failed to get proxy stats" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = config.server.port;

export function startApi() {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      logger.info({ port: PORT, basePath }, "API server listening");
      resolve();
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startApi().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default app;
