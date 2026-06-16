import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extractedDir = path.resolve(__dirname, "../prisma/seed-data/catalog/extracted");

function readTxt(name) {
  return fs.readFileSync(path.join(extractedDir, name), "utf8");
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function nozzleSizeNum(label) {
  const m = String(label).match(/^([\d.]+)/);
  return m ? Number(m[1]) : undefined;
}

function buildEntry({ id, model, nozzleFamily, compatibleHeadFamilies, specs, points }) {
  return {
    id,
    model,
    nozzleFamily,
    compatibleHeadFamilies,
    specs,
    nozzleChart: {
      pressurePsi: points.map((p) => p.pressurePsi),
      radiusFeet: points.map((p) => p.radiusFeet),
      gpm: points.map((p) => p.gpm),
      precipInPerHr: points.map((p) => p.precipSq),
      precipTriInPerHr: points.map((p) => p.precipTri),
    },
  };
}

function parseRainBirdRotorImperial(sectionText, config) {
  const { family, compatibleHeadFamilies, idPrefix, modelPrefix, trajectoryDeg = 25, lowAngle = false } = config;
  const nozzles = new Map();
  let pressure = null;

  for (const raw of sectionText.split(/\r?\n/)) {
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (!line) continue;
    if (/METRIC/i.test(line)) break;
    if (/Flow Rate v Inlet/i.test(line)) break;
    if (/Pressure\s+Nozzle/i.test(line)) continue;
    if (/^psi\b/i.test(line)) continue;
    if (/ASAE|Precipitation rates|Performance data|See page|www\.rainbird/i.test(line)) continue;
    if (/^Rotors|^Q\s+V|^--\s+\d+ of/i.test(line)) continue;
    if (/Nozzle Performance/i.test(line)) continue;
    if (/5000\/5000 Plus Series Nozzles/i.test(line)) continue;

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 5) continue;

    let idx = 0;
    const maybePressure = Number(parts[0]);
    const allowedPressures = new Set([25, 35, 45, 55, 65, 75]); if (Number.isInteger(maybePressure) && allowedPressures.has(maybePressure) && parts.length >= 6) {
      if (String(parts[0]).includes("–") || String(parts[0]).includes("-")) continue;
      pressure = maybePressure;
      idx = 1;
    }
    if (pressure === null) continue;

    if (/PRS/i.test(parts[idx]) || /–/.test(parts[idx])) continue;

    let nozzleLabel;
    if (parts[idx + 1] === "LA") {
      nozzleLabel = `${parts[idx]} LA`;
      idx += 2;
    } else {
      nozzleLabel = parts[idx];
      idx += 1;
    }

    if (!/^[\d.]+/.test(nozzleLabel)) continue;

    const radius = Number(parts[idx]);
    const gpm = Number(parts[idx + 1]);
    const precipSq = Number(parts[idx + 2]);
    const precipTri = Number(parts[idx + 3]);
    if (![radius, gpm, precipSq, precipTri].every(Number.isFinite)) continue;

    const size = nozzleSizeNum(nozzleLabel);
    const key = nozzleLabel;
    if (!nozzles.has(key)) {
      const idSuffix = slug(nozzleLabel.replace(/\./g, "_"));
      nozzles.set(key, {
        id: `${idPrefix}_${idSuffix}`,
        model: `${modelPrefix} Nozzle ${nozzleLabel}`,
        nozzleFamily: family,
        compatibleHeadFamilies,
        specs: {
          nozzleSize: size,
          trajectoryDeg,
          ...(lowAngle ? { lowAngle: true } : {}),
        },
        points: [],
      });
    }
    nozzles.get(key).points.push({
      pressurePsi: pressure,
      radiusFeet: radius,
      gpm,
      precipSq,
      precipTri,
    });
  }

  return [...nozzles.values()].map((n) => buildEntry(n));
}

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : -1;
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function parse3500() {
  const text = readTxt("chart_3500.txt");
  const start = text.indexOf("psi \tft. \tgpm \tIn/h \tIn/h");
  const end = text.indexOf("\n3500 Nozzle Performance\n", start);
  const section = text.slice(start, end);
  return parseRainBirdRotorImperial(section, {
    family: "rainbird_3500",
    compatibleHeadFamilies: ["rainbird_3500"],
    idPrefix: "noz_rb_3500",
    modelPrefix: "3500",
    trajectoryDeg: 25,
  });
}

