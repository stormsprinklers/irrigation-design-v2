#!/usr/bin/env node
/**
 * Upload a trained checkpoint to the Railway ML service and hot-reload.
 *
 * Usage:
 *   ML_INFERENCE_URL=https://... ML_API_KEY=... node scripts/ml-deploy-checkpoint.mjs ml/checkpoints/best.pt
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const checkpointPath = process.argv[2] ?? "ml/checkpoints/best.pt";
const baseUrl = process.env.ML_INFERENCE_URL?.replace(/\/$/, "");
const apiKey = process.env.ML_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("ML_INFERENCE_URL and ML_API_KEY are required");
  process.exit(1);
}

const bytes = readFileSync(checkpointPath);
const form = new FormData();
form.append("file", new Blob([bytes]), basename(checkpointPath));

const res = await fetch(`${baseUrl}/admin/upload-checkpoint`, {
  method: "POST",
  headers: { "X-ML-API-Key": apiKey },
  body: form,
});

const text = await res.text();
if (!res.ok) {
  console.error(`Upload failed (${res.status}): ${text}`);
  process.exit(1);
}

console.log(text);

const health = await fetch(`${baseUrl}/health`);
console.log("Health:", await health.text());
