#!/usr/bin/env node
/**
 * Count approved training-ready examples; exit 0 if count >= min (default 10).
 */
import { PrismaClient } from "@prisma/client";

const min = Number(process.env.ML_MIN_TRAINING_EXAMPLES ?? 10);
const prisma = new PrismaClient();

try {
  const rows = await prisma.trainingExample.findMany({
    where: { status: "APPROVED" },
    select: { payload: true },
  });

  let ready = 0;
  for (const row of rows) {
    const payload = row.payload;
    if (payload && typeof payload === "object" && payload.validForTraining !== false) {
      ready++;
    }
  }

  console.log(JSON.stringify({ ready, min, sufficient: ready >= min }));
  process.exit(ready >= min ? 0 : 1);
} finally {
  await prisma.$disconnect();
}
