import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your irrigation design workspace
        </p>
        <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
