import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const propertyImageSchema = z.object({
  blobPath: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const scaleCalibrationSchema = z.object({
  pointA: pointSchema,
  pointB: pointSchema,
  realWorldFeet: z.number().positive(),
});

export const waterSourceSchema = z.object({
  staticPressurePsi: z.number().positive(),
  availableGpm: z.number().positive(),
  meterSizeInches: z.number().positive(),
  backflowType: z.string(),
  poc: pointSchema,
  mainlineMaterial: z.string(),
  mainlineSizeInches: z.number().positive(),
  isSecondaryWater: z.boolean(),
});

export const hydrozoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  vertices: z.array(pointSchema).min(3),
  zoneId: z.string().optional(),
  hydrozoneType: z.enum(["TURF", "SHRUBS", "TREES", "DRIP", "GARDEN"]),
  sunExposure: z.enum(["FULL_SUN", "PART_SHADE", "FULL_SHADE"]),
  slopePercent: z.number().min(0),
  soilType: z.enum(["CLAY", "LOAM", "SAND", "ROCKY"]),
  waterPriority: z.number().int().min(1).max(5),
  headPreference: z.enum(["SPRAY", "ROTOR", "MP_ROTATOR", "DRIP"]),
});

export const exclusionZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  vertices: z.array(pointSchema).min(3),
  exclusionType: z.enum([
    "BUILDING",
    "DRIVEWAY",
    "PATIO",
    "FENCE",
    "TREE",
    "SLOPE",
    "NO_OVERSPRAY",
  ]),
});

export const irrigationZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  valveId: z.string().optional(),
  hydrozoneIds: z.array(z.string()),
  runtimeMinutes: z.number().optional(),
});

export const sprinklerHeadSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  hydrozoneId: z.string().optional(),
  position: pointSchema,
  catalogItemId: z.string(),
  headBodyId: z.string().optional(),
  arcDegrees: z.number().min(0).max(360),
  radiusFeet: z.number().positive(),
  rotationDegrees: z.number(),
  gpm: z.number().optional(),
  precipInPerHr: z.number().optional(),
  locked: z.boolean(),
  fieldNotes: z.string().optional(),
  installedAt: z.string().optional(),
});

export const pipeSegmentSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  catalogItemId: z.string(),
  points: z.array(pointSchema).min(2),
  diameterInches: z.number().positive(),
  material: z.string(),
  lengthFeet: z.number().optional(),
  frictionLossPsi: z.number().optional(),
  fieldNotes: z.string().optional(),
});

export const valveSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  position: pointSchema,
  catalogItemId: z.string(),
});

export const designDocumentSchema = z.object({
  propertyImage: propertyImageSchema.optional(),
  scale: scaleCalibrationSchema.optional(),
  waterSource: waterSourceSchema.optional(),
  hydrozones: z.array(hydrozoneSchema),
  exclusionZones: z.array(exclusionZoneSchema),
  zones: z.array(irrigationZoneSchema),
  heads: z.array(sprinklerHeadSchema),
  pipes: z.array(pipeSegmentSchema),
  valves: z.array(valveSchema),
  metadata: z.object({
    units: z.literal("imperial"),
    lastValidatedAt: z.string().optional(),
  }),
});

export type DesignDocumentInput = z.infer<typeof designDocumentSchema>;
