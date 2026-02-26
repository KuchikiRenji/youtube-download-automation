import { getProxyForJob, getStickyProxyForTask, recordProxySuccess, recordProxyFailure } from "./manager.js";

export function buildProxyEnv(proxyUrl) {
  if (!proxyUrl) return {};
  return {
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
  };
}

export function proxyArgsForYtDlp(proxyUrl) {
  if (!proxyUrl) return [];
  return ["--proxy", proxyUrl];
}

export function proxyForPlaywright(proxyUrl) {
  if (!proxyUrl) return undefined;
  try {
    const u = new URL(proxyUrl);
    return {
      server: u.origin,
      username: u.username || undefined,
      password: u.password || undefined,
    };
  } catch {
    return { server: proxyUrl };
  }
}

export async function withProxyTracking(jobId, currentProxy, failedBefore, fn) {
  const proxy = getProxyForJob(jobId, currentProxy, failedBefore);
  const result = await fn(proxy);
  if (result.success && proxy) {
    await recordProxySuccess(proxy);
  } else if (!result.success && proxy) {
    await recordProxyFailure(proxy);
  }
  return { ...result, proxy };
}

export function assignStickyProxy(jobId) {
  return getStickyProxyForTask(jobId);
}

export default {
  buildProxyEnv,
  proxyArgsForYtDlp,
  proxyForPlaywright,
  withProxyTracking,
  assignStickyProxy,
};
