"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, FolderKanban, Settings, Brain, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardAppearance } from "@/components/layout/DashboardAppearance";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Props = {
  userName?: string | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
};

const navLinks = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/training", label: "AI Training", icon: Brain },
  { href: "/settings/pricing", label: "Pricing", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function DashboardShell({ userName, signOutAction, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="border-b p-4">
          <Link href="/" className="font-semibold text-primary">
            Irrigation Design
          </Link>
        </div>
        <div className="flex-1 p-3">
          <NavLinks />
        </div>
        <DashboardAppearance />
        <div className="border-t p-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Droplets className="h-4 w-4" />
            {userName}
          </div>
          <form action={signOutAction} className="mt-3">
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <Link href="/" className="font-semibold text-primary">
            Irrigation Design
          </Link>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100vw,18rem)] p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-1 flex-col p-3">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <div className="mt-auto space-y-3 border-t pt-4">
                  <DashboardAppearance />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Droplets className="h-4 w-4" />
                    {userName}
                  </div>
                  <form action={signOutAction}>
                    <Button variant="outline" size="sm" type="submit" className="w-full">
                      Sign out
                    </Button>
                  </form>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
