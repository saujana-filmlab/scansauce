import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dist = path.join(here, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "assets"), { recursive: true });

for (const name of ["index.html", "admin.css", "admin.js", "house.js"]) {
  await copyFile(path.join(root, "admin", name), path.join(dist, name));
}
for (const name of ["scansauce-thumbnail.png", "saujana-logo.png", "the-sau-house-logo.png", "scansauce-logo.png"]) {
  await copyFile(path.join(root, "assets", name), path.join(dist, "assets", name));
}
