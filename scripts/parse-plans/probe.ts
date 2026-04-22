import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx probe.ts <pdf-path>");
    process.exit(1);
  }
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();

  const full = result.text ?? "";
  const pages = result.pages ?? [];
  console.log("=== NUM PAGES:", pages.length);
  console.log("=== TOTAL TEXT LENGTH:", full.length);
  console.log("=== FIRST 4000 CHARS ===");
  console.log(full.slice(0, 4000));

  const outFile = path.join(__dirname, "out", path.basename(file) + ".txt");
  fs.writeFileSync(outFile, full, "utf8");
  console.log("\n=== Wrote full text to:", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
