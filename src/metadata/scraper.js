import YTDlpWrap from "yt-dlp-wrap";
import { proxyArgsForYtDlp, proxyForPlaywright } from "../proxy/middleware.js";
import { logger } from "../monitoring/logger.js";

let ytDlpPath = null;

async function getYtDlpPath() {
  if (ytDlpPath) return ytDlpPath;
  try {
    ytDlpPath = await YTDlpWrap.downloadFromGithub();
    return ytDlpPath;
  } catch (err) {
    logger.warn({ err }, "yt-dlp download failed, using system yt-dlp if available");
    ytDlpPath = "yt-dlp";
    return ytDlpPath;
  }
}

export async function extractMetadataWithYtDlp(url, proxyUrl = null) {
  const path = await getYtDlpPath();
  const ytDlp = new YTDlpWrap(path);
  const args = [
    "--dump-json",
    "--no-download",
    "--no-warnings",
    "-q",
    url,
    ...proxyArgsForYtDlp(proxyUrl),
  ];
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const proc = ytDlp.exec(args, {}, (err) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({
          title: data.title || null,
          duration: data.duration ?? null,
          uploader: data.uploader || data.channel || null,
          thumbnail: data.thumbnail || null,
          extractor: data.extractor,
        });
      } catch (e) {
        reject(new Error("Failed to parse yt-dlp JSON"));
      }
    });
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
  });
}

export async function extractMetadataWithPlaywright(url, proxyUrl = null) {
  const { chromium } = await import("playwright");
  const proxy = proxyForPlaywright(proxyUrl);
  const browser = await chromium.launch({ headless: true, proxy });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const title = await page
      .evaluate(() => document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.title)
      .catch(() => null);
    await browser.close();
    return {
      title: title || "Unknown",
      duration: null,
      uploader: null,
      thumbnail: null,
      extractor: "playwright",
    };
  } finally {
    await browser.close();
  }
}

export async function extractMetadata(url, proxyUrl = null) {
  try {
    return await extractMetadataWithYtDlp(url, proxyUrl);
  } catch (ytDlpErr) {
    logger.warn({ err: ytDlpErr, url }, "yt-dlp metadata extraction failed, trying Playwright");
    try {
      return await extractMetadataWithPlaywright(url, proxyUrl);
    } catch (playwrightErr) {
      logger.error({ err: playwrightErr, url }, "Playwright metadata fallback failed");
      throw new Error(`Metadata extraction failed: ${ytDlpErr.message}`);
    }
  }
}

export default { extractMetadata, extractMetadataWithYtDlp, extractMetadataWithPlaywright };
