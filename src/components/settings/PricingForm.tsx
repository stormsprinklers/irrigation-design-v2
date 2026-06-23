"use client";

import { useState } from "react";
import { updatePricingProfile } from "@/lib/actions/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  initial: {
    pipePerFoot: number;
    headCost: number;
    valveCost: number;
    laborMultiplier: number;
    markup: number;
    targetProfitMarginPercent: number;
    tax: number;
    wasteFactor: number;
  };
};

export function PricingForm({ initial }: Props) {
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

  const fields = [
    { key: "pipePerFoot", label: "Pipe per foot ($)" },
    { key: "headCost", label: "Head cost ($)" },
    { key: "valveCost", label: "Valve cost ($)" },
    { key: "laborMultiplier", label: "Labor multiplier" },
    { key: "markup", label: "Markup (decimal)" },
    { key: "targetProfitMarginPercent", label: "Target profit margin (%)" },
    { key: "tax", label: "Tax (decimal)" },
    { key: "wasteFactor", label: "Waste factor (decimal)" },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
      {fields.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <Input
            type="number"
            step="0.01"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          />
        </div>
      ))}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save pricing"}
      </Button>
    </form>
  );
}
