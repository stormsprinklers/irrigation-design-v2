/**
 * Optionally trigger GitHub Actions ml-retrain workflow after new training examples.
 */
const RETRAIN_BATCH_SIZE = Number(process.env.ML_RETRAIN_BATCH_SIZE ?? 25);

export async function maybeTriggerMlRetrain(approvedCount: number): Promise<void> {
  if (process.env.ML_RETRAIN_ON_APPROVE !== "true") return;

  const token = process.env.GITHUB_RETRAIN_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;

  if (approvedCount < RETRAIN_BATCH_SIZE) return;
  if (approvedCount % RETRAIN_BATCH_SIZE !== 0) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "ml-retrain" }),
    });
    if (!res.ok) {
      console.error("ML retrain dispatch failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("ML retrain dispatch error", err);
  }
}
