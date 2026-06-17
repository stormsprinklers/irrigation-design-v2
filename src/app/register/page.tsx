import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell>
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your company workspace to start designing irrigation systems
        </p>
        <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded bg-muted" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
