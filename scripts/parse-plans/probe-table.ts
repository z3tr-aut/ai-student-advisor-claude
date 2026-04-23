import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx probe-table.ts <pdf-path>");
    process.exit(1);
  }
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getTable();
  await parser.destroy();

  const pages = result.pages ?? [];
  console.log("=== NUM PAGES:", pages.length);
  const outFile = path.join(__dirname, "out", path.basename(file) + ".tables.json");
  fs.writeFileSync(outFile, JSON.stringify(pages, null, 2), "utf8");
  console.log("Wrote tables JSON to:", outFile);

  // Print first page's first table for inspection
  if (pages[0]?.tables?.[0]) {
    console.log("=== PAGE 1 TABLE 0 ===");
    for (const row of pages[0].tables[0]) {
      console.log(JSON.stringify(row));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
