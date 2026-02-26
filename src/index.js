import { startApi } from "./input/api.js";
import { logger } from "./monitoring/logger.js";

async function main() {
  await startApi();
  logger.info("YouTube download automation API is running. Start workers with: npm run worker");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
