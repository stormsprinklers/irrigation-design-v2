#!/usr/bin/env node
/**
 * Export approved training examples to JSONL for ML pipeline.
 *
 * Usage:
 *   node scripts/export-training-jsonl.mjs [options]
 *
 * Options:
 *   --output, -o <path>       Output JSONL path (default: training-export.jsonl)
 *   --manifest <path>         Write split manifest JSON (default: training-split-manifest.json)
 *   --format full|slim        Export format (default: slim)
 *   --status APPROVED|...     Row status filter (default: APPROVED)
 *   --valid-for-training-only Only rows with validForTraining=true
 *   --algorithm-version <v>   Pin to a placement algorithm version
 *   --since <iso-date>        Only rows created on/after date
 *   --limit <n>               Max rows (default: unlimited)
 *   --organization-id <id>    Filter by org (default: all orgs)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const opts = {
    output: "training-export.jsonl",
    manifest: "training-split-manifest.json",
    format: "slim",
    status: "APPROVED",
    validForTrainingOnly: false,
    algorithmVersion: null,
    since: null,
    limit: null,
    organizationId: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--output":
      case "-o":
        opts.output = next;
        i++;
        break;
      case "--manifest":
        opts.manifest = next;
        i++;
        break;
      case "--format":
        opts.format = next;
        i++;
        break;
      case "--status":
        opts.status = next;
        i++;
        break;
      case "--valid-for-training-only":
        opts.validForTrainingOnly = true;
        break;
      case "--algorithm-version":
        opts.algorithmVersion = next;
        i++;
        break;
      case "--since":
        opts.since = next;
        i++;
        break;
      case "--limit":
        opts.limit = Number(next);
        i++;
        break;
      case "--organization-id":
        opts.organizationId = next;
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`See script header for usage.`);
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }
  return opts;
}

const TRAINING_ML_EXPORT_SCHEMA_VERSION = 2;
const SHAPE_CLASSES = [
  "rectangle",
  "l_shape",
  "narrow_strip",
  "concave",
  "front_yard",
  "back_yard",
  "irregular",
];

function seedSplitBucket(seed) {
  const bucket = Math.abs(seed) % 100;
  if (bucket < 70) return "train";
  if (bucket < 85) return "val";
  return "test";
}

function isValidForTraining(payload) {
  if (!payload || typeof payload !== "object") return false;
  return payload.validForTraining !== false;
}

function toSlimRecord(row, payload) {
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
    validForTraining: isValidForTraining(payload),
    distributionCurveVersion: payload.distributionCurveVersion,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

function buildManifest(records, opts) {
  const splits = { train: [], val: [], test: [] };
  const byShape = Object.fromEntries(
    SHAPE_CLASSES.map((s) => [s, { train: 0, val: 0, test: 0 }])
  );

  for (const record of records) {
    const split = seedSplitBucket(record.seed);
    splits[split].push(record.id);
    byShape[record.shapeClass][split] += 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    algorithmVersionFilter: opts.algorithmVersion,
    validForTrainingOnly: opts.validForTrainingOnly,
    ratios: { train: 0.7, val: 0.15, test: 0.15 },
    splits,
    byShape,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.trainingExample.findMany({
      where: {
        status: opts.status,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
        ...(opts.since ? { createdAt: { gte: new Date(opts.since) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      ...(opts.limit ? { take: opts.limit } : {}),
    });

    const slimRecords = [];
    const lines = [];

    for (const row of rows) {
      const payload = row.payload;
      const validForTraining = isValidForTraining(payload);

      if (opts.validForTrainingOnly && !validForTraining) continue;
      if (opts.algorithmVersion && row.algorithmVersion !== opts.algorithmVersion) continue;

      if (opts.format === "slim") {
        const slim = toSlimRecord(row, payload);
        slimRecords.push(slim);
        lines.push(JSON.stringify(slim));
      } else {
        lines.push(
          JSON.stringify({
            schemaVersion: 1,
            id: row.id,
            organizationId: row.organizationId,
            createdById: row.createdById,
            status: row.status,
            algorithmVersion: row.algorithmVersion,
            distributionCurveVersion: payload.distributionCurveVersion,
            validForTraining,
            needsRescore: payload.needsRescore ?? false,
            createdAt: row.createdAt.toISOString(),
            approvedAt: row.approvedAt?.toISOString() ?? null,
            payload,
          })
        );
        slimRecords.push(toSlimRecord(row, payload));
      }
    }

    const outputPath = resolve(process.cwd(), opts.output);
    writeFileSync(outputPath, lines.join("\n") + (lines.length ? "\n" : ""));
    console.log(`Wrote ${lines.length} records to ${outputPath}`);

    if (opts.manifest) {
      const manifestPath = resolve(process.cwd(), opts.manifest);
      const manifest = buildManifest(slimRecords, opts);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      console.log(`Wrote split manifest to ${manifestPath}`);
      console.log(
        `Splits: train=${manifest.splits.train.length} val=${manifest.splits.val.length} test=${manifest.splits.test.length}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
