"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaterialLineItem, ManHoursBreakdown } from "@/lib/domain/types";

type Props = {
  items: MaterialLineItem[];
  totals: {
    subtotal: number;
    laborCost: number;
    totalCost: number;
    sellPrice: number;
    tax: number;
    totalWithTax: number;
    manHours: ManHoursBreakdown;
    grossMarginPercent: number;
    jobMinimumApplied: boolean;
  };
  quoteTier: "STANDARD" | "PREMIUM";
  onQuoteTierChange?: (tier: "STANDARD" | "PREMIUM") => void;
};

export function MaterialsPanel({ items, totals, quoteTier, onQuoteTierChange }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t bg-card" data-tour="tour-materials">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          Material estimate ({quoteTier === "PREMIUM" ? "Premium" : "Standard"})
          <span className="text-xs font-normal text-muted-foreground">
            Sell ${totals.sellPrice.toFixed(2)} · {totals.manHours.total} hrs
          </span>
        </button>
        {onQuoteTierChange ? (
          <div className="mr-2 flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={quoteTier === "STANDARD" ? "default" : "outline"}
              onClick={() => onQuoteTierChange("STANDARD")}
            >
              Standard
            </Button>
            <Button
              type="button"
              size="sm"
              variant={quoteTier === "PREMIUM" ? "default" : "outline"}
              onClick={() => onQuoteTierChange("PREMIUM")}
            >
              Premium
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={open ? "Collapse material estimate" : "Expand material estimate"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[320px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Item</th>
                <th>Qty</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
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
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Materials subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labor ({totals.manHours.total} hrs × rate)</span>
              <span>${totals.laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Loaded cost</span>
              <span>${totals.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Sell price ({totals.grossMarginPercent}% gross margin)</span>
              <span>${totals.sellPrice.toFixed(2)}</span>
            </div>
            {totals.jobMinimumApplied ? (
              <p className="text-amber-600">Job minimum applied</p>
            ) : null}
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium text-foreground">
              <span>Customer total</span>
              <span>${totals.totalWithTax.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
