"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaterialLineItem } from "@/lib/domain/types";

type Props = {
  items: MaterialLineItem[];
  totals: { subtotal: number; labor: number; markup: number; tax: number; total: number };
};

export function MaterialsPanel({ items, totals }: Props) {
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
          Material estimate
          <span className="text-xs font-normal text-muted-foreground">
            ${totals.total.toFixed(2)}
          </span>
        </button>
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
          <table className="w-full min-w-[280px] text-xs">
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
              <span>Subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labor</span>
              <span>${totals.labor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium text-foreground">
              <span>Total</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
