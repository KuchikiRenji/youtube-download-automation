import { config } from "../config/index.js";
import { query } from "../storage/db.js";
import { logger } from "../monitoring/logger.js";

const proxyList = [...(config.proxy.list || [])];
let index = 0;

function proxyKey(proxyUrl) {
  try {
    const u = new URL(proxyUrl);
    return u.origin;
  } catch {
    return proxyUrl;
  }
}

export function getProxyList() {
  return proxyList;
}

export function hasProxies() {
  return proxyList.length > 0;
}

export function getNextProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[index % proxyList.length];
  index++;
  return proxy;
}

export function getStickyProxyForTask(taskId) {
  if (proxyList.length === 0) return null;
  const hash = taskId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return proxyList[Math.abs(hash) % proxyList.length];
}

export function getBestProxy() {
  if (proxyList.length === 0) return null;
  return getNextProxy();
}

export async function recordProxySuccess(proxyUrl) {
  const key = proxyKey(proxyUrl);
  try {
    await query(
      `INSERT INTO proxy_stats (proxy_key, success_count, last_used_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (proxy_key) DO UPDATE SET
         success_count = proxy_stats.success_count + 1,
         last_used_at = NOW()`,
      [key]
    );
  } catch (err) {
    logger.warn({ err, key }, "Failed to record proxy success");
  }
}

export async function recordProxyFailure(proxyUrl) {
  const key = proxyKey(proxyUrl);
  try {
    await query(
      `INSERT INTO proxy_stats (proxy_key, failure_count, last_used_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (proxy_key) DO UPDATE SET
         failure_count = proxy_stats.failure_count + 1,
         last_used_at = NOW()`,
      [key]
    );
  } catch (err) {
    logger.warn({ err, key }, "Failed to record proxy failure");
  }
}

export async function getProxySuccessRates() {
  try {
    const res = await query(
      `SELECT proxy_key, success_count, failure_count,
              CASE WHEN (success_count + failure_count) > 0
                   THEN success_count::float / (success_count + failure_count)
                   ELSE 0 END AS success_rate
       FROM proxy_stats ORDER BY success_rate DESC NULLS LAST`
    );
    return res.rows;
  } catch (err) {
    logger.warn({ err }, "Failed to get proxy success rates");
    return [];
  }
}

export function getProxyForJob(jobId, currentProxy, failedWithThisProxy) {
  if (proxyList.length === 0) return null;
  if (!config.proxy.rotateOnFailure || !failedWithThisProxy) {
    return currentProxy || getStickyProxyForTask(jobId);
  }
  return getNextProxy();
}

export default {
  getProxyList,
  hasProxies,
  getNextProxy,
  getStickyProxyForTask,
  getBestProxy,
  recordProxySuccess,
  recordProxyFailure,
  getProxySuccessRates,
  getProxyForJob,
};
