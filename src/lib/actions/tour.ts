"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type TourStatus = {
  completedAt: Date | null;
  autoShow: boolean;
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getTourStatus(): Promise<TourStatus> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { designTourCompletedAt: true, designTourAutoShow: true },
  });
  if (!user) throw new Error("User not found");
  return {
    completedAt: user.designTourCompletedAt,
    autoShow: user.designTourAutoShow,
  };
}

export async function completeTour(autoShow: boolean) {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: {
      designTourCompletedAt: new Date(),
      designTourAutoShow: autoShow,
    },
  });
  revalidatePath("/projects", "layout");
}

export async function getTrainingTourStatus(): Promise<TourStatus> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trainingTourCompletedAt: true, trainingTourAutoShow: true },
  });
  if (!user) throw new Error("User not found");
  return {
    completedAt: user.trainingTourCompletedAt,
    autoShow: user.trainingTourAutoShow,
  };
}

export async function completeTrainingTour(autoShow: boolean) {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: {
      trainingTourCompletedAt: new Date(),
      trainingTourAutoShow: autoShow,
    },
  });
  revalidatePath("/training");
}
