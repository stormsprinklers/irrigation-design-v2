"use server";

import { signIn } from "@/lib/auth";

export async function loginAction(email: string, password: string) {
  return signIn("credentials", { email, password, redirect: false });
}
