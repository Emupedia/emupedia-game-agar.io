import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

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
mkdirSync("../../docs/agarv2mod/assets/js", { recursive: true });
writeFileSync("../../docs/agarv2mod/assets/js/main.js", code);
console.log("[agarv2mod] emitted docs/agarv2mod/assets/js/main.js");
