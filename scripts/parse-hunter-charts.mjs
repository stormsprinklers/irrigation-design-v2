/**
 * Parses Hunter product markdown exports for nozzle performance tables.
 * Run: node scripts/parse-hunter-charts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir =
  process.env.HUNTER_UPLOADS_DIR ??
  "C:\\Users\\jgree\\.cursor\\projects\\c-Users-jgree-OneDrive-Desktop-Irrigation-Design-v2\\uploads";
const outDir = path.resolve(__dirname, "../prisma/seed-data/catalog/generated");

const FILES = {
  "pgp-adj": {
    file: "pgp-adj-6.md",
    headFamily: "hunter_pgp_adj",
    families: [
      { key: "pgp_adj_red", label: "Red", section: "PGP Standard Red Nozzle Performance Data" },
      { key: "pgp_adj_blue", label: "Blue", section: "PGP Standard Blue Nozzle Performance Data" },
      { key: "pgp_adj_la", label: "LA Grey", section: "PGP Gray Low-Angle Nozzle Performance Data" },
    ],
  },
  pgj: {
    file: "pgj-8.md",
    headFamily: "hunter_pgj",
    families: [{ key: "pgj_red", label: "Red", section: "PGJ Nozzle Performance Data" }],
  },
  "pgp-ultra-i20": {
    file: "i-20-16.md",
    headFamilies: ["hunter_pgp_ultra", "hunter_i20"],
    families: [
      { key: "pgp_ultra_i20_blue", label: "Blue", section: "PGP Ultra / I-20 Blue Standard Nozzle Performance Data" },
      { key: "pgp_ultra_i20_la", label: "LA Grey", section: "PGP Ultra / I-20 Grey Low-Angle Nozzle Performance Data" },
      { key: "pgp_ultra_i20_hf", label: "HF Green", section: "PGP Ultra / I-20 High-Flow Nozzle Performance Data" },
      { key: "pgp_ultra_i20_sr", label: "SR Black", section: "PGP Ultra / I-20 Black Short-Radius Nozzle Performance Data" },
      { key: "pgp_ultra_i20_mpr25", label: "MPR-25 Red", section: "MPR-25 Red Nozzle Performance Data", mpr: true },
      { key: "pgp_ultra_i20_mpr30", label: "MPR-30 Lt. Green", section: "MPR-30 Lt. Green Nozzle Performance Data", mpr: true },
      { key: "pgp_ultra_i20_mpr35", label: "MPR-35 Beige", section: "MPR-35 Beige Nozzle Performance Data", mpr: true },
    ],
  },
};

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function num(cell) {
  return Number(String(cell).replace(/\*\*/g, "").trim());
}

function isNewNozzleRow(cell) {
  const c = cell.replace(/\*\*/g, "").trim();
  if (!c || /^\d+$/.test(c)) return false;
  return /•|Red|Blue|Grey|Gray|Green|Black|Beige|LA|SR|°/i.test(c);
}

function parseNozzleLabel(cell) {
  const cleaned = cell.replace(/\*\*/g, "").trim();
  const m = cleaned.match(/^([\d.]+)\s*(?:•|LA|SR)?/);
  if (m) return m[1].replace(/^\./, "0.");
  return null;
}

function parseArcLabel(cell) {
  const m = cell.match(/(\d+)\s*°/);
  if (m) return Number(m[1]);
  if (cell.includes("360")) return 360;
  return null;
}

function extractSection(content, sectionTitle) {
  const idx = content.indexOf(sectionTitle);
  if (idx === -1) return "";
  const next = content.indexOf("### ", idx + sectionTitle.length);
  return next === -1 ? content.slice(idx) : content.slice(idx, next);
}

