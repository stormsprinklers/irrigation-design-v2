import { execSync } from "node:child_process";

function run(command, env = process.env) {
  execSync(command, { stdio: "inherit", env });
}

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;
const pushUrl = directUrl || databaseUrl;

if (pushUrl) {
  console.log(`Running prisma db push (${directUrl ? "DIRECT_URL" : "DATABASE_URL"})...`);
  run("npx prisma db push --skip-generate --accept-data-loss", {
    ...process.env,
    DATABASE_URL: pushUrl,
  });
  run("npm run db:seed");
} else {
  console.warn("Skipping prisma db push and seed: DATABASE_URL is not set.");
}

run("npm run build");
