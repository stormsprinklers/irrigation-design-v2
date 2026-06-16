"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  organizationName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function registerErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "An account with this email already exists.";
    }
    if (error.code === "P1001" || error.code === "P1002") {
      return "Database is not reachable. Please try again in a few minutes.";
    }
    if (error.code === "P2021") {
      return "Database is not set up yet. Redeploy the app or contact support.";
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database connection failed. Check that DATABASE_URL is configured.";
  }

  return "Could not create account. Please try again.";
}

export async function registerAction(input: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        Object.values(fieldErrors).flat()[0] ?? "Please check your information and try again.";
      return { success: false, error: firstError, fieldErrors };
    }

    const { organizationName, name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName },
      });

      await tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          role: "ADMIN",
          organizationId: organization.id,
        },
      });

      await tx.pricingProfile.create({
        data: {
          organizationId: organization.id,
          name: "Default",
          isDefault: true,
          fittingAssumptions: { elbow: 2.5, tee: 3.5 },
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("[registerAction]", error);
    return { success: false, error: registerErrorMessage(error) };
  }
}

export async function loginAction(email: string, password: string) {
  const { signIn } = await import("@/lib/auth");
  try {
    return await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
  } catch (error) {
    console.error("[loginAction]", error);
    return { error: "CredentialsSignin" };
  }
}
