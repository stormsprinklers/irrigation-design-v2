#!/usr/bin/env node
/**
 * Count approved training examples; exit 0 if count >= min (default 10).
 */
import { PrismaClient } from "@prisma/client";

const min = Number(process.env.ML_MIN_TRAINING_EXAMPLES ?? 10);
const prisma = new PrismaClient();

try {
  const ready = await prisma.trainingExample.count({
    where: { status: "APPROVED" },
  });

  console.log(JSON.stringify({ ready, min, sufficient: ready >= min }));
  process.exit(ready >= min ? 0 : 1);
} finally {
  await prisma.$disconnect();
}
