import type { NextAuthConfig } from "next-auth";

const authSecret =
  process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-only-secret-change-me";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  secret: authSecret,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.organizationId = user.organizationId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.organizationId = token.organizationId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
