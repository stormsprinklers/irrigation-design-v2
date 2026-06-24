import { pixelsPerFoot, polylineLengthFeet } from "../hydraulics";
import { polygonAreaSqFt } from "../geometry";
import type {
  CatalogItemData,
  DesignDocument,
  EquipmentType,
  ManHoursBreakdown,
  MaterialLineItem,
  PricingProfileData,
  QuoteTier,
} from "../types";

function equipmentUnitCost(type: EquipmentType, pricing: PricingProfileData): number {
  switch (type) {
    case "BACKFLOW":
      return pricing.backflowCost;
    case "FILTER":
      return pricing.filterCost;
    case "PRESSURE_REGULATOR":
      return pricing.prsCost;
    case "FLOW_SENSOR":
      return pricing.flowSensorCost;
    case "WEATHER_SENSOR":
      return pricing.weatherSensorCost;
    case "CONTROLLER":
      return pricing.controllerCost;
    case "POC":
      return 0;
    default:
      return 0;
  }
}

function pipeUnitCost(diameterInches: number, pricing: PricingProfileData): number {
  const key = String(diameterInches);
  return pricing.pipePricingByDiameter[key] ?? pricing.pipePerFoot;
}

function catalogOverrideCost(catalogItemId: string | undefined, pricing: PricingProfileData): number | null {
  if (!catalogItemId) return null;
  const override = pricing.catalogCostOverrides[catalogItemId];
  return override !== undefined ? override : null;
}