function parse5000() {
  const text = readTxt("chart_5000.txt");
  const stdStart = text.indexOf("psi \tft. \tgpm \tIn/h \tIn/h");
  const stdTitle = text.indexOf("5000/5000 Plus Std. Angle Rain Curtain", stdStart);
  const stdContStart = text.indexOf("psi \tft. \tgpm \tIn/h \tIn/h", stdTitle);
  const stdContEnd = text.indexOf("\n1.7 \t1.5", stdContStart);
  const stdBlock =
    text.slice(stdStart, stdTitle) +
    (stdContStart !== -1 ? "\n" + text.slice(stdContStart, stdContEnd === -1 ? undefined : stdContEnd) : "");
  const laAnchor = text.indexOf("25 \t1.0 LA");
  const laStart = text.lastIndexOf("psi \tft. \tgpm \tIn/h \tIn/h", laAnchor);
  const laEnd = text.indexOf("\n5000/5000 Plus Low Angle Nozzle Performance\n", laStart);
  const laSection = text.slice(laStart, laEnd);
  const stdParsed = parseRainBirdRotorImperial(stdBlock, {
    family: "rainbird_5000",
    compatibleHeadFamilies: ["rainbird_5000"],
    idPrefix: "noz_rb_5000",
    modelPrefix: "5000",
    trajectoryDeg: 25,
  });
  const laParsed = parseRainBirdRotorImperial(laSection, {
    family: "rainbird_5000",
    compatibleHeadFamilies: ["rainbird_5000"],
    idPrefix: "noz_rb_5000",
    modelPrefix: "5000",
    trajectoryDeg: 25,
    lowAngle: true,
  });
  const byId = new Map();
  for (const n of [...stdParsed, ...laParsed]) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseArcToken(tok) {
  const m = String(tok).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseRvan() {
  const text = readTxt("R-VAN-TechSpec.txt");
  const compatible = ["rainbird_1800", "rainbird_1800_prs", "rainbird_1800_sam"];
  const modelDefs = [
    { key: "R-VAN14", start: "R-VAN14 \t8", radiusRange: "8-14" },
    { key: "R-VAN14-360", start: "R-VAN14-360 \t8", radiusRange: "8-14", fullCircle: true },
    { key: "R-VAN18", start: "R-VAN18 \t13", radiusRange: "13-18" },
    { key: "R-VAN18-360", start: "R-VAN18-360 \t13", radiusRange: "13-18", fullCircle: true },
    { key: "R-VAN24", start: "R-VAN24 \t17", radiusRange: "17-24" },
    { key: "R-VAN24-360", start: "R-VAN24-360 \t17", radiusRange: "17-24", fullCircle: true },
    { key: "R-VAN-LCS", start: "R-VAN-LCS \t5", strip: "left_corner" },
    { key: "R-VAN-RCS", start: "R-VAN-RCS \t5", strip: "right_corner" },
    { key: "R-VAN-SST", start: "R-VAN-SST \t5", strip: "side" },
  ];

  const results = [];
  for (const def of modelDefs) {
    const start = text.indexOf(def.start);
    if (start === -1) continue;
    const nextStarts = modelDefs
      .filter((d) => d.start !== def.start)
      .map((d) => text.indexOf(d.start, start + 5))
      .filter((i) => i !== -1);
    const end = nextStarts.length ? Math.min(...nextStarts) : text.length;
    const section = text.slice(start, end);
    const nozzles = new Map();
    let arc = null;

    const addPoint = (id, meta, point) => {
      if (!nozzles.has(id)) nozzles.set(id, { id, ...meta, points: [] });
      nozzles.get(id).points.push(point);
    };

    for (const raw of section.split(/\r?\n/)) {
      const line = raw.replace(/\u00a0/g, " ").trim();
      if (!line || /^Arc\b/i.test(line) || /^Pressure\b/i.test(line) || /Precip\./i.test(line) || /^n\b/i.test(line)) continue;
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length < 4) continue;

      const arcTok = parts[0].match(/^(\d{2,3})/);
      const isArcLine = arcTok && (parts[0].includes("°") || parts[0].includes("A"));
      let pressure;
      let sizeOrRadius;
      let gpm;
      let precipSq;
      let precipTri;

      if (isArcLine) {
        arc = Number(arcTok[1]);
        pressure = Number(parts[1]);
        sizeOrRadius = parts[2];
        gpm = Number(parts[3]);
        precipSq = Number(parts[4]);
        precipTri = Number(parts[5]);
      } else if ([30, 35, 40, 45, 50, 55].includes(Number(parts[0])) && (arc || def.strip)) {
        pressure = Number(parts[0]);
        sizeOrRadius = parts[1];
        gpm = Number(parts[2]);
        precipSq = Number(parts[3]);
        precipTri = Number(parts[4]);
      } else if (
        def.strip &&
        (/^(Side|Left|Right)$/i.test(parts[0]) || /^(Corner|Strip)$/i.test(parts[0])) &&
        [30, 35, 40, 45, 50, 55].includes(Number(parts[/^(Corner|Strip)$/i.test(parts[0]) ? 1 : 1]))
      ) {
        const pIdx = /^(Corner|Strip)$/i.test(parts[0]) ? 1 : 1;
        pressure = Number(parts[pIdx]);
        sizeOrRadius = parts[pIdx + 1];
        gpm = Number(parts[pIdx + 2]);
        precipSq = Number(parts[pIdx + 3]);
        precipTri = Number(parts[pIdx + 4]);
      } else continue;

      if (![30, 35, 40, 45, 50, 55].includes(pressure)) continue;
      if (!Number.isFinite(gpm) || !Number.isFinite(precipSq) || !Number.isFinite(precipTri)) continue;

      let radiusFeet;
      let patternSize;
      if (/x/i.test(String(sizeOrRadius))) {
        patternSize = sizeOrRadius;
        radiusFeet = Number((patternSize.match(/\d+/) ?? ["0"])[0]);
      } else {
        radiusFeet = Number(sizeOrRadius);
      }
      if (!Number.isFinite(radiusFeet)) continue;

      let id;
      let model;
      let specs;
      if (def.strip) {
        id = `noz_rb_${slug(def.key)}`;
        model = def.key;
        specs = { rvanModel: def.key, stripPattern: def.strip, ...(patternSize ? { patternSize } : {}) };
      } else if (def.fullCircle) {
        id = `noz_rb_${slug(def.key)}`;
        model = def.key;
        specs = { rvanModel: def.key, radiusRangeFt: def.radiusRange, arcDegrees: 360 };
      } else {
        id = `noz_rb_${slug(def.key)}_arc${arc}`;
        model = `${def.key} ${arc}°`;
        specs = { rvanModel: def.key, radiusRangeFt: def.radiusRange, arcDegrees: arc };
      }

      addPoint(id, { model, nozzleFamily: "rainbird_rvan", compatibleHeadFamilies: compatible, specs }, {
        pressurePsi: pressure,
        radiusFeet,
        gpm,
        precipSq,
        precipTri,
      });
    }

    for (const n of nozzles.values()) {
      if (n.points.length) {
        const entry = buildEntry(n);
        entry.nozzleChart.recommendedPressurePsi = 45;
        results.push(entry);
      }
    }
  }

  return results;
}

function parseMpCombined1000_2000(text) {
  const start = text.indexOf("Arc \tPressure");
  const end = text.indexOf("MP-3000");
  const block = text.slice(start, end);
  const series = [
    { name: "MP-1000", id: "mp1000", family: "hunter_mp_rotator", cols: 5 },
    { name: "MP-2000", id: "mp2000", family: "hunter_mp_rotator", cols: 3 },
  ];
  const nozzles = new Map();
  let arc = null;

  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /Arc\s+Pressure/i.test(line)) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 8) continue;
    const arcTok = parseArcToken(parts[0]);
    if (arcTok) arc = arcTok;
    const psi = Number(parts[1]);
    if (!Number.isInteger(psi)) continue;

    const mp1000 = {
      radiusFeet: Number(parts[2]),
      gpm: Number(parts[3]),
      precipSq: Number(parts[5]),
      precipTri: Number(parts[6]),
    };
    const mp2000 = {
      radiusFeet: Number(parts[7]),
      gpm: Number(parts[8]),
      precipSq: Number(parts[9]),
      precipTri: Number(parts[10]),
    };

    for (const [spec, data] of [
      [series[0], mp1000],
      [series[1], mp2000],
    ]) {
      if (![data.radiusFeet, data.gpm, data.precipSq, data.precipTri].every(Number.isFinite)) continue;
      const id = `noz_hunter_${spec.id}_arc${arc}`;
      if (!nozzles.has(id)) {
        nozzles.set(id, {
          id,
          model: `${spec.name} ${arc}°`,
          nozzleFamily: spec.family,
          compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
          specs: { mpModel: spec.name, arcDegrees: arc },
          points: [],
        });
      }
      nozzles.get(id).points.push({
        pressurePsi: psi,
        radiusFeet: data.radiusFeet,
        gpm: data.gpm,
        precipSq: data.precipSq,
        precipTri: data.precipTri,
      });
    }
  }
  return [...nozzles.values()].map((n) => buildEntry(n));
}

