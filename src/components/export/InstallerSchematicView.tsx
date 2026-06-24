import type { InstallerSchematic } from "@/lib/domain/export";
import type { DesignDocument } from "@/lib/domain/types";
import { ShareDesignSection } from "./ShareDesignSection";

type Props = {
  schematic: InstallerSchematic;
  projectName: string;
  designDocument?: DesignDocument;
  designImageUrl?: string;
};

export function InstallerSchematicView({
  schematic,
  projectName,
  designDocument,
  designImageUrl,
}: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 print:py-6">
      <header className="border-b pb-6">
        <p className="text-sm text-muted-foreground">Installer Schematic</p>
        <h1 className="text-3xl font-bold">{projectName}</h1>
      </header>

      {designDocument && (
        <ShareDesignSection document={designDocument} imageUrl={designImageUrl} />
      )}

      {schematic.zones.map((zone) => (
        <section key={zone.name} className="mt-8">
          <h2 className="text-lg font-semibold">
            {zone.name} — {zone.totalGpm} GPM · {zone.criticalPressurePsi} PSI at critical head
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <h3 className="text-sm font-medium">Heads</h3>
              <table className="mt-2 w-full min-w-[280px] text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th>Model</th>
                    <th>Arc</th>
                    <th>Radius</th>
                    <th>GPM</th>
                  </tr>
                </thead>
                <tbody>
                  {zone.heads.map((h, i) => (
                    <tr key={i}>
                      <td>{h.model}</td>
                      <td>{h.arc}°</td>
                      <td>{h.radius} ft</td>
                      <td>{h.gpm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <h3 className="text-sm font-medium">Pipe</h3>
              <table className="mt-2 w-full min-w-[280px] text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th>Material</th>
                    <th>Size</th>
                    <th>Length</th>
                    <th>Friction</th>
                  </tr>
                </thead>
                <tbody>
                  {zone.pipes.map((p, i) => (
                    <tr key={i}>
                      <td>{p.material}</td>
                      <td>{p.diameter}&quot;</td>
                      <td>{p.length.toFixed(1)} ft</td>
                      <td>{p.frictionPsi} PSI</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Material list</h2>
        <div className="overflow-x-auto">
          <table className="mt-4 w-full min-w-[280px] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>Item</th>
              <th>Qty</th>
              <th className="text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {schematic.materialList.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td className="text-right">${item.extendedCost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="mt-4 text-right font-semibold">Total: ${schematic.totals.totalWithTax.toFixed(2)}</p>
      </section>

      {schematic.validationIssues.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Validation notes</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {schematic.validationIssues.map((issue, i) => (
              <li key={i}>
                {issue.code}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
