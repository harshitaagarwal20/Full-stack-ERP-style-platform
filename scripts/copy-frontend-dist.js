import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const frontendDistDir = path.join(rootDir, "frontend-hostinger", "dist");
const backendPublicDir = path.join(rootDir, "backend", "public");

async function copyFrontendDist() {
  await fs.rm(backendPublicDir, { recursive: true, force: true });
  await fs.mkdir(backendPublicDir, { recursive: true });
  await fs.cp(frontendDistDir, backendPublicDir, { recursive: true });
  console.log(`Copied ${frontendDistDir} to ${backendPublicDir}`);
}

copyFrontendDist().catch((error) => {
  console.error(error);
  process.exit(1);
});
