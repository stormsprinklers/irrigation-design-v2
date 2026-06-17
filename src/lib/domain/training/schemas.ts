import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const trainingHeadSnapshotSchema = z.object({
  id: z.string(),
  positionFt: pointSchema,
  radiusFeet: z.number(),
  arcDegrees: z.number(),
  rotationDegrees: z.number(),
  wedgeStartDeg: z.number(),
  wedgeEndDeg: z.number(),
  catalogItemId: z.string(),
  headBodyId: z.string().optional(),
  nozzleModel: z.string().optional(),
  gpm: z.number().optional(),
  precipInPerHr: z.number().optional(),
});

export const precipGridSchema = z.object({
  originFt: pointSchema,
  stepFt: z.number(),
  cols: z.number().int(),
  rows: z.number().int(),
  values: z.array(z.number()),
});

export const uniformityScoresSchema = z.object({
  coveragePercent: z.number(),
  avgPrecip: z.number(),
  minPrecip: z.number(),
  maxPrecip: z.number(),
  duLq: z.number(),
  drySpotCount: z.number().int(),
  wetSpotCount: z.number().int(),
  headToHeadViolations: z.number().int(),
  oversprayEstimatePercent: z.number(),
  headCount: z.number().int(),
  sampleCount: z.number().int(),
});

export const trainingExamplePayloadSchema = z.object({
  algorithmVersion: z.string(),
  polygonVerticesFt: z.array(pointSchema).min(3),
  polygonMetadata: z.object({
    shapeClass: z.enum([
      "rectangle",
      "l_shape",
      "narrow_strip",
      "concave",
      "front_yard",
      "back_yard",
      "irregular",
    ]),
    seed: z.number().int(),
    widthFt: z.number(),
    heightFt: z.number(),
    areaSqFt: z.number(),
    vertexCount: z.number().int(),
    hasExclusions: z.boolean(),
  }),
  exclusionZonesFt: z.array(z.any()).optional(),
  placementContext: z.object({
    headPreference: z.enum(["SPRAY", "ROTOR", "MP_ROTATOR", "DRIP"]),
    pressurePsi: z.number(),
    pattern: z.enum(["square", "triangular"]).optional(),
    nozzleModel: z.string().optional(),
    catalogItemIds: z.array(z.string()),
  }),
  algorithmOutput: z.array(trainingHeadSnapshotSchema),
  approvedOutput: z.array(trainingHeadSnapshotSchema),
  originalScores: uniformityScoresSchema,
  approvedScores: uniformityScoresSchema,
  originalPrecipGrid: precipGridSchema,
  approvedPrecipGrid: precipGridSchema,
  editLog: z.any().optional(),
  improvementScore: z.number(),
});

export const trainingExampleApprovalInputSchema = trainingExamplePayloadSchema.omit({
  algorithmVersion: true,
});

export const approveTrainingExampleSchema = z.object({
  payload: trainingExampleApprovalInputSchema,
});

export const exportTrainingExamplesSchema = z.object({
  status: z.enum(["APPROVED", "IN_PROGRESS", "DISCARDED"]).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});
