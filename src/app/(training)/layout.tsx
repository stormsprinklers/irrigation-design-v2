import { auth, signOut } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <DashboardShell
      userName={session?.user?.name}
      signOutAction={signOutAction}
      mainClassName="flex flex-col overflow-hidden"
    >
      {children}
    </DashboardShell>
  );
}