function parseMp800sr(text) {
  const block = text.slice(text.indexOf("MIN RADIUS"), text.indexOf("To achieve the lowest radius"));
  const nozzles = new Map();
  let arc = null;
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /MIN RADIUS|Arc\s+Pressure/i.test(line)) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 10) continue;
    const arcTok = parseArcToken(parts[0]);
    if (arcTok) arc = arcTok;
    const psi = Number(parts[1]);
    if (!Number.isInteger(psi)) continue;

    const segments = [
      { tag: "min", radius: Number(parts[2]), gpm: Number(parts[3]) },
      { tag: "mid", radius: Number(parts[4]), gpm: Number(parts[5]), precipSq: Number(parts[7]), precipTri: Number(parts[8]) },
      { tag: "max", radius: Number(parts[9]), gpm: Number(parts[10]), precipSq: Number(parts[11]), precipTri: Number(parts[12]) },
    ];

    for (const seg of segments) {
      if (!Number.isFinite(seg.radius) || !Number.isFinite(seg.gpm)) continue;
      const id = `noz_hunter_mp800sr_arc${arc}_${seg.tag}`;
      if (!nozzles.has(id)) {
        nozzles.set(id, {
          id,
          model: `MP-800SR ${arc}° (${seg.tag} radius)`,
          nozzleFamily: "hunter_mp_rotator",
          compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
          specs: { mpModel: "MP-800SR", arcDegrees: arc, radiusSetting: seg.tag },
          points: [],
        });
      }
      const precipSq = seg.precipSq ?? 0;
      const precipTri = seg.precipTri ?? 0;
      nozzles.get(id).points.push({
        pressurePsi: psi,
        radiusFeet: seg.radius,
        gpm: seg.gpm,
        precipSq,
        precipTri,
      });
    }
  }
  return [...nozzles.values()].map((n) => buildEntry(n));
}

