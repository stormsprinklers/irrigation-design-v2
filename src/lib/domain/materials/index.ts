import { pixelsPerFoot, polylineLengthFeet } from "../hydraulics";
import type {
  CatalogItemData,
  DesignDocument,
  MaterialLineItem,
  PricingProfileData,
} from "../types";

export function buildMaterialList(
  doc: DesignDocument,
  catalog: CatalogItemData[],
  pricing: PricingProfileData
): MaterialLineItem[] {
  const items: MaterialLineItem[] = [];
  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const ppf = pixelsPerFoot(doc.scale);
  const waste = 1 + pricing.wasteFactor;

  const headCounts = new Map<string, number>();
  for (const head of doc.heads) {
    headCounts.set(head.catalogItemId, (headCounts.get(head.catalogItemId) ?? 0) + 1);
  }

  for (const [catalogItemId, qty] of headCounts) {
    const item = catalogMap.get(catalogItemId);
    items.push({
      catalogItemId,
      description: item ? `${item.manufacturer} ${item.model}` : "Sprinkler head",
      quantity: qty,
      unit: "ea",
      unitCost: pricing.headCost,
      extendedCost: qty * pricing.headCost,
    });
  }

  for (const valve of doc.valves) {
    const item = catalogMap.get(valve.catalogItemId);
    items.push({
      catalogItemId: valve.catalogItemId,
      description: item ? `${item.manufacturer} ${item.model}` : "Valve",
      quantity: 1,
      unit: "ea",
      unitCost: pricing.valveCost,
      extendedCost: pricing.valveCost,
    });
  }

  let totalPipeFeet = 0;
  for (const pipe of doc.pipes) {
    const length =
      pipe.lengthFeet ??
      (ppf ? polylineLengthFeet(pipe.points, ppf) : pipe.points.length * 2);
    totalPipeFeet += length;
  }

  if (totalPipeFeet > 0) {
    const qty = Math.ceil(totalPipeFeet * waste);
    items.push({
      description: "Pipe (assorted sizes)",
      quantity: qty,
      unit: "ft",
      unitCost: pricing.pipePerFoot,
      extendedCost: qty * pricing.pipePerFoot,
    });
  }

  const fittingCount = Math.ceil(doc.heads.length * 0.5 + doc.pipes.length);
  const fittingCost = pricing.fittingAssumptions.elbow ?? 2.5;
  if (fittingCount > 0) {
    items.push({
      description: "Fittings (estimated)",
      quantity: fittingCount,
      unit: "ea",
      unitCost: fittingCost,
      extendedCost: fittingCount * fittingCost,
    });
  }

  return items;
}

export function calculateMaterialTotal(
  items: MaterialLineItem[],
  pricing: PricingProfileData
): { subtotal: number; labor: number; markup: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.extendedCost, 0);
  const labor = subtotal * pricing.laborMultiplier;
  const withLabor = subtotal + labor;
  const markup = withLabor * pricing.markup;
  const beforeTax = withLabor + markup;
  const tax = beforeTax * pricing.tax;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    labor: Math.round(labor * 100) / 100,
    markup: Math.round(markup * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((beforeTax + tax) * 100) / 100,
  };
}
