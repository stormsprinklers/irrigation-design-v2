import { prisma } from "../src/lib/prisma";
import catalogItems from "./seed-data/catalog-items.json";
import bcrypt from "bcryptjs";

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {},
    create: {
      id: "seed-org",
      name: "Demo Irrigation Co",
    },
  });

  const passwordHash = await bcrypt.hash("designer123", 10);
  await prisma.user.upsert({
    where: { email: "designer@demo.com" },
    update: {},
    create: {
      email: "designer@demo.com",
      name: "Demo Designer",
      passwordHash,
      role: "DESIGNER",
      organizationId: org.id,
    },
  });

  await prisma.pricingProfile.upsert({
    where: { id: "seed-pricing" },
    update: {},
    create: {
      id: "seed-pricing",
      organizationId: org.id,
      name: "Default",
      isDefault: true,
      pipePerFoot: 1.25,
      headCost: 8.5,
      valveCost: 45,
      laborMultiplier: 1.5,
      markup: 0.25,
      tax: 0.08,
      wasteFactor: 0.1,
      fittingAssumptions: { elbow: 2.5, tee: 3.5 },
    },
  });

  for (const item of catalogItems) {
    await prisma.catalogItem.upsert({
      where: { id: item.id },
      update: {
        category: item.category as never,
        manufacturer: item.manufacturer,
        model: item.model,
        specs: item.specs,
        nozzleChart: item.nozzleChart ?? undefined,
        isSystem: true,
      },
      create: {
        id: item.id,
        category: item.category as never,
        manufacturer: item.manufacturer,
        model: item.model,
        specs: item.specs,
        nozzleChart: item.nozzleChart ?? undefined,
        isSystem: true,
      },
    });
  }

  console.log("Seed complete. Login: designer@demo.com / designer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
