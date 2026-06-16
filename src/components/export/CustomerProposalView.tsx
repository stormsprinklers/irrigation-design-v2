import type { CustomerProposal } from "@/lib/domain/export";

type Props = {
  proposal: CustomerProposal;
  projectName: string;
};

export function CustomerProposalView({ proposal, projectName }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 print:py-6">
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">Irrigation Proposal</p>
        <h1 className="text-3xl font-bold">{projectName}</h1>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Scope</h2>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          {proposal.scopeNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Zones & run times</h2>
        <div className="mt-4 grid gap-3">
          {proposal.zones.map((zone) => (
            <div key={zone.name} className="rounded-lg border p-4">
              <div className="font-medium">{zone.name}</div>
              <div className="text-sm text-muted-foreground">
                Suggested runtime: {zone.runtimeMinutes} minutes
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Products</h2>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          {proposal.productSummary.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Watering guidance</h2>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          {proposal.wateringGuidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
