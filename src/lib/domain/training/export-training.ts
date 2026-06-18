import type {
  TrainingExamplePayload,
  TrainingShapeClass,
} from "./types";
import { TRAINING_EXPORT_SCHEMA_VERSION } from "./types";

export const TRAINING_ML_EXPORT_SCHEMA_VERSION = 2;

export type TrainingExportRow = {
  id: string;
  organizationId: string;
  createdById: string;
  status: string;
  algorithmVersion: string;
  distributionCurveVersion?: string;
  validForTraining: boolean;
  needsRescore: boolean;
  createdAt: string;
  approvedAt: string | null;
  payload: TrainingExamplePayload;
};

export type TrainingMlSlimRecord = {
  schemaVersion: typeof TRAINING_ML_EXPORT_SCHEMA_VERSION;
  id: string;
  algorithmVersion: string;
  shapeClass: TrainingShapeClass;
  seed: number;
  polygonVerticesFt: TrainingExamplePayload["polygonVerticesFt"];
  polygonMetadata: TrainingExamplePayload["polygonMetadata"];
  exclusionZonesFt: TrainingExamplePayload["exclusionZonesFt"];
  placementContext: TrainingExamplePayload["placementContext"];
  algorithmOutput: TrainingExamplePayload["algorithmOutput"];
  approvedOutput: TrainingExamplePayload["approvedOutput"];
  editLog?: TrainingExamplePayload["editLog"];
  improvementScore: number;
  validForTraining: boolean;
  distributionCurveVersion?: string;
  approvedAt: string | null;
};

export type DatasetSplit = "train" | "val" | "test";

export type TrainingSplitManifest = {
  schemaVersion: 1;
  generatedAt: string;
  algorithmVersionFilter: string | null;
  validForTrainingOnly: boolean;
  ratios: { train: number; val: number; test: number };
  splits: Record<DatasetSplit, string[]>;
  byShape: Record<TrainingShapeClass, Record<DatasetSplit, number>>;
};

export type ExportTrainingOptions = {
  status?: "APPROVED" | "IN_PROGRESS" | "DISCARDED";
  limit?: number;
  validForTrainingOnly?: boolean;
  algorithmVersion?: string;
  since?: Date;
  format?: "full" | "slim";
};

function toSlimRecord(row: TrainingExportRow): TrainingMlSlimRecord {
  const { payload } = row;
  return {
    schemaVersion: TRAINING_ML_EXPORT_SCHEMA_VERSION,
    id: row.id,
    algorithmVersion: row.algorithmVersion,
    shapeClass: payload.polygonMetadata.shapeClass,
    seed: payload.polygonMetadata.seed,
    polygonVerticesFt: payload.polygonVerticesFt,
    polygonMetadata: payload.polygonMetadata,
    exclusionZonesFt: payload.exclusionZonesFt ?? [],
    placementContext: payload.placementContext,
    algorithmOutput: payload.algorithmOutput,
    approvedOutput: payload.approvedOutput,
    editLog: payload.editLog,
    improvementScore: payload.improvementScore,
    validForTraining: row.validForTraining,
    distributionCurveVersion: row.distributionCurveVersion,
    approvedAt: row.approvedAt,
  };
}

export function rowPassesExportFilters(
  row: TrainingExportRow,
  options: ExportTrainingOptions
): boolean {
  if (options.validForTrainingOnly && !row.validForTraining) return false;
  if (
    options.algorithmVersion &&
    row.algorithmVersion !== options.algorithmVersion
  ) {
    return false;
  }
  if (options.since && new Date(row.createdAt) < options.since) return false;
  return true;
}

export function serializeTrainingExportLine(
  row: TrainingExportRow,
  format: "full" | "slim" = "full"
): string {
  if (format === "slim") {
    return JSON.stringify(toSlimRecord(row));
  }
  return JSON.stringify({
    schemaVersion: TRAINING_EXPORT_SCHEMA_VERSION,
    id: row.id,
    organizationId: row.organizationId,
    createdById: row.createdById,
    status: row.status,
    algorithmVersion: row.algorithmVersion,
    distributionCurveVersion: row.distributionCurveVersion,
    validForTraining: row.validForTraining,
    needsRescore: row.needsRescore,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    payload: row.payload,
  });
}

/** Deterministic split from seed within each shape class (70/15/15). */
export function seedSplitBucket(seed: number): DatasetSplit {
  const bucket = Math.abs(seed) % 100;
  if (bucket < 70) return "train";
  if (bucket < 85) return "val";
  return "test";
}

export function buildSplitManifest(
  records: TrainingMlSlimRecord[],
  options: {
    algorithmVersionFilter?: string | null;
    validForTrainingOnly?: boolean;
  } = {}
): TrainingSplitManifest {
  const splits: TrainingSplitManifest["splits"] = {
    train: [],
    val: [],
    test: [],
  };

  const byShape = Object.fromEntries(
    (["rectangle", "l_shape", "narrow_strip", "concave", "front_yard", "back_yard", "irregular"] as const).map(
      (shape) => [
        shape,
        { train: 0, val: 0, test: 0 },
      ]
    )
  ) as TrainingSplitManifest["byShape"];

  for (const record of records) {
    const split = seedSplitBucket(record.seed);
    splits[split].push(record.id);
    byShape[record.shapeClass][split] += 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    algorithmVersionFilter: options.algorithmVersionFilter ?? null,
    validForTrainingOnly: options.validForTrainingOnly ?? false,
    ratios: { train: 0.7, val: 0.15, test: 0.15 },
    splits,
    byShape,
  };
}

export function rowsToJsonl(
  rows: TrainingExportRow[],
  options: ExportTrainingOptions = {}
): string {
  const format = options.format ?? "full";
  return rows
    .filter((row) => rowPassesExportFilters(row, options))
    .map((row) => serializeTrainingExportLine(row, format))
    .join("\n");
}

export function rowsToSlimRecords(
  rows: TrainingExportRow[],
  options: ExportTrainingOptions = {}
): TrainingMlSlimRecord[] {
  return rows
    .filter((row) => rowPassesExportFilters(row, options))
    .map(toSlimRecord);
}