function parseMp3000(text) {
  const block = text.slice(text.indexOf("MP-3000"), text.indexOf("MP Corner"));
  const nozzles = new Map();
  let arc = null;
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /MP-3000|Arc\s+Pressure|Blue:/i.test(line)) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 5) continue;
    const arcTok = parseArcToken(parts[0]);
    if (arcTok) arc = arcTok;
    const psi = Number(parts[1]);
    if (!Number.isInteger(psi)) continue;
    const radius = Number(parts[2]);
    const gpm = Number(parts[3]);
    const precipSq = Number(parts[4]);
    const precipTri = Number(parts[5]);
    if (![radius, gpm, precipSq, precipTri].every(Number.isFinite)) continue;
    const id = `noz_hunter_mp3000_arc${arc}`;
    if (!nozzles.has(id)) {
      nozzles.set(id, {
        id,
        model: `MP-3000 ${arc}°`,
        nozzleFamily: "hunter_mp_rotator",
        compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
        specs: { mpModel: "MP-3000", arcDegrees: arc },
        points: [],
      });
    }
    nozzles.get(id).points.push({ pressurePsi: psi, radiusFeet: radius, gpm, precipSq, precipTri });
  }
  return [...nozzles.values()].map((n) => buildEntry(n));
}

function parseMpCorner(text) {
  const block = text.slice(text.indexOf("MP Corner"), text.indexOf("MP-3500"));
  const nozzles = new Map();
  let arc = null;
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /MP Corner|Turquoise|Arc\s+Pressure/i.test(line)) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 4) continue;
    const arcTok = parseArcToken(parts[0]);
    if (arcTok) arc = arcTok;
    const psi = Number(parts[1]);
    if (!Number.isInteger(psi)) continue;
    const radius = Number(parts[2]);
    const gpm = Number(parts[3]);
    if (![radius, gpm].every(Number.isFinite)) continue;
    const id = `noz_hunter_mp_corner_arc${arc}`;
    if (!nozzles.has(id)) {
      nozzles.set(id, {
        id,
        model: `MP Corner ${arc}°`,
        nozzleFamily: "hunter_mp_rotator",
        compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
        specs: { mpModel: "MP Corner", arcDegrees: arc },
        points: [],
      });
    }
    nozzles.get(id).points.push({ pressurePsi: psi, radiusFeet: radius, gpm, precipSq: 0, precipTri: 0 });
  }
  return [...nozzles.values()].map((n) => buildEntry(n));
}

