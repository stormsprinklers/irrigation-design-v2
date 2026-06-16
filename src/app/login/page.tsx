import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/20 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Irrigation design workspace for your organization
        </p>
        <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
