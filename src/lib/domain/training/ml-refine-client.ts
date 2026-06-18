import type {
  MlRefineDiagnostics,
  MlRefineRequestPayload,
  MlRefineResponsePayload,
} from "./ml-features";

const DEFAULT_TIMEOUT_MS = 5000;

export type MlRefineClientConfig = {
  baseUrl: string;
  apiKey?: string;
  modelVersion?: string;
  timeoutMs?: number;
};

export class MlRefineError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "MlRefineError";
  }
}

export function getMlRefineClientConfig(): MlRefineClientConfig | null {
  const baseUrl = process.env.ML_INFERENCE_URL?.trim();
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: process.env.ML_API_KEY,
    modelVersion: process.env.ML_MODEL_VERSION,
    timeoutMs: Number(process.env.ML_INFERENCE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

export function isPlacementMlEnabled(): boolean {
  return process.env.PLACEMENT_ML_ENABLED === "true";
}

export function isPlacementMlShadow(): boolean {
  return process.env.PLACEMENT_ML_SHADOW === "true";
}

export async function callMlRefineApi(
  request: MlRefineRequestPayload,
  config?: MlRefineClientConfig | null
): Promise<MlRefineResponsePayload> {
  const cfg = config ?? getMlRefineClientConfig();
  if (!cfg) {
    throw new MlRefineError("ML_INFERENCE_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cfg.apiKey) headers["X-ML-API-Key"] = cfg.apiKey;

    const body: MlRefineRequestPayload = {
      ...request,
      modelVersion: request.modelVersion ?? cfg.modelVersion,
    };

    const res = await fetch(`${cfg.baseUrl}/v1/refine`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new MlRefineError(
        `ML refine failed (${res.status}): ${text || res.statusText}`,
        res.status
      );
    }

    return (await res.json()) as MlRefineResponsePayload;
  } catch (err) {
    if (err instanceof MlRefineError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new MlRefineError("ML refine request timed out");
    }
    throw new MlRefineError(err instanceof Error ? err.message : "ML refine failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkMlServiceHealth(): Promise<{
  ok: boolean;
  modelLoaded?: boolean;
  modelVersion?: string;
}> {
  const cfg = getMlRefineClientConfig();
  if (!cfg) return { ok: false };
  try {
    const res = await fetch(`${cfg.baseUrl}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      status?: string;
      modelLoaded?: boolean;
      modelVersion?: string;
    };
    return {
      ok: data.status === "ok",
      modelLoaded: data.modelLoaded,
      modelVersion: data.modelVersion,
    };
  } catch {
    return { ok: false };
  }
}

export type { MlRefineDiagnostics };
