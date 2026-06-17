import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-secondary/30">
      <header className="safe-top mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
        <div className="text-xl font-semibold text-primary">Irrigation Design</div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ThemeToggle compact />
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Draw the property. Design the system. Share with confidence.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Professional irrigation design with editable zones, pipe sizing, material costs, and
          customer-ready schematics. Automation proposes — you refine and explain.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Create free account</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            { title: "Scale & layout", desc: "Import plat maps, calibrate scale, draw hydrozones" },
            { title: "Hydraulics", desc: "GPM, pressure, friction loss, and zone isolation" },
            { title: "Customer exports", desc: "Clean proposals and installer schematics" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
