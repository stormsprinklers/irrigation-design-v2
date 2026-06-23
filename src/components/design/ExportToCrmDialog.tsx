"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { searchCrmCustomers } from "@/lib/integrations/crm";

type Props = {
  projectId: string;
  versionId: string;
};

export function ExportToCrmDialog({ projectId, versionId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string;
      properties: Array<{ id: string; name: string }>;
    }>
  >([]);

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const data = await searchCrmCustomers(query.trim());
      setResults(data.customers);
    } catch {
      toast.error("Customer search failed");
    } finally {
      setSearching(false);
    }
  }

  async function exportToCrm() {
    if (!customerId.trim()) {
      toast.error("Select or enter a CRM customer ID");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/export/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          versionId,
          customerId: customerId.trim(),
          propertyId: propertyId.trim() || null,
          status: "DRAFT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      toast.success(data.created ? "Estimate created in CRM" : "Estimate already exists in CRM");
      if (data.staffUrl) window.open(data.staffUrl, "_blank");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export to CRM
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg space-y-4">
        <h2 className="font-semibold">Export to CRM</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search CRM customers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="outline" onClick={runSearch} disabled={searching}>
            {searching ? "..." : "Search"}
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="max-h-40 overflow-y-auto border rounded divide-y text-sm">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    setCustomerId(c.id);
                    setPropertyId(c.properties[0]?.id ?? "");
                  }}
                >
                  {c.name}
                  {c.properties[0] ? ` · ${c.properties[0].name}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Input
          placeholder="CRM customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <Input
          placeholder="Property ID (optional)"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={exportToCrm} disabled={exporting}>
            {exporting ? "Exporting..." : "Export estimate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
