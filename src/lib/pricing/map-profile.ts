import type { PricingProfile } from "@prisma/client";
import { DEFAULT_PRICING_PROFILE, type PricingProfileData } from "@/lib/domain/types";

export function mapPricingProfile(pricing: PricingProfile | null): PricingProfileData {
  if (!pricing) return DEFAULT_PRICING_PROFILE;
  return {
    pipePerFoot: pricing.pipePerFoot,
    headCost: pricing.headCost,
    nozzleCost: pricing.nozzleCost,
    headBodyCost: pricing.headBodyCost,
    valveCost: pricing.valveCost,
    backflowCost: pricing.backflowCost,
    filterCost: pricing.filterCost,
    prsCost: pricing.prsCost,
    flowSensorCost: pricing.flowSensorCost,
    weatherSensorCost: pricing.weatherSensorCost,
    controllerCost: pricing.controllerCost,
    sodPerSqFt: pricing.sodPerSqFt,
    topsoilPerSqFt: pricing.topsoilPerSqFt,
    laborHourlyRate: pricing.laborHourlyRate,
    hoursPerHead: pricing.hoursPerHead,
    hoursPerZone: pricing.hoursPerZone,
    hoursPer100ftPipe: pricing.hoursPer100ftPipe,
    hoursSlopeModifier: pricing.hoursSlopeModifier,
    hoursConcreteModifier: pricing.hoursConcreteModifier,
    hoursRetainingWallModifier: pricing.hoursRetainingWallModifier,
    jobMinimum: pricing.jobMinimum,
    grossMarginPercent: pricing.grossMarginPercent,
    premiumMaintenanceYearPrice: pricing.premiumMaintenanceYearPrice,
    laborMultiplier: pricing.laborMultiplier,
    markup: pricing.markup,
    targetProfitMarginPercent: pricing.targetProfitMarginPercent,
    tax: pricing.tax,
    wasteFactor: pricing.wasteFactor,
    fittingAssumptions: (pricing.fittingAssumptions as Record<string, number>) ?? {},
    pipePricingByDiameter: (pricing.pipePricingByDiameter as Record<string, number>) ?? {},
    catalogCostOverrides: (pricing.catalogCostOverrides as Record<string, number>) ?? {},
  };
}
