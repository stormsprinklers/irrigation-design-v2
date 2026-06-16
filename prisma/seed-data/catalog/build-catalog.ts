import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HEAD_ITEMS } from "./heads";
import { MANUFACTURER_NOZZLES } from "./nozzles-manufacturer";
import type { CatalogSeedItem, NozzleChart } from "./chart";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.join(__dirname, "generated");
const extractedDir = path.join(__dirname, "extracted");

const EXTRACTED_PDF_FILES = [
  "rainbird-3500.json",
  "rainbird-5000.json",
  "rainbird-rvan.json",
  "hunter-mp-rotator.json",
] as const;

const PDF_EXTRACTED_FAMILIES = new Set([
  "rainbird_3500",
  "rainbird_5000_std",
  "rainbird_5000_la",
  "rainbird_rvan",
  "hunter_mp_rotator",
]);

type ExtractedNozzleRaw = {
  id: string;
  model: string;
  nozzleFamily: string;
  compatibleHeadFamilies: string[];
  specs: Record<string, unknown>;
  nozzleChart?: NozzleChart;
};

const UTILITY_ITEMS: CatalogSeedItem[] = [
  {
    id: "cat_drip_line",
    category: "DRIP",
    manufacturer: "Rain Bird",
    model: "XFS Dripline 0.6 GPH",
    specs: { spacingInches: 12, gphPerEmitter: 0.6 },
  },
  {
    id: "cat_valve_pgv",
    category: "VALVE",
    manufacturer: "Rain Bird",
    model: "PGV 1\" Valve",
    specs: { sizeInches: 1, flowGpmMax: 40 },
  },
  {
    id: "cat_pipe_1pvc",
    category: "PIPE",
    manufacturer: "Generic",
    model: "1\" Schedule 40 PVC",
    specs: { diameterInches: 1, material: "PVC", cCoefficient: 150 },
  },
  {
    id: "cat_pipe_075pvc",
    category: "PIPE",
    manufacturer: "Generic",
    model: "3/4\" Schedule 40 PVC",
    specs: { diameterInches: 0.75, material: "PVC", cCoefficient: 150 },
  },
  {
    id: "cat_fitting_elbow",
    category: "FITTING",
    manufacturer: "Generic",
    model: "90° Elbow 1\"",
    specs: { type: "elbow", sizeInches: 1 },
  },
  {
    id: "cat_fitting_tee",
    category: "FITTING",
    manufacturer: "Generic",
    model: "Tee 1\"",
    specs: { type: "tee", sizeInches: 1 },
  },
  {
    id: "cat_controller",
    category: "CONTROLLER",
    manufacturer: "Rain Bird",
    model: "ESP-ME3 8 Station",
    specs: { stations: 8, wifi: true },
  },
];

function loadJsonDir(dir: string): CatalogSeedItem[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as CatalogSeedItem[]);
}

function canonicalExtractedId(id: string): string {
  const laMatch = id.match(/^noz_rb_5000_([\d_]+)_la$/);
  if (laMatch) return `noz_rb_5000_la_${laMatch[1]}`;
  return id.replace(/r-van/gi, "r_van");
}

function normalizeExtractedNozzle(raw: ExtractedNozzleRaw): CatalogSeedItem {
  const manufacturer = raw.nozzleFamily.startsWith("hunter") ? "Hunter" : "Rain Bird";
  const category =
    raw.nozzleFamily === "hunter_mp_rotator" || raw.nozzleFamily === "rainbird_rvan"
      ? "MP_ROTATOR"
      : "ROTOR";

  return {
    id: canonicalExtractedId(raw.id),
    category,
    manufacturer,
    model: raw.model,
    specs: {
      itemRole: "nozzle",
      nozzleFamily: raw.nozzleFamily,
      compatibleHeadFamilies: raw.compatibleHeadFamilies,
      ...raw.specs,
    },
    ...(raw.nozzleChart ? { nozzleChart: raw.nozzleChart } : {}),
  };
}

function loadExtractedPdfNozzles(): CatalogSeedItem[] {
  if (!fs.existsSync(extractedDir)) return [];
  return EXTRACTED_PDF_FILES.flatMap((file) => {
    const filePath = path.join(extractedDir, file);
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExtractedNozzleRaw[];
    return raw.map(normalizeExtractedNozzle);
  });
}

function mergeManufacturerNozzles(
  manual: CatalogSeedItem[],
  extracted: CatalogSeedItem[]
): CatalogSeedItem[] {
  const manualFiltered = manual.filter((item) => {
    const family = item.specs.nozzleFamily as string | undefined;
    return !family || !PDF_EXTRACTED_FAMILIES.has(family);
  });
  const byId = new Map(manualFiltered.map((item) => [item.id, item]));
  for (const item of extracted) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function main() {
  const hunterGenerated = loadJsonDir(generatedDir);
  const extractedPdf = loadExtractedPdfNozzles();
  const manufacturerNozzles = mergeManufacturerNozzles(MANUFACTURER_NOZZLES, extractedPdf);
  const all = [...HEAD_ITEMS, ...hunterGenerated, ...manufacturerNozzles, ...UTILITY_ITEMS];

  const outPath = path.join(__dirname, "../catalog-items.json");
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(
    `Catalog built: ${all.length} items (${HEAD_ITEMS.length} heads, ${hunterGenerated.length} hunter chart nozzles, ${manufacturerNozzles.length} manufacturer nozzles incl. ${extractedPdf.length} from PDF extract)`
  );
}

main();
