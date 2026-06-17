import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HEAD_ITEMS } from "./heads";
import { MANUFACTURER_NOZZLES } from "./nozzles-manufacturer";
import { RAINBIRD_SPRAY_NOZZLES } from "./rainbird-spray-nozzles";
import { enrichNozzleItem } from "./adjustability";
import {
  consolidateSprayNozzles,
  type ExtractedNozzleRaw,
} from "./consolidate-spray-nozzles";
import type { CatalogSeedItem, NozzleChart } from "./chart";
import { rotorNozzleSpecs } from "./adjustability";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.join(__dirname, "generated");
const extractedDir = path.join(__dirname, "extracted");

const ROTOR_PDF_FILES = ["rainbird-3500.json", "rainbird-5000.json"] as const;
const SPRAY_PDF_FILES = ["rainbird-rvan.json", "hunter-mp-rotator.json"] as const;

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

function normalizeRotorExtractedNozzle(raw: ExtractedNozzleRaw): CatalogSeedItem {
  const manufacturer = raw.nozzleFamily.startsWith("hunter") ? "Hunter" : "Rain Bird";
  const chartMax = raw.nozzleChart?.radiusFeet?.length
    ? Math.max(...raw.nozzleChart.radiusFeet)
    : undefined;

  return {
    id: canonicalExtractedId(raw.id),
    category: "ROTOR",
    manufacturer,
    model: raw.model,
    specs: {
      ...rotorNozzleSpecs({
        nozzleFamily: raw.nozzleFamily,
        compatibleHeadFamilies: raw.compatibleHeadFamilies,
        ...raw.specs,
      }),
      ...(chartMax
        ? {
            radiusFeetMax: chartMax,
            radiusFeetMin: Math.round(chartMax * 0.75 * 100) / 100,
            arcDegreesMin: 40,
            arcDegreesMax: 360,
            arcDegreesDefault: 180,
          }
        : {}),
    },
    ...(raw.nozzleChart ? { nozzleChart: raw.nozzleChart } : {}),
  };
}

function loadRotorPdfNozzles(): CatalogSeedItem[] {
  if (!fs.existsSync(extractedDir)) return [];
  return ROTOR_PDF_FILES.flatMap((file) => {
    const filePath = path.join(extractedDir, file);
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExtractedNozzleRaw[];
    return raw.map(normalizeRotorExtractedNozzle);
  });
}

function loadConsolidatedSprayNozzles(): CatalogSeedItem[] {
  if (!fs.existsSync(extractedDir)) return [];
  const raw = SPRAY_PDF_FILES.flatMap((file) => {
    const filePath = path.join(extractedDir, file);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ExtractedNozzleRaw[];
  });
  return consolidateSprayNozzles(raw);
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
  // PDF consolidation may omit a band SKU (e.g. MP3500-360); keep manual fallbacks.
  for (const item of manual) {
    if (item.specs.nozzleFamily !== "hunter_mp_rotator") continue;
    if (item.specs.stripPattern || item.specs.mpModel === "MP Corner") continue;
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function main() {
  const hunterGenerated = loadJsonDir(generatedDir).map(enrichNozzleItem);
  const rotorPdf = loadRotorPdfNozzles();
  const sprayPdf = loadConsolidatedSprayNozzles();
  const extractedPdf = [...rotorPdf, ...sprayPdf];
  const manufacturerNozzles = mergeManufacturerNozzles(MANUFACTURER_NOZZLES, extractedPdf).map(
    enrichNozzleItem
  );
  const rainbirdSpray = RAINBIRD_SPRAY_NOZZLES.map(enrichNozzleItem);
  const all = [...HEAD_ITEMS, ...hunterGenerated, ...manufacturerNozzles, ...rainbirdSpray, ...UTILITY_ITEMS];

  const outPath = path.join(__dirname, "../catalog-items.json");
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(
    `Catalog built: ${all.length} items (${HEAD_ITEMS.length} heads, ${hunterGenerated.length} hunter chart nozzles, ${manufacturerNozzles.length} manufacturer nozzles incl. ${sprayPdf.length} spray + ${rotorPdf.length} rotor from PDF extract, ${rainbirdSpray.length} rainbird spray)`
  );
}

main();
