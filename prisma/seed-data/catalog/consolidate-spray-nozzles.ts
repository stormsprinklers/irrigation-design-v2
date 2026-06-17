import type { CatalogSeedItem } from "./chart";
import {
  MP_ARC_BANDS,
  MP_RADIUS_FT,
  RVAN_RADIUS_FT,
  defaultMinRadius,
  sprayNozzleSpecs,
  type MpArcBand,
} from "./adjustability";
import {
  RVAN_STRIP_ROWS,
  STRIP_MODEL_DIMENSIONS,
  buildStripNozzleChart,
  parsePatternSizeFt,
  stripLengthRange,
  type StripChartRow,
} from "./strip-nozzle-helpers";

export type ExtractedNozzleRaw = {
  id: string;
  model: string;
  nozzleFamily: string;
  compatibleHeadFamilies: string[];
  specs: Record<string, unknown>;
  nozzleChart?: CatalogSeedItem["nozzleChart"];
};

function arcToMpBand(arc: number, mpModel: string): MpArcBand | null {
  if (arc >= 360) return "360";
  if (mpModel === "MP-800SR") return "90_210";
  if (arc >= 210 && arc <= 270) return "210_270";
  if (arc >= 40 && arc <= 210) return "90_210";
  return null;
}

function pickChartSource(
  entries: ExtractedNozzleRaw[],
  preferArc: number
): ExtractedNozzleRaw | undefined {
  const maxRadius = entries.find(
    (e) => e.specs.arcDegrees === preferArc && e.specs.radiusSetting === "max"
  );
  if (maxRadius) return maxRadius;
  return (
    entries.find((e) => e.specs.arcDegrees === preferArc && !e.specs.radiusSetting) ??
    entries.find((e) => e.specs.arcDegrees === preferArc) ??
    entries.find((e) => !e.specs.radiusSetting) ??
    entries[0]
  );
}

function mpBandSuffix(band: MpArcBand): string {
  if (band === "90_210") return "90";
  if (band === "210_270") return "210";
  return "360";
}

function mpSkuModel(mpModel: string, band: MpArcBand): string {
  const suffix = mpBandSuffix(band);
  if (mpModel === "MP-800SR") return "MP800SR";
  if (mpModel === "MP Corner") return "MP Corner";
  return `${mpModel.replace("MP-", "MP")}-${suffix}`;
}

