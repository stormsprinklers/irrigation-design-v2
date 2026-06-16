"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";

const registerSchema = z.object({
  organizationName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerAction(input: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
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

  try {
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
  } catch {
    return { success: false, error: "Could not create account. Please try again." };
  }

  const signInResult = await signIn("credentials", {
    email: normalizedEmail,
    password,
    redirect: false,
  });

  if (signInResult && typeof signInResult === "object" && "error" in signInResult && signInResult.error) {
    return {
      success: false,
      error: "Account created but sign-in failed. Please sign in with your new credentials.",
    };
  }

  return { success: true };
}

export async function loginAction(email: string, password: string) {
  return signIn("credentials", {
    email: email.trim().toLowerCase(),
    password,
    redirect: false,
  });
}
