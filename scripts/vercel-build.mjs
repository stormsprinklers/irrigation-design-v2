import { execSync } from "node:child_process";

function run(command, env = process.env) {
  execSync(command, { stdio: "inherit", env });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withConnectTimeout(url) {
  if (!url || url.includes("connect_timeout=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connect_timeout=30`;
}

function isPoolerUrl(url) {
  return /pooler|pgbouncer/i.test(url);
}

async function pushSchema(pushUrl, { maxAttempts = 4 } = {}) {
  const url = withConnectTimeout(pushUrl);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Running prisma db push (attempt ${attempt}/${maxAttempts})...`);
      run("npx prisma db push --skip-generate --accept-data-loss", {
        ...process.env,
        DATABASE_URL: url,
      });
      return;
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) break;
      const waitSec = attempt * 5;
      console.warn(
        `db push failed (attempt ${attempt}), retrying in ${waitSec}s (Neon may be waking from suspend)...`
      );
      await sleep(waitSec * 1000);
    }
  }

  throw lastError;
}

function resolveDbPushUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;

  if (directUrl) {
    return { url: directUrl, source: "DIRECT_URL" };
  }
  if (unpooledUrl) {
    return { url: unpooledUrl, source: "DATABASE_URL_UNPOOLED" };
  }
  if (databaseUrl) {
    return { url: databaseUrl, source: "DATABASE_URL" };
  }
  return null;
}

async function main() {
  const push = resolveDbPushUrl();

  if (push) {
    if (isPoolerUrl(push.url)) {
      console.warn(
        "Warning: db push is using a pooled connection URL. Neon requires a direct connection for schema changes."
      );
      console.warn(
        "Set DATABASE_URL_UNPOOLED (Vercel Neon integration) or DIRECT_URL for db push at build time."
      );
    } else {
      console.log(`Using ${push.source} for db push.`);
    }

    await pushSchema(push.url);
    run("npm run db:seed");
  } else {
    console.warn("Skipping prisma db push and seed: DATABASE_URL is not set.");
  }

  run("npm run build");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