function consolidateMpRotators(raw: ExtractedNozzleRaw[]): CatalogSeedItem[] {
  const mpItems = raw.filter((r) => r.nozzleFamily === "hunter_mp_rotator");
  const items: CatalogSeedItem[] = [];
  const seen = new Set<string>();

  const stripItems = mpItems.filter((r) => r.specs.stripPattern);
  for (const strip of stripItems) {
    const arc = (strip.specs.arcDegrees as number) ?? 180;
    const mpModel = strip.specs.mpModel as string | undefined;
    const dims =
      (mpModel && STRIP_MODEL_DIMENSIONS[mpModel]) ??
      (typeof strip.specs.patternSize === "string"
        ? parsePatternSizeFt(strip.specs.patternSize)
        : null);
    const rows: StripChartRow[] | undefined = dims
      ? (strip.nozzleChart?.pressurePsi ?? [30, 40, 50]).slice(0, 3).map((psi, i) => [
          psi,
          dims.widthFt,
          dims.lengthFt,
          strip.nozzleChart?.gpm?.[i] ?? 0.2,
          strip.nozzleChart?.precipInPerHr?.[i] ?? 0.6,
          strip.nozzleChart?.precipTriInPerHr?.[i] ?? 0.6,
        ])
      : undefined;
    const chart = rows ? buildStripNozzleChart(rows, 45) : strip.nozzleChart;
    const lengthRange = rows
      ? stripLengthRange(rows)
      : {
          min: dims?.lengthFt ?? 15,
          max: dims?.lengthFt ?? 15,
        };

    items.push({
      id: strip.id,
      category: "MP_ROTATOR",
      manufacturer: "Hunter",
      model: strip.model,
      specs: sprayNozzleSpecs(
        {
          nozzleFamily: "hunter_mp_rotator",
          compatibleHeadFamilies: strip.compatibleHeadFamilies,
          stripPattern: strip.specs.stripPattern,
          mpModel: strip.specs.mpModel,
          ...(dims
            ? {
                patternWidthFt: dims.widthFt,
                patternLengthFt: dims.lengthFt,
                patternSize: `${dims.widthFt}' x ${dims.lengthFt}'`,
              }
            : {}),
        },
        {
          arcMin: arc,
          arcMax: arc,
          arcDefault: arc,
          radiusMin: lengthRange.min,
          radiusMax: lengthRange.max,
          arcAdjustable: false,
          radiusAdjustable: false,
        }
      ),
      nozzleChart: chart,
    });
    seen.add(strip.id);
  }

  const cornerItems = mpItems.filter((r) => r.specs.mpModel === "MP Corner");
  if (cornerItems.length > 0) {
    const source = pickChartSource(cornerItems, 45) ?? cornerItems[0];
    items.push({
      id: "noz_hunter_mp_corner",
      category: "MP_ROTATOR",
      manufacturer: "Hunter",
      model: "MP Corner",
      specs: sprayNozzleSpecs(
        {
          nozzleFamily: "hunter_mp_rotator",
          compatibleHeadFamilies: source.compatibleHeadFamilies,
          mpModel: "MP Corner",
        },
        {
          arcMin: 45,
          arcMax: 45,
          arcDefault: 45,
          radiusMin: 5,
          radiusMax: 8,
          arcAdjustable: false,
          radiusAdjustable: true,
          fixedLeftEdge: true,
        }
      ),
      nozzleChart: source.nozzleChart,
    });
  }

  const grouped = new Map<string, ExtractedNozzleRaw[]>();
  for (const item of mpItems) {
    if (item.specs.stripPattern || item.specs.mpModel === "MP Corner") continue;
    const mpModel = item.specs.mpModel as string;
    if (!mpModel) continue;
    const band = arcToMpBand(item.specs.arcDegrees as number, mpModel);
    if (!band) continue;
    const key = `${mpModel}::${band}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  for (const [key, entries] of grouped) {
    const [mpModel, band] = key.split("::") as [string, MpArcBand];
    const bandSpec = MP_ARC_BANDS[band];
    const radius = MP_RADIUS_FT[mpModel] ?? {
      min: defaultMinRadius(
        Math.max(...(entries[0].nozzleChart?.radiusFeet ?? [12]))
      ),
      max: Math.max(...(entries[0].nozzleChart?.radiusFeet ?? [12])),
    };

    const source = pickChartSource(entries, bandSpec.default) ?? entries[0];
    const slug = mpModel.replace(/^MP-/i, "mp").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const id = `noz_hunter_${slug}_${mpBandSuffix(band)}`;

    items.push({
      id,
      category: "MP_ROTATOR",
      manufacturer: "Hunter",
      model: mpSkuModel(mpModel, band),
      specs: sprayNozzleSpecs(
        {
          nozzleFamily: "hunter_mp_rotator",
          compatibleHeadFamilies: source.compatibleHeadFamilies,
          mpModel,
          chartReferenceArcDegrees: source.specs.arcDegrees,
        },
        {
          arcMin: bandSpec.min,
          arcMax: bandSpec.max,
          arcDefault: bandSpec.default,
          radiusMin: radius.min,
          radiusMax: radius.max,
          arcAdjustable: band !== "360",
          radiusAdjustable: true,
          fixedLeftEdge: bandSpec.fixedLeftEdge,
          mpArcBand: band,
        }
      ),
      nozzleChart: source.nozzleChart,
    });
  }

  return items;
}

function consolidateRvan(raw: ExtractedNozzleRaw[]): CatalogSeedItem[] {
  const rvanItems = raw.filter((r) => r.nozzleFamily === "rainbird_rvan");
  const items: CatalogSeedItem[] = [];

  const adjustableModels = ["R-VAN14", "R-VAN18", "R-VAN24"] as const;
  for (const model of adjustableModels) {
    const entries = rvanItems.filter((r) => r.specs.rvanModel === model);
    if (entries.length === 0) continue;
    const source =
      pickChartSource(entries, 180) ??
      pickChartSource(entries, 270) ??
      entries[0];
    const radius = RVAN_RADIUS_FT[model];
    const slug = model.toLowerCase().replace(/-/g, "_");

    items.push({
      id: `noz_rb_${slug}`,
      category: "MP_ROTATOR",
      manufacturer: "Rain Bird",
      model,
      specs: sprayNozzleSpecs(
        {
          nozzleFamily: "rainbird_rvan",
          compatibleHeadFamilies: source.compatibleHeadFamilies,
          rvanModel: model,
          chartReferenceArcDegrees: source.specs.arcDegrees,
        },
        {
          arcMin: 45,
          arcMax: 270,
          arcDefault: 180,
          radiusMin: radius.min,
          radiusMax: radius.max,
          arcAdjustable: true,
          radiusAdjustable: true,
        }
      ),
      nozzleChart: source.nozzleChart,
    });
  }

  const fixedModels = [
    "R-VAN14-360",
    "R-VAN18-360",
    "R-VAN24-360",
    "R-VAN-LCS",
    "R-VAN-RCS",
    "R-VAN-SST",
  ] as const;

  for (const model of fixedModels) {
    const source = rvanItems.find((r) => r.specs.rvanModel === model);
    if (!source) continue;
    const slug = model.toLowerCase().replace(/-/g, "_");
    const isStrip = Boolean(source.specs.stripPattern);
    const stripRows = isStrip ? RVAN_STRIP_ROWS[model] : undefined;
    const stripDims = isStrip ? STRIP_MODEL_DIMENSIONS[model] : undefined;
    const radius = isStrip && stripRows
      ? stripLengthRange(stripRows)
      : RVAN_RADIUS_FT[model] ?? {
          min: source.nozzleChart?.radiusFeet?.[0] ?? 5,
          max:
            source.nozzleChart?.radiusFeet?.[source.nozzleChart.radiusFeet.length - 1] ?? 15,
        };
    const arc = isStrip ? 180 : 360;
    const nozzleChart =
      isStrip && stripRows ? buildStripNozzleChart(stripRows, 45) : source.nozzleChart;

    items.push({
      id: `noz_rb_${slug}`,
      category: "MP_ROTATOR",
      manufacturer: "Rain Bird",
      model,
      specs: sprayNozzleSpecs(
        {
          nozzleFamily: "rainbird_rvan",
          compatibleHeadFamilies: source.compatibleHeadFamilies,
          rvanModel: model,
          ...(isStrip && stripDims
            ? {
                stripPattern: source.specs.stripPattern,
                patternWidthFt: stripDims.widthFt,
                patternLengthFt: stripDims.lengthFt,
                patternSize: `${stripDims.widthFt}' x ${stripDims.lengthFt}'`,
              }
            : {}),
        },
        {
          arcMin: arc,
          arcMax: arc,
          arcDefault: arc,
          radiusMin: radius.min,
          radiusMax: radius.max,
          arcAdjustable: false,
          radiusAdjustable: !isStrip,
        }
      ),
      nozzleChart,
    });
  }

  return items;
}

export function consolidateSprayNozzles(raw: ExtractedNozzleRaw[]): CatalogSeedItem[] {
  return [...consolidateMpRotators(raw), ...consolidateRvan(raw)];
}
