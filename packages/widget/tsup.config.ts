import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", react: "src/react.tsx" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react"],
    target: "es2020",
  },
  {
    // <script src=".../widget.js"> build: renders the button where the tag sits.
    entry: { "widget.iife": "src/script.ts" },
    format: ["iife"],
    globalName: "PerkOSCoffee",
    minify: true,
    sourcemap: false,
    target: "es2019",
    outExtension: () => ({ js: ".js" }),
  },
]);
