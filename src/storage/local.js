import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";
import { logger } from "../monitoring/logger.js";

const baseDir = config.download.dir;

export async function ensureDownloadDir() {
  await fs.mkdir(baseDir, { recursive: true });
}

export function getDownloadDir() {
  return path.resolve(baseDir);
}

export function getFilePathForVideo(videoIdOrTitle, ext = "mp4") {
  const safe = String(videoIdOrTitle).replace(/[<>:"/\\|?*]/g, "_").slice(0, 200);
  return path.join(baseDir, `${safe}.${ext}`);
}

export async function saveFile(fromPath, toRelativePath) {
  const dest = path.join(baseDir, toRelativePath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(fromPath, dest);
  return dest;
}

export async function getFileSize(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return null;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default {
  ensureDownloadDir,
  getDownloadDir,
  getFilePathForVideo,
  saveFile,
  getFileSize,
  fileExists,
};
