"use client";

import type { MaterialLineItem } from "@/lib/domain/types";

type Props = {
  items: MaterialLineItem[];
  totals: { subtotal: number; labor: number; markup: number; tax: number; total: number };
};

export function MaterialsPanel({ items, totals }: Props) {
  return (
    <div className="border-t bg-card p-4">
      <h3 className="text-sm font-medium">Material estimate</h3>
      <table className="mt-2 w-full text-xs">
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
  );
}
