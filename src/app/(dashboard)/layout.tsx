import { auth, signOut } from "@/lib/auth";

import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <DashboardShell userName={session?.user?.name} signOutAction={signOutAction}>
      {children}
    </DashboardShell>
  );
}
