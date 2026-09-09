// Copies the built widget (IIFE) into public/ so it is served at /widget.js.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/widget/dist/widget.iife.js");
const dest = resolve(here, "../public/widget.js");
if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("widget.js copied");
} else {
  console.warn("widget not built yet (packages/widget/dist/widget.iife.js missing); run `npm run build -w packages/widget`");
}
