import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extractedDir = path.join(__dirname, "../prisma/seed-data/catalog/extracted");

async function extract(name) {
  const pdfPath = path.join(extractedDir, `${name}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    console.warn(`Missing ${pdfPath}`);
    return;
  }
  const data = await pdf(fs.readFileSync(pdfPath));
  const out = path.join(extractedDir, `${name}.txt`);
  fs.writeFileSync(out, data.text);
  console.log(`${name}: ${data.text.length} chars -> ${out}`);
}

for (const f of ["chart_3500", "chart_5000", "R-VAN-TechSpec"]) {
  await extract(f);
}
