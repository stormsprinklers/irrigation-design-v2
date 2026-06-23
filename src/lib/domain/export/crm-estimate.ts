import {
  buildMaterialList,
  calculateMaterialTotal,
} from "@/lib/domain/materials";
import type {
  CatalogItemData,
  DesignDocument,
  PricingProfileData,
} from "@/lib/domain/types";

export type CrmEstimateLineItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type CrmEstimatePayload = {
  externalId: string;
  customerId: string;
  propertyId?: string | null;
  designProjectId: string;
  designVersionId: string;
  status?: "DRAFT" | "SENT";
  notes?: string | null;
  lineItems: CrmEstimateLineItem[];
  designExportMetadata: Record<string, unknown>;
};

function applyMargin(cost: number, marginPercent: number): number {
  const margin = Math.min(99, Math.max(0, marginPercent)) / 100;
  if (margin >= 1) return cost;
  return Math.round((cost / (1 - margin)) * 100) / 100;
}

export function buildCrmEstimatePayload(params: {
  doc: DesignDocument;
  catalog: CatalogItemData[];
  pricing: PricingProfileData;
  projectId: string;
  projectName: string;
  versionId: string;
  versionLabel: string;
  customerId: string;
  propertyId?: string | null;
  targetMarginOverride?: number;
  status?: "DRAFT" | "SENT";
  warnings?: string[];
}): CrmEstimatePayload {
  const materials = buildMaterialList(params.doc, params.catalog, params.pricing);
  const totals = calculateMaterialTotal(materials, params.pricing);
  const marginPercent =
    params.targetMarginOverride ??
    params.pricing.targetProfitMarginPercent ??
    params.pricing.markup * 100;

  const lineItems: CrmEstimateLineItem[] = materials.map((item) => ({
    name: item.description,
    description: item.unit ? `${item.quantity} ${item.unit}` : null,
    quantity: item.quantity,
    unit: item.unit ?? "ea",
    unitPrice: applyMargin(item.unitCost, marginPercent),
  }));

  if (totals.labor > 0) {
    lineItems.push({
      name: "Labor",
      description: "Design labor estimate",
      quantity: 1,
      unit: "ea",
      unitPrice: applyMargin(totals.labor + totals.markup, marginPercent),
    });
  }

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return {
    externalId: `design:${params.projectId}:${params.versionId}`,
    customerId: params.customerId,
    propertyId: params.propertyId ?? null,
    designProjectId: params.projectId,
    designVersionId: params.versionId,
    status: params.status ?? "DRAFT",
    notes: `Exported from Design: ${params.projectName} (${params.versionLabel})`,
    lineItems,
    designExportMetadata: {
      projectName: params.projectName,
      versionLabel: params.versionLabel,
      zoneCount: params.doc.hydrozones?.length ?? 0,
      headCount: params.doc.heads?.length ?? 0,
      costSubtotal: totals.subtotal,
      marginPercent,
      sellSubtotal: subtotal,
      warnings: params.warnings ?? [],
    },
  };
}