function parseRotorTable(section, familyKey, familyLabel, headFamilies, mpr = false) {
  const lines = section.split("\n").filter((l) => l.startsWith("|"));
  const nozzles = [];
  let currentNozzle = null;
  let currentArc = null;

  for (const line of lines) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 5) continue;
    if (cells[0].includes("Nozzle") || cells[0].includes("Arc")) continue;
    if (cells[0].includes("Notes:")) break;

    if (mpr) {
      const arc = parseArcLabel(cells[0]);
      if (arc !== null) currentArc = arc;
      const psi = num(cells[1]);
      if (!Number.isFinite(psi)) continue;
      const radius = num(cells[2]);
      const gpm = num(cells[3]);
      const precipSq = num(cells[4]);
      const precipTri = num(cells[5]);
      if (!currentArc) continue;
      const id = `noz_${familyKey}_arc${currentArc}`;
      let nozzle = nozzles.find((n) => n.id === id);
      if (!nozzle) {
        nozzle = {
          id,
          model: `${familyLabel} ${currentArc}°`,
          nozzleFamily: familyKey,
          compatibleHeadFamilies: headFamilies,
        specs: {
          itemRole: "nozzle",
          nozzleFamily: familyKey,
          compatibleHeadFamilies: headFamilies,
          arcDegrees: currentArc,
          color: familyLabel.split(" ")[0],
          mpr: true,
        },
          points: [],
        };
        nozzles.push(nozzle);
      }
      nozzle.points.push({
        pressurePsi: psi,
        radiusFeet: radius,
        gpm,
        precipSqInPerHr: precipSq,
        precipTriInPerHr: precipTri,
      });
      continue;
    }

    const nozzleLabel = isNewNozzleRow(cells[0]) ? parseNozzleLabel(cells[0]) : null;
    if (nozzleLabel) {
      currentNozzle = nozzleLabel;
      const id = `noz_${familyKey}_${slug(currentNozzle)}`;
      nozzles.push({
        id,
        model: `${familyLabel} Nozzle ${currentNozzle}`,
        nozzleFamily: familyKey,
        compatibleHeadFamilies: headFamilies,
        specs: {
          itemRole: "nozzle",
          nozzleFamily: familyKey,
          compatibleHeadFamilies: headFamilies,
          nozzleSize: Number(currentNozzle),
          color: familyLabel.split(" ")[0],
        },
        points: [],
      });
    }

    const active = nozzles[nozzles.length - 1];
    if (!active) continue;

    const psi = num(nozzleLabel ? cells[1] : cells[0]);
    if (!Number.isFinite(psi)) continue;
    const radius = num(nozzleLabel ? cells[2] : cells[1]);
    const gpm = num(nozzleLabel ? cells[3] : cells[2]);
    const precipSq = num(nozzleLabel ? cells[4] : cells[3]);
    const precipTri = num(nozzleLabel ? cells[5] : cells[4]);
    if (!Number.isFinite(radius) || !Number.isFinite(gpm)) continue;

    active.points.push({
      pressurePsi: psi,
      radiusFeet: radius,
      gpm,
      precipSqInPerHr: precipSq,
      precipTriInPerHr: precipTri,
    });
  }

  return nozzles.map((n) => ({
    id: n.id,
    category: "ROTOR",
    manufacturer: "Hunter",
    model: n.model,
    specs: n.specs,
    nozzleChart: {
      pressurePsi: n.points.map((p) => p.pressurePsi),
      radiusFeet: n.points.map((p) => p.radiusFeet),
      gpm: n.points.map((p) => p.gpm),
      precipInPerHr: n.points.map((p) => p.precipSqInPerHr),
      precipTriInPerHr: n.points.map((p) => p.precipTriInPerHr),
    },
  }));
}

fs.mkdirSync(outDir, { recursive: true });

for (const [outName, cfg] of Object.entries(FILES)) {
  const filePath = path.join(uploadsDir, cfg.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing ${filePath}`);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const headFamilies = cfg.headFamilies ?? [cfg.headFamily];
  const all = [];
  for (const fam of cfg.families) {
    const section = extractSection(content, fam.section);
    all.push(...parseRotorTable(section, fam.key, fam.label, headFamilies, fam.mpr));
  }
  const outPath = path.join(outDir, `${outName}-nozzles.json`);
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} nozzles -> ${outPath}`);
}
