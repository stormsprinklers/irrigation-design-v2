export type Point = { x: number; y: number };

export type HydrozoneType = "TURF" | "SHRUBS" | "TREES" | "DRIP" | "GARDEN";
export type ExclusionType =
  | "BUILDING"
  | "DRIVEWAY"
  | "PATIO"
  | "FENCE"
  | "TREE"
  | "SLOPE"
  | "NO_OVERSPRAY";

export type SiteFeatureType = "SLOPE" | "FENCE" | "RETAINING_WALL" | "CONCRETE";
export type LandscapeAreaType = "SOD" | "TOPSOIL";
export type EquipmentType =
  | "POC"
  | "BACKFLOW"
  | "FILTER"
  | "PRESSURE_REGULATOR"
  | "FLOW_SENSOR"
  | "WEATHER_SENSOR"
  | "CONTROLLER";

export type QuoteTier = "STANDARD" | "PREMIUM";
export type SunExposure = "FULL_SUN" | "PART_SHADE" | "FULL_SHADE";
export type SoilType = "CLAY" | "LOAM" | "SAND" | "ROCKY";
export type HeadFamily = "SPRAY" | "ROTOR" | "MP_ROTATOR" | "DRIP";
export type SpacingPatternOverride = "auto" | "square" | "triangular";
export type SpacingPattern = "square" | "triangular";
export type WarningCode =
  | "COVERAGE_GAP"
  | "HEAD_SPACING"
  | "LOW_OVERLAP"
  | "PRECIP_MISMATCH"
  | "PRESSURE_LOW"
  | "FLOW_EXCEEDED"
  | "VELOCITY_HIGH"
  | "MIXED_HEAD_TYPES"
  | "OVERSPRAY_EXCLUSION"
  | "MANUAL_REVIEW"
  | "SCALE_MISSING"
  | "WATER_SOURCE_MISSING";

export type PropertyImage = {
  blobPath: string;
  width: number;
  height: number;
};

export type ScaleCalibration = {
  pointA: Point;
  pointB: Point;
  realWorldFeet: number;
};

export type WaterSourceConfig = {
  staticPressurePsi: number;
  availableGpm: number;
  meterSizeInches: number;
  backflowType: string;
  poc: Point;
  mainlineMaterial: string;
  mainlineSizeInches: number;
  isSecondaryWater: boolean;
};

export const DEFAULT_WATER_SOURCE: WaterSourceConfig = {
  staticPressurePsi: 65,
  availableGpm: 10,
  meterSizeInches: 0.75,
  backflowType: "PVB",
  poc: { x: 100, y: 100 },
  mainlineMaterial: "PVC",
  mainlineSizeInches: 1,
  isSecondaryWater: false,
};

export const DEFAULT_PRESSURE_PSI = DEFAULT_WATER_SOURCE.staticPressurePsi;

export type HydrozonePolygon = {
  id: string;
  name: string;
  vertices: Point[];
  zoneId?: string;
  hydrozoneType: HydrozoneType;
  sunExposure: SunExposure;
  slopePercent: number;
  soilType: SoilType;
  waterPriority: number;
  headPreference: HeadFamily;
  spacingPattern?: SpacingPatternOverride;
};

export type ExclusionZone = {
  id: string;
  name: string;
  vertices: Point[];
  exclusionType: ExclusionType;
};

export type SiteFeaturePolygon = {
  id: string;
  name: string;
  vertices: Point[];
  featureType: SiteFeatureType;
};

export type LandscapeArea = {
  id: string;
  name: string;
  vertices: Point[];
  areaType: LandscapeAreaType;
  depthInches?: number;
};

export type EquipmentPlacement = {
  id: string;
  equipmentType: EquipmentType;
  position: Point;
  catalogItemId?: string;
  zoneId?: string;
};

export type IrrigationZone = {
  id: string;
  name: string;
  valveId?: string;
  hydrozoneIds: string[];
  runtimeMinutes?: number;
};

export type SprinklerHead = {
  id: string;
  zoneId: string;
  hydrozoneId?: string;
  position: Point;
  /** Nozzle catalog item (performance chart). */
  catalogItemId: string;
  /** Spray/rotor body catalog item. */
  headBodyId?: string;
  arcDegrees: number;
  radiusFeet: number;
  rotationDegrees: number;
  gpm?: number;
  precipInPerHr?: number;
  locked: boolean;
  fieldNotes?: string;
  installedAt?: string;
};

export type PipeSegment = {
  id: string;
  zoneId: string;
  catalogItemId: string;
  points: Point[];
  diameterInches: number;
  material: string;
  lengthFeet?: number;
  frictionLossPsi?: number;
  fieldNotes?: string;
};