function parseMp3500(text) {
  const rows = [];
  const block = text.slice(text.indexOf("MP-3500"), text.indexOf("MP-LCS-515"));
  for (const raw of block.split(/\r?\n/)) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 4 && parts.every((x) => /^[\d.]+$/.test(x))) {
      rows.push({
        radiusFeet: Number(parts[0]),
        gpm: Number(parts[1]),
        precipSq: Number(parts[2]),
        precipTri: Number(parts[3]),
      });
    }
  }
  const arcs = [90, 180, 210];
  const pressures = [30, 40, 50];
  const nozzles = [];
  let i = 0;
  for (const arc of arcs) {
    const points = [];
    for (const psi of pressures) {
      const row = rows[i++];
      if (!row) break;
      points.push({
        pressurePsi: psi,
        radiusFeet: row.radiusFeet,
        gpm: row.gpm,
        precipSq: row.precipSq,
        precipTri: row.precipTri,
      });
    }
    nozzles.push(
      buildEntry({
        id: `noz_hunter_mp3500_arc${arc}`,
        model: `MP-3500 ${arc}°`,
        nozzleFamily: "hunter_mp_rotator",
        compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
        specs: { mpModel: "MP-3500", arcDegrees: arc },
        points,
      })
    );
  }
  return nozzles;
}

function parseMpStrips(text) {
  const defs = [
    { id: "mp_lcs_515", model: "MP-LCS-515", strip: "left_corner", anchor: "MP-LCS-515" },
    { id: "mp_rcs_515", model: "MP-RCS-515", strip: "right_corner", anchor: "MP-RCS-515" },
    { id: "mp_ss_530", model: "MP-SS-530", strip: "side", anchor: "MP-SS-530" },
  ];
  const out = [];
  for (const def of defs) {
    const idx = text.indexOf(def.anchor);
    if (idx === -1) continue;
    const chunk = text.slice(idx, idx + 500);
    const points = [];
    for (const raw of chunk.split(/\r?\n/)) {
      const parts = raw.trim().split(/\s+/).filter(Boolean);
      if (parts.length < 4) continue;
      const psi = Number(parts[0]);
      if (![30, 40, 50].includes(psi)) continue;
      let size;
      let gpm;
      if (parts[2] === "x" && parts[3]) {
        size = `${parts[1]} x ${parts[3]}`;
        gpm = Number(parts[4]);
      } else {
        size = parts[1];
        gpm = Number(parts[2]);
      }
      if (!Number.isFinite(gpm)) continue;
      const radiusFeet = Number((String(size).match(/\d+/) ?? ["0"])[0]);
      points.push({ pressurePsi: psi, radiusFeet, gpm, precipSq: 0, precipTri: 0, patternSize: size });
    }
    if (points.length) {
      out.push(
        buildEntry({
          id: `noz_hunter_${def.id}`,
          model: def.model,
          nozzleFamily: "hunter_mp_rotator",
          compatibleHeadFamilies: ["hunter_pro_spray", "hunter_pro_spray_prs40"],
          specs: { mpModel: def.model, stripPattern: def.strip },
          points,
        })
      );
    }
  }
  return out;
}

function parseHunterMp() {
  const text = readTxt("rc_mprotator_dom.txt");
  return [
    ...parseMp800sr(text),
    ...parseMpCombined1000_2000(text),
    ...parseMp3000(text),
    ...parseMpCorner(text),
    ...parseMp3500(text),
    ...parseMpStrips(text),
  ];
}

const out3500 = parse3500();
const out5000 = parse5000();
const outRvan = parseRvan();
const outHunter = parseHunterMp();

for (const [name, data] of [
  ["rainbird-3500.json", out3500],
  ["rainbird-5000.json", out5000],
  ["rainbird-rvan.json", outRvan],
  ["hunter-mp-rotator.json", outHunter],
]) {
  const p = path.join(extractedDir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  console.log(name, data.length, "nozzles");
}










