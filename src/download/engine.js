import YTDlpWrap from "yt-dlp-wrap";
import path from "path";
import fs from "fs/promises";
import { proxyArgsForYtDlp, buildProxyEnv } from "../proxy/middleware.js";
import * as local from "../storage/local.js";
import { logger } from "../monitoring/logger.js";
import {
  recordDownloadStarted,
  recordDownloadCompleted,
  recordDownloadFailed,
} from "../monitoring/metrics.js";

let ytDlpPath = null;

async function getYtDlpPath() {
  if (ytDlpPath) return ytDlpPath;
  try {
    const YTDlpWrap = (await import("yt-dlp-wrap")).default;
    ytDlpPath = await YTDlpWrap.downloadFromGithub();
    return ytDlpPath;
  } catch {
    ytDlpPath = "yt-dlp";
    return ytDlpPath;
  }
}

export async function downloadVideo(url, options = {}) {
  const { proxyUrl, outputTemplate, onProgress } = options;
  await local.ensureDownloadDir();
  const outDir = local.getDownloadDir();
  const template = outputTemplate || path.join(outDir, "%(title).200s [%(id)s].%(ext)s");

  const startTime = Date.now();
  recordDownloadStarted();

  const bin = await getYtDlpPath();
  const ytDlp = new YTDlpWrap(bin);
  const args = [
    "-f",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    template,
    "--no-warnings",
    "-q",
    "--progress",
    url,
    ...proxyArgsForYtDlp(proxyUrl),
  ];

  const env = { ...process.env, ...buildProxyEnv(proxyUrl) };

  return new Promise((resolve, reject) => {
    let lastProgress = 0;
    const proc = ytDlp.exec(args, { env }, (err) => {
      const durationMs = Date.now() - startTime;
      if (err) {
        recordDownloadFailed();
        reject(err);
        return;
      }
      resolve({ durationMs, lastProgress });
    });

    proc.stderr?.on("data", (chunk) => {
      const str = chunk.toString();
      const match = str.match(/(\d+\.?\d*)%/);
      if (match) {
        const pct = parseFloat(match[1]);
        if (pct > lastProgress) {
          lastProgress = pct;
          onProgress?.(pct);
        }
      }
    });
  });
}

export async function downloadWithMetrics(url, options = {}) {
  const start = Date.now();
  try {
    const result = await downloadVideo(url, options);
    const durationMs = result.durationMs ?? Date.now() - start;
    const outPath = options.outputDir
      ? await findLatestDownloadInDir(options.outputDir)
      : await findLatestDownload(options.outputTemplate, url);
    const fileSize = outPath ? await local.getFileSize(outPath) : 0;
    const speedBps = durationMs > 0 && fileSize ? (fileSize / (durationMs / 1000)) : 0;
    recordDownloadCompleted(fileSize, durationMs);
    return {
      success: true,
      filePath: outPath,
      fileSizeBytes: fileSize,
      durationMs,
      downloadSpeedBytesPerSec: speedBps,
    };
  } catch (err) {
    recordDownloadFailed();
    throw err;
  }
}

async function findLatestDownloadInDir(dir) {
  const files = await fs.readdir(dir).catch(() => []);
  const mp4 = files.filter((f) => f.endsWith(".mp4"));
  if (mp4.length === 0) return null;
  const stat = await Promise.all(mp4.map((f) => fs.stat(path.join(dir, f)).then((s) => ({ f, mtime: s.mtimeMs }))));
  stat.sort((a, b) => b.mtime - a.mtime);
  return path.join(dir, stat[0].f);
}

async function findLatestDownload(outputTemplate, url) {
  const dir = local.getDownloadDir();
  return findLatestDownloadInDir(dir);
}
