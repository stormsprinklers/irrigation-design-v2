import {
  buildMaterialList,
  calculateQuoteTotals,
  applyGrossMargin,
} from "@/lib/domain/materials";
import type {
  CatalogItemData,
  DesignDocument,
  MaterialLineItem,
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
  quoteTier?: "STANDARD" | "PREMIUM";
  estimatedManHours?: number;
  installDurationDays?: number;
  designInternalBom?: MaterialLineItem[];
  premiumOptionTotal?: number;
  premiumOption?: {
    sellTotal: number;
    lineItems: CrmEstimateLineItem[];
  };
  attachments?: Array<{ fileName: string; mimeType: string; base64: string }>;
};

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
  includePremiumOption?: boolean;
  installDurationDays?: number;
}): CrmEstimatePayload {
  const marginPercent =
    params.targetMarginOverride ??
    params.pricing.grossMarginPercent ??
    params.pricing.targetProfitMarginPercent ??
    50;

  const pricingWithMargin = { ...params.pricing, grossMarginPercent: marginPercent };

  function tierPayload(tier: "STANDARD" | "PREMIUM") {
    const doc = { ...params.doc, metadata: { ...params.doc.metadata, quoteTier: tier } };
    const materials = buildMaterialList(doc, params.catalog, pricingWithMargin, tier);
    const totals = calculateQuoteTotals(doc, materials, pricingWithMargin);
    const zoneNames = doc.zones.map((z) => z.name).join(", ") || "all zones";
    const lineItems: CrmEstimateLineItem[] = [
      {
        name: `Irrigation system installation (${tier === "PREMIUM" ? "Premium" : "Standard"})`,
        description: `${doc.heads.length} heads · ${doc.zones.length} zones · ${totals.manHours.total} est. hours · ${zoneNames}`,
        quantity: 1,
        unit: "job",
        unitPrice: totals.sellPrice,
      },
    ];
    return { doc, materials, totals, lineItems };
  }

  const standard = tierPayload("STANDARD");
  const premium = params.includePremiumOption !== false ? tierPayload("PREMIUM") : null;

  return {
    externalId: `design:${params.projectId}:${params.versionId}`,
    customerId: params.customerId,
    propertyId: params.propertyId ?? null,
    designProjectId: params.projectId,
    designVersionId: params.versionId,
    status: params.status ?? "DRAFT",
    notes: `Exported from Design: ${params.projectName} (${params.versionLabel})`,
    lineItems: standard.lineItems,
    quoteTier: "STANDARD" as const,
    estimatedManHours: standard.totals.manHours.total,
    installDurationDays: params.installDurationDays ?? 4,
    designInternalBom: standard.materials,
    premiumOptionTotal: premium?.totals.sellPrice,
    premiumOption: premium
      ? {
          sellTotal: premium.totals.sellPrice,
          lineItems: premium.lineItems,
        }
      : undefined,
    designExportMetadata: {
      projectName: params.projectName,
      versionLabel: params.versionLabel,
      zoneCount: params.doc.hydrozones?.length ?? 0,
      headCount: params.doc.heads?.length ?? 0,
      estimatedManHours: standard.totals.manHours.total,
      manHoursBreakdown: standard.totals.manHours,
      costSubtotal: standard.totals.subtotal,
      laborCost: standard.totals.laborCost,
      totalCost: standard.totals.totalCost,
      marginPercent,
      sellSubtotal: standard.totals.sellPrice,
      premiumSellTotal: premium?.totals.sellPrice,
      internalBom: standard.materials,
      premiumInternalBom: premium?.materials,
      warnings: params.warnings ?? [],
      designSnapshot: {
        zones: params.doc.zones,
        heads: params.doc.heads.map((h) => ({
          id: h.id,
          zoneId: h.zoneId,
          position: h.position,
          catalogItemId: h.catalogItemId,
        })),
        pipes: params.doc.pipes,
        valves: params.doc.valves,
        equipment: params.doc.equipment,
        hydrozones: params.doc.hydrozones,
      },
    },
  };
}

export { applyGrossMargin };