export type Valve = {
  id: string;
  zoneId: string;
  position: Point;
  catalogItemId: string;
};

export type DesignMetadata = {
  units: "imperial";
  lastValidatedAt?: string;
  quoteTier?: QuoteTier;
};

export type DesignDocument = {
  propertyImage?: PropertyImage;
  scale?: ScaleCalibration;
  waterSource?: WaterSourceConfig;
  hydrozones: HydrozonePolygon[];
  exclusionZones: ExclusionZone[];
  siteFeatures: SiteFeaturePolygon[];
  landscapeAreas: LandscapeArea[];
  zones: IrrigationZone[];
  heads: SprinklerHead[];
  pipes: PipeSegment[];
  valves: Valve[];
  equipment: EquipmentPlacement[];
  metadata: DesignMetadata;
};

export type ValidationSeverity = "info" | "warning" | "critical";

export type ValidationIssue = {
  code: WarningCode;
  severity: ValidationSeverity;
  message: string;
  entityIds: string[];
  suggestedAction?: string;
};

export type PlacementResult = {
  heads: SprinklerHead[];
  coveragePercent: number;
  overlapPercent?: number;
  pattern?: SpacingPattern;
  nozzleModel?: string;
  radiusFeet?: number;
  warnings: ValidationIssue[];
};

export type ZoneHydraulics = {
  zoneId: string;
  totalGpm: number;
  criticalHeadPressurePsi: number;
  velocityWarnings: ValidationIssue[];
};

export type MaterialLineItem = {
  catalogItemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  extendedCost: number;
  category?: string;
};

export type ManHoursBreakdown = {
  heads: number;
  zones: number;
  pipe: number;
  siteFeatures: number;
  landscape: number;
  total: number;
};

export type PricingProfileData = {
  pipePerFoot: number;
  headCost: number;
  nozzleCost: number;
  headBodyCost: number;
  valveCost: number;
  backflowCost: number;
  filterCost: number;
  prsCost: number;
  flowSensorCost: number;
  weatherSensorCost: number;
  controllerCost: number;
  sodPerSqFt: number;
  topsoilPerSqFt: number;
  laborHourlyRate: number;
  hoursPerHead: number;
  hoursPerZone: number;
  hoursPer100ftPipe: number;
  hoursSlopeModifier: number;
  hoursConcreteModifier: number;
  hoursRetainingWallModifier: number;
  jobMinimum: number;
  grossMarginPercent: number;
  premiumMaintenanceYearPrice: number;
  laborMultiplier: number;
  markup: number;
  targetProfitMarginPercent?: number;
  tax: number;
  wasteFactor: number;
  fittingAssumptions: Record<string, number>;
  pipePricingByDiameter: Record<string, number>;
  catalogCostOverrides: Record<string, number>;
};

export type CatalogItemData = {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  specs: Record<string, unknown>;
  nozzleChart?: {
    pressurePsi: number[];
    gpm: number[];
    radiusFeet?: number[];
    precipInPerHr?: number[];
    precipTriInPerHr?: number[];
    recommendedPressurePsi?: number;
  };
};

export const DEFAULT_PRICING_PROFILE: PricingProfileData = {
  pipePerFoot: 1.25,
  headCost: 8.5,
  nozzleCost: 3.5,
  headBodyCost: 5.0,
  valveCost: 45,
  backflowCost: 350,
  filterCost: 85,
  prsCost: 45,
  flowSensorCost: 120,
  weatherSensorCost: 180,
  controllerCost: 250,
  sodPerSqFt: 1.25,
  topsoilPerSqFt: 0.85,
  laborHourlyRate: 65,
  hoursPerHead: 0.25,
  hoursPerZone: 2.5,
  hoursPer100ftPipe: 1.5,
  hoursSlopeModifier: 0.15,
  hoursConcreteModifier: 0.25,
  hoursRetainingWallModifier: 0.2,
  jobMinimum: 2500,
  grossMarginPercent: 50,
  premiumMaintenanceYearPrice: 450,
  laborMultiplier: 1.5,
  markup: 0.25,
  targetProfitMarginPercent: 50,
  tax: 0.08,
  wasteFactor: 0.1,
  fittingAssumptions: { elbow: 2.5, tee: 3.5 },
  pipePricingByDiameter: {},
  catalogCostOverrides: {},
};

export const EMPTY_DESIGN_DOCUMENT: DesignDocument = {
  hydrozones: [],
  exclusionZones: [],
  siteFeatures: [],
  landscapeAreas: [],
  zones: [],
  heads: [],
  pipes: [],
  valves: [],
  equipment: [],
  metadata: { units: "imperial", quoteTier: "STANDARD" },
};
