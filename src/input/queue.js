import { Queue, Worker } from "bullmq";
import { config } from "../config/index.js";

const connection = {
  url: config.redis.url,
};

const QUEUE_NAME = "yt-download";

export function createQueue() {
  return new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: config.download.maxRetriesPerTask,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
      timeout: config.download.taskTimeoutMs,
    },
  });
}

let queueInstance = null;

export function getQueue() {
  if (!queueInstance) {
    queueInstance = createQueue();
  }
  return queueInstance;
}

export async function addVideoTask(url, options = {}) {
  const q = getQueue();
  const job = await q.add(
    "download",
    { url, sourceType: "video", ...options },
    { jobId: options.jobId }
  );
  return job;
}

export async function addChannelTask(channelUrl, options = {}) {
  const q = getQueue();
  const job = await q.add(
    "channel",
    { url: channelUrl, sourceType: "channel", ...options },
    { jobId: options.jobId }
  );
  return job;
}

export async function addBulkVideoTasks(urls) {
  const q = getQueue();
  const jobs = await q.addBulk(
    urls.map((url) => ({
      name: "download",
      data: { url, sourceType: "video" },
    }))
  );
  return jobs;
}

export async function getJob(jobId) {
  const q = getQueue();
  return q.getJob(jobId);
}

export async function getJobCounts() {
  const q = getQueue();
  return q.getJobCounts();
}

export { QUEUE_NAME, connection };
