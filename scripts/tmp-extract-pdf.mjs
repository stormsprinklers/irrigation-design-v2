import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const dir = "prisma/seed-data/catalog/extracted";
const files = ["chart_3500.pdf", "chart_5000.pdf", "R-VAN-TechSpec.pdf"];

for (const f of files) {
  const data = fs.readFileSync(path.join(dir, f));
  const parser = new PDFParse({ data });
  const text = await parser.getText();
  const tables = await parser.getTable();
  await parser.destroy();
  fs.writeFileSync(path.join(dir, f.replace(".pdf", ".txt")), text.text ?? JSON.stringify(text, null, 2));
  fs.writeFileSync(path.join(dir, f.replace(".pdf", ".tables.json")), JSON.stringify(tables, null, 2));
  console.log(f, "text len", (text.text ?? "").length, "tables", tables?.pages?.length ?? tables);
}
