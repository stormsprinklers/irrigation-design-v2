#!/usr/bin/env node
/**
 * Register a promoted model version in PlacementModelVersion.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const metricsPath = process.argv[2];
if (!metricsPath) {
  console.error("Usage: node scripts/ml-register-model.mjs <eval_metrics.json>");
  process.exit(1);
}

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

/** Each CI run gets a unique registry row; ML_MODEL_VERSION is the family prefix. */
function resolveRegistryVersion() {
  const base = (process.env.ML_MODEL_VERSION ?? "v1").trim() || "v1";
  const suffix =
    process.env.GITHUB_RUN_NUMBER ??
    process.env.GITHUB_RUN_ID ??
    new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `${base}-${suffix}`;
}

const version = resolveRegistryVersion();
const algorithmVersion = process.env.PLACEMENT_ALGORITHM_VERSION ?? "placement@ci";
const checkpointUrl = process.env.ML_INFERENCE_URL
  ? `${process.env.ML_INFERENCE_URL.replace(/\/$/, "")}/admin/upload-checkpoint`
  : "railway-volume";

const prisma = new PrismaClient();
try {
  await prisma.placementModelVersion.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const row = await prisma.placementModelVersion.create({
    data: {
      version,
      checkpointUrl,
      algorithmVersion,
      metricsJson: metrics,
      promotionPassed: true,
      promotionNotes: null,
      isActive: true,
    },
  });

  console.log(JSON.stringify({ id: row.id, version: row.version, isActive: true }));
} finally {
  await prisma.$disconnect();
}