export function estimateManHours(
  doc: DesignDocument,
  pricing: PricingProfileData
): ManHoursBreakdown {
  const ppf = pixelsPerFoot(doc.scale);
  let totalPipeFeet = 0;
  for (const pipe of doc.pipes) {
    totalPipeFeet +=
      pipe.lengthFeet ??
      (ppf ? polylineLengthFeet(pipe.points, ppf) : pipe.points.length * 2);
  }

  const heads = doc.heads.length * pricing.hoursPerHead;
  const zones = doc.zones.length * pricing.hoursPerZone;
  const pipe = (totalPipeFeet / 100) * pricing.hoursPer100ftPipe;

  let siteFeatures = 0;
  for (const feature of doc.siteFeatures ?? []) {
    const area = ppf ? polygonAreaSqFt(feature.vertices, ppf) : 0;
    const areaFactor = area > 0 ? Math.min(area / 500, 3) : 1;
    switch (feature.featureType) {
      case "SLOPE":
        siteFeatures += pricing.hoursSlopeModifier * areaFactor;
        break;
      case "CONCRETE":
        siteFeatures += pricing.hoursConcreteModifier * areaFactor;
        break;
      case "RETAINING_WALL":
        siteFeatures += pricing.hoursRetainingWallModifier * areaFactor;
        break;
      default:
        siteFeatures += 0.1 * areaFactor;
    }
  }

  let landscape = 0;
  for (const area of doc.landscapeAreas ?? []) {
    const sqFt = ppf ? polygonAreaSqFt(area.vertices, ppf) : 0;
    landscape += sqFt > 0 ? sqFt / 400 : 0.5;
  }

  const total = heads + zones + pipe + siteFeatures + landscape;
  return {
    heads: Math.round(heads * 100) / 100,
    zones: Math.round(zones * 100) / 100,
    pipe: Math.round(pipe * 100) / 100,
    siteFeatures: Math.round(siteFeatures * 100) / 100,
    landscape: Math.round(landscape * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function buildMaterialList(
  doc: DesignDocument,
  catalog: CatalogItemData[],
  pricing: PricingProfileData,
  quoteTier: QuoteTier = doc.metadata?.quoteTier ?? "STANDARD"
): MaterialLineItem[] {
  const items: MaterialLineItem[] = [];
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const ppf = pixelsPerFoot(doc.scale);
  const waste = 1 + pricing.wasteFactor;
  const usePrs = quoteTier === "PREMIUM";

  const nozzleCounts = new Map<string, number>();
  const bodyCounts = new Map<string, number>();

  for (const head of doc.heads) {
    nozzleCounts.set(head.catalogItemId, (nozzleCounts.get(head.catalogItemId) ?? 0) + 1);
    if (head.headBodyId) {
      bodyCounts.set(head.headBodyId, (bodyCounts.get(head.headBodyId) ?? 0) + 1);
    }
  }

  for (const [catalogItemId, qty] of nozzleCounts) {
    const item = catalogMap.get(catalogItemId);
    const override = catalogOverrideCost(catalogItemId, pricing);
    const unitCost = override ?? (usePrs ? pricing.prsCost : pricing.nozzleCost);
    items.push({
      catalogItemId,
      description: item
        ? `${usePrs ? "PRS " : ""}${item.manufacturer} ${item.model} (nozzle)`
        : usePrs
          ? "PRS nozzle"
          : "Sprinkler nozzle",
      quantity: qty,
      unit: "ea",
      unitCost,
      extendedCost: qty * unitCost,
      category: "nozzle",
    });
  }

  for (const [catalogItemId, qty] of bodyCounts) {
    const item = catalogMap.get(catalogItemId);
    const override = catalogOverrideCost(catalogItemId, pricing);
    const unitCost = override ?? pricing.headBodyCost;
    items.push({
      catalogItemId,
      description: item ? `${item.manufacturer} ${item.model} (body)` : "Sprinkler head body",
      quantity: qty,
      unit: "ea",
      unitCost,
      extendedCost: qty * unitCost,
      category: "head_body",
    });
  }

  for (const head of doc.heads.filter((h) => !h.headBodyId)) {
    const override = catalogOverrideCost(head.catalogItemId, pricing);
    const unitCost = override ?? pricing.headBodyCost;
    items.push({
      catalogItemId: head.catalogItemId,
      description: "Sprinkler head body (default)",
      quantity: 1,
      unit: "ea",
      unitCost,
      extendedCost: unitCost,
      category: "head_body",
    });
  }

  for (const valve of doc.valves) {
    const item = catalogMap.get(valve.catalogItemId);
    const override = catalogOverrideCost(valve.catalogItemId, pricing);
    const unitCost = override ?? pricing.valveCost;
    items.push({
      catalogItemId: valve.catalogItemId,
      description: item ? `${item.manufacturer} ${item.model}` : "Valve",
      quantity: 1,
      unit: "ea",
      unitCost,
      extendedCost: unitCost,
      category: "valve",
    });
  }

  const pipeByKey = new Map<string, number>();
  for (const pipe of doc.pipes) {
    const length =
      pipe.lengthFeet ??
      (ppf ? polylineLengthFeet(pipe.points, ppf) : pipe.points.length * 2);
    const key = `${pipe.material}-${pipe.diameterInches}`;
    pipeByKey.set(key, (pipeByKey.get(key) ?? 0) + length);
  }

  for (const [key, feet] of pipeByKey) {
    const [material, diameterStr] = key.split("-");
    const diameter = Number(diameterStr);
    const qty = Math.ceil(feet * waste);
    const unitCost = pipeUnitCost(diameter, pricing);
    items.push({
      description: `Pipe ${diameter}" ${material}`,
      quantity: qty,
      unit: "ft",
      unitCost,
      extendedCost: qty * unitCost,
      category: "pipe",
    });
  }

  const fittingCount = Math.ceil(doc.heads.length * 0.5 + doc.pipes.length);
  const elbowCost = pricing.fittingAssumptions.elbow ?? 2.5;
  const teeCost = pricing.fittingAssumptions.tee ?? 3.5;
  if (fittingCount > 0) {
    const elbowQty = Math.ceil(fittingCount * 0.7);
    const teeQty = fittingCount - elbowQty;
    if (elbowQty > 0) {
      items.push({
        description: "Elbow fittings (estimated)",
        quantity: elbowQty,
        unit: "ea",
        unitCost: elbowCost,
        extendedCost: elbowQty * elbowCost,
        category: "fitting",
      });
    }
    if (teeQty > 0) {
      items.push({
        description: "Tee fittings (estimated)",
        quantity: teeQty,
        unit: "ea",
        unitCost: teeCost,
        extendedCost: teeQty * teeCost,
        category: "fitting",
      });
    }
  }

  for (const equip of doc.equipment ?? []) {
    if (quoteTier === "STANDARD" && (equip.equipmentType === "FLOW_SENSOR" || equip.equipmentType === "WEATHER_SENSOR")) {
      continue;
    }
    const unitCost = equipmentUnitCost(equip.equipmentType, pricing);
    if (unitCost <= 0 && equip.equipmentType === "POC") continue;
    const item = equip.catalogItemId ? catalogMap.get(equip.catalogItemId) : undefined;
    items.push({
      catalogItemId: equip.catalogItemId,
      description: item
        ? `${item.manufacturer} ${item.model}`
        : equip.equipmentType.replace(/_/g, " "),
      quantity: 1,
      unit: "ea",
      unitCost,
      extendedCost: unitCost,
      category: "equipment",
    });
  }

  if (quoteTier === "PREMIUM") {
    const hasFlow = (doc.equipment ?? []).some((e) => e.equipmentType === "FLOW_SENSOR");
    const hasWeather = (doc.equipment ?? []).some((e) => e.equipmentType === "WEATHER_SENSOR");
    if (!hasFlow) {
      items.push({
        description: "Flow sensor",
        quantity: 1,
        unit: "ea",
        unitCost: pricing.flowSensorCost,
        extendedCost: pricing.flowSensorCost,
        category: "equipment",
      });
    }
    if (!hasWeather) {
      items.push({
        description: "Weather sensor",
        quantity: 1,
        unit: "ea",
        unitCost: pricing.weatherSensorCost,
        extendedCost: pricing.weatherSensorCost,
        category: "equipment",
      });
    }
    items.push({
      description: "1-year maintenance plan",
      quantity: 1,
      unit: "ea",
      unitCost: pricing.premiumMaintenanceYearPrice,
      extendedCost: pricing.premiumMaintenanceYearPrice,
      category: "service",
    });
  }

  for (const area of doc.landscapeAreas ?? []) {
    const sqFt = ppf ? polygonAreaSqFt(area.vertices, ppf) : 0;
    if (sqFt <= 0) continue;
    const qty = Math.ceil(sqFt);
    if (area.areaType === "SOD") {
      items.push({
        description: "Sod",
        quantity: qty,
        unit: "sq ft",
        unitCost: pricing.sodPerSqFt,
        extendedCost: qty * pricing.sodPerSqFt,
        category: "landscape",
      });
    } else {
      items.push({
        description: area.depthInches ? `Topsoil (${area.depthInches}" depth)` : "Topsoil",
        quantity: qty,
        unit: "sq ft",
        unitCost: pricing.topsoilPerSqFt,
        extendedCost: qty * pricing.topsoilPerSqFt,
        category: "landscape",
      });
    }
  }

  return items;
}

export type QuoteTotals = {
  subtotal: number;
  laborCost: number;
  totalCost: number;
  sellPrice: number;
  tax: number;
  totalWithTax: number;
  manHours: ManHoursBreakdown;
  grossMarginPercent: number;
  jobMinimumApplied: boolean;
};

export function calculateQuoteTotals(
  doc: DesignDocument,
  items: MaterialLineItem[],
  pricing: PricingProfileData
): QuoteTotals {
  const subtotal = items.reduce((sum, i) => sum + i.extendedCost, 0);
  const manHours = estimateManHours(doc, pricing);
  const laborCost = manHours.total * pricing.laborHourlyRate;
  const totalCost = subtotal + laborCost;
  const margin = Math.min(99, Math.max(0, pricing.grossMarginPercent)) / 100;
  let sellPrice = margin >= 1 ? totalCost : totalCost / (1 - margin);
  const jobMinimumApplied = sellPrice < pricing.jobMinimum;
  if (jobMinimumApplied) sellPrice = pricing.jobMinimum;
  const tax = sellPrice * pricing.tax;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    sellPrice: Math.round(sellPrice * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    totalWithTax: Math.round((sellPrice + tax) * 100) / 100,
    manHours,
    grossMarginPercent: pricing.grossMarginPercent,
    jobMinimumApplied,
  };
}

/** @deprecated Use calculateQuoteTotals */
export function calculateMaterialTotal(
  items: MaterialLineItem[],
  pricing: PricingProfileData,
  doc?: DesignDocument
): {
  subtotal: number;
  labor: number;
  markup: number;
  tax: number;
  total: number;
  sellPrice: number;
  manHours?: ManHoursBreakdown;
} {
  const emptyDoc: DesignDocument = doc ?? {
    hydrozones: [],
    exclusionZones: [],
    siteFeatures: [],
    landscapeAreas: [],
    zones: [],
    heads: [],
    pipes: [],
    valves: [],
    equipment: [],
    metadata: { units: "imperial" },
  };
  const totals = calculateQuoteTotals(emptyDoc, items, pricing);
  return {
    subtotal: totals.subtotal,
    labor: totals.laborCost,
    markup: Math.round((totals.sellPrice - totals.totalCost) * 100) / 100,
    tax: totals.tax,
    total: totals.totalWithTax,
    sellPrice: totals.sellPrice,
    manHours: totals.manHours,
  };
}

export function applyGrossMargin(cost: number, grossMarginPercent: number): number {
  const margin = Math.min(99, Math.max(0, grossMarginPercent)) / 100;
  if (margin >= 1) return cost;
  return Math.round((cost / (1 - margin)) * 100) / 100;
}
