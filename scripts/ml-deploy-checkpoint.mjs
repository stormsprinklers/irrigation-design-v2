#!/usr/bin/env node
/**
 * Upload a trained checkpoint to the Railway ML service and hot-reload.
 *
 * Usage:
 *   ML_INFERENCE_URL=https://your-service.up.railway.app ML_API_KEY=... node scripts/ml-deploy-checkpoint.mjs ml/checkpoints/best.pt
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

function normalizeMlBaseUrl(raw) {
  if (!raw) return null;
  let url = raw.trim().replace(/^["']|["']$/g, "");
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const checkpointPath = process.argv[2] ?? "ml/checkpoints/best.pt";
const baseUrl = normalizeMlBaseUrl(process.env.ML_INFERENCE_URL);
const apiKey = process.env.ML_API_KEY?.trim();

if (!baseUrl || !apiKey) {
  console.error("ML_INFERENCE_URL and ML_API_KEY are required.");
  if (process.env.ML_INFERENCE_URL?.trim() && !baseUrl) {
    console.error(
      "ML_INFERENCE_URL is set but invalid. Use the public Railway URL, e.g."
    );
    console.error("  https://your-service.up.railway.app");
    console.error("No trailing slash, no quotes, and include https:// (or omit it — we add it).");
  }
  process.exit(1);
}

const bytes = readFileSync(checkpointPath);
const form = new FormData();
form.append("file", new Blob([bytes]), basename(checkpointPath));

const uploadUrl = `${baseUrl}/admin/upload-checkpoint`;
console.log(`Uploading checkpoint to ${baseUrl}/admin/upload-checkpoint`);

const res = await fetch(uploadUrl, {
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
