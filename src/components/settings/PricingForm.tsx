"use client";

import { useState } from "react";
import { updatePricingProfile } from "@/lib/actions/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { CatalogItemData, PricingProfileData } from "@/lib/domain/types";

type Props = {
  initial: PricingProfileData;
  catalog?: CatalogItemData[];
};

function Field({
  label,
  value,
  onChange,
  step = "0.01",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function PricingForm({ initial, catalog = [] }: Props) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePricingProfile(form);
      toast.success("Pricing updated");
    } catch {
      toast.error("Failed to update pricing");
    } finally {
      setLoading(false);
    }
  }

  const set = (key: keyof PricingProfileData, value: number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setOverride = (catalogId: string, value: number | null) => {
    setForm((prev) => {
      const next = { ...prev.catalogCostOverrides };
      if (value == null || !Number.isFinite(value)) delete next[catalogId];
      else next[catalogId] = value;
      return { ...prev, catalogCostOverrides: next };
    });
  };

  const catalogWithCosts = catalog.filter(
    (item) => item.category === "NOZZLE" || item.category === "HEAD_BODY" || item.category === "PIPE"
  );

  return (
    <form onSubmit={handleSubmit} className="grid max-w-2xl gap-8">
      <section className="space-y-4">
        <h3 className="font-medium">Materials</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nozzle cost ($)" value={form.nozzleCost} onChange={(v) => set("nozzleCost", v)} />
          <Field label="Head body cost ($)" value={form.headBodyCost} onChange={(v) => set("headBodyCost", v)} />
          <Field label="PRS nozzle cost ($)" value={form.prsCost} onChange={(v) => set("prsCost", v)} />
          <Field label="Pipe per foot ($)" value={form.pipePerFoot} onChange={(v) => set("pipePerFoot", v)} />
          <Field label="Valve cost ($)" value={form.valveCost} onChange={(v) => set("valveCost", v)} />
          <Field label="Backflow cost ($)" value={form.backflowCost} onChange={(v) => set("backflowCost", v)} />
          <Field label="Filter cost ($)" value={form.filterCost} onChange={(v) => set("filterCost", v)} />
          <Field label="Flow sensor ($)" value={form.flowSensorCost} onChange={(v) => set("flowSensorCost", v)} />
          <Field label="Weather sensor ($)" value={form.weatherSensorCost} onChange={(v) => set("weatherSensorCost", v)} />
          <Field label="Controller ($)" value={form.controllerCost} onChange={(v) => set("controllerCost", v)} />
          <Field label="Sod per sq ft ($)" value={form.sodPerSqFt} onChange={(v) => set("sodPerSqFt", v)} />
          <Field label="Topsoil per sq ft ($)" value={form.topsoilPerSqFt} onChange={(v) => set("topsoilPerSqFt", v)} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Labor (man-hours)</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hourly rate ($)" value={form.laborHourlyRate} onChange={(v) => set("laborHourlyRate", v)} />
          <Field label="Hours per head" value={form.hoursPerHead} onChange={(v) => set("hoursPerHead", v)} step="0.01" />
          <Field label="Hours per zone" value={form.hoursPerZone} onChange={(v) => set("hoursPerZone", v)} step="0.01" />
          <Field label="Hours per 100 ft pipe" value={form.hoursPer100ftPipe} onChange={(v) => set("hoursPer100ftPipe", v)} step="0.01" />
          <Field label="Slope area modifier (hrs)" value={form.hoursSlopeModifier} onChange={(v) => set("hoursSlopeModifier", v)} step="0.01" />
          <Field label="Concrete area modifier (hrs)" value={form.hoursConcreteModifier} onChange={(v) => set("hoursConcreteModifier", v)} step="0.01" />
          <Field label="Retaining wall modifier (hrs)" value={form.hoursRetainingWallModifier} onChange={(v) => set("hoursRetainingWallModifier", v)} step="0.01" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Quote & margin</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gross margin (%)" value={form.grossMarginPercent} onChange={(v) => set("grossMarginPercent", v)} step="1" />
          <Field label="Job minimum ($)" value={form.jobMinimum} onChange={(v) => set("jobMinimum", v)} step="1" />
          <Field label="Premium maintenance (1 yr) ($)" value={form.premiumMaintenanceYearPrice} onChange={(v) => set("premiumMaintenanceYearPrice", v)} />
          <Field label="Tax (decimal)" value={form.tax} onChange={(v) => set("tax", v)} step="0.001" />
          <Field label="Pipe waste factor" value={form.wasteFactor} onChange={(v) => set("wasteFactor", v)} step="0.01" />
        </div>
      </section>

      {catalogWithCosts.length > 0 ? (
        <section className="space-y-4">
          <h3 className="font-medium">Per-catalog cost overrides ($)</h3>
          <p className="text-sm text-muted-foreground">
            Optional unit costs for specific catalog items. Leave blank to use defaults above.
          </p>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
            {catalogWithCosts.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px] items-center gap-2 text-sm">
                <span>
                  {item.manufacturer} {item.model}
                  <span className="ml-2 text-xs text-muted-foreground">{item.category}</span>
                </span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="—"
                  value={form.catalogCostOverrides[item.id] ?? ""}
                  onChange={(e) =>
                    setOverride(item.id, e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save pricing"}
      </Button>
    </form>
  );
}
