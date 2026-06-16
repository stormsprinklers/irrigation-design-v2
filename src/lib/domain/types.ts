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
export type SunExposure = "FULL_SUN" | "PART_SHADE" | "FULL_SHADE";
export type SoilType = "CLAY" | "LOAM" | "SAND" | "ROCKY";
export type HeadFamily = "SPRAY" | "ROTOR" | "MP_ROTATOR" | "DRIP";
export type WarningCode =
  | "COVERAGE_GAP"
  | "HEAD_SPACING"
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
};

export type ExclusionZone = {
  id: string;
  name: string;
  vertices: Point[];
  exclusionType: ExclusionType;
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
};

export type DesignDocument = {
  propertyImage?: PropertyImage;
  scale?: ScaleCalibration;
  waterSource?: WaterSourceConfig;
  hydrozones: HydrozonePolygon[];
  exclusionZones: ExclusionZone[];
  zones: IrrigationZone[];
  heads: SprinklerHead[];
  pipes: PipeSegment[];
  valves: Valve[];
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
};

export type PricingProfileData = {
  pipePerFoot: number;
  headCost: number;
  valveCost: number;
  laborMultiplier: number;
  markup: number;
  tax: number;
  wasteFactor: number;
  fittingAssumptions: Record<string, number>;
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

export const EMPTY_DESIGN_DOCUMENT: DesignDocument = {
  hydrozones: [],
  exclusionZones: [],
  zones: [],
  heads: [],
  pipes: [],
  valves: [],
  metadata: { units: "imperial" },
};
