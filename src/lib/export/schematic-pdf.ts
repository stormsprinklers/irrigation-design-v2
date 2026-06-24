import type { InstallerSchematic } from "@/lib/domain/export";
import { createTextPdf } from "@/lib/export/minimal-pdf";

export function buildInstallerSchematicPdf(
  projectName: string,
  schematic: InstallerSchematic
): Buffer {
  const lines: string[] = [
    `INSTALLER SCHEMATIC — ${projectName}`,
    "",
    `Zones: ${schematic.zones.length}  |  Sell: $${schematic.totals.sellPrice.toFixed(2)}  |  Hours: ${schematic.totals.manHours.total}`,
    "",
  ];

  for (const zone of schematic.zones) {
    lines.push(`--- ${zone.name} ---`);
    lines.push(`GPM: ${zone.totalGpm.toFixed(2)}  |  Critical PSI: ${zone.criticalPressurePsi.toFixed(1)}`);
    lines.push(`Heads: ${zone.heads.length}`);
    for (const head of zone.heads.slice(0, 12)) {
      lines.push(`  ${head.model}  arc ${head.arc}°  r ${head.radius}ft  ${head.gpm.toFixed(2)} gpm`);
    }
    if (zone.heads.length > 12) lines.push(`  ... +${zone.heads.length - 12} more`);
    lines.push(`Pipe runs: ${zone.pipes.length}`);
    lines.push("");
  }

  lines.push("--- MATERIALS ---");
  for (const item of schematic.materialList.slice(0, 40)) {
    lines.push(`${item.quantity} x ${item.description}`);
  }
  if (schematic.materialList.length > 40) {
    lines.push(`... +${schematic.materialList.length - 40} more lines`);
  }

  if (schematic.validationIssues.length) {
    lines.push("", "--- VALIDATION ---");
    for (const issue of schematic.validationIssues.slice(0, 15)) {
      lines.push(`${issue.severity}: ${issue.message}`);
    }
  }

  return createTextPdf(lines);
}
