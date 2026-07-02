import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";

const header = readFileSync("userscript-header.txt", "utf8").trimEnd();

const res = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2019",
  legalComments: "none",
  minify: false,
  write: false,
  logLevel: "info",
});

const code = res.outputFiles[0].text;
mkdirSync("dist", { recursive: true });
mkdirSync("dist-ext", { recursive: true });
writeFileSync("dist/agar-overlay.user.js", `${header}\n${code}`);
writeFileSync("dist-ext/content.js", code);
copyFileSync("ext/manifest.json", "dist-ext/manifest.json");
console.log("[agar-ext] emitted dist/agar-overlay.user.js + dist-ext/");
