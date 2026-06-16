import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      organizationId: string;
      role: string;
    };
  }

  interface User {
    organizationId: string;
    role: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    role: string;
  }
}

const authSecret =
  process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-only-secret-change-me";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: authSecret,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
        };
      },
    }),
  ],
});
