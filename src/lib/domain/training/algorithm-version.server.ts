import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedVersion: string | null = null;

export function getPlacementAlgorithmVersion(): string {
  if (cachedVersion) return cachedVersion;

  let pkgVersion = "0.0.0";
  try {
    const pkgPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    pkgVersion = pkg.version ?? pkgVersion;
  } catch {
    // fallback in edge environments
  }

  const sha = process.env.PLACEMENT_ALGORITHM_SHA;
  cachedVersion = sha ? `placement@${pkgVersion}+${sha.slice(0, 7)}` : `placement@${pkgVersion}`;
  return cachedVersion;
}
