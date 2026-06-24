"use client";

import { useState } from "react";
import { updateProjectCrmLink } from "@/lib/actions/design";
import { searchCrmCustomers } from "@/lib/integrations/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  projectId: string;
  initial: {
    crmCustomerId: string | null;
    crmPropertyId: string | null;
    customerName: string | null;
    address: string | null;
  };
};

export function ProjectCrmLinkForm({ projectId, initial }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState(initial.crmCustomerId ?? "");
  const [propertyId, setPropertyId] = useState(initial.crmPropertyId ?? "");
  const [customerName, setCustomerName] = useState(initial.customerName ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string;
      properties: Array<{ id: string; name: string; address: string | null }>;
    }>
  >([]);

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const data = await searchCrmCustomers(query.trim());
      setResults(data.customers);
    } catch {
      toast.error("CRM customer search failed");
    } finally {
      setSearching(false);
    }
  }

  function selectCustomer(
    customer: (typeof results)[0],
    property?: (typeof results)[0]["properties"][0]
  ) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    if (property) {
      setPropertyId(property.id);
      setAddress(property.address ?? "");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProjectCrmLink(projectId, {
        crmCustomerId: customerId || null,
        crmPropertyId: propertyId || null,
        customerName: customerName || undefined,
        address: address || undefined,
      });
      toast.success("CRM link saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function clearLink() {
    setCustomerId("");
    setPropertyId("");
    setCustomerName("");
    setAddress("");
    setResults([]);
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <Label>Search CRM customer</Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone, or email"
          />
          <Button type="button" variant="outline" onClick={runSearch} disabled={searching}>
            {searching ? "…" : "Search"}
          </Button>
        </div>
        {results.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => selectCustomer(c, c.properties[0])}
                >
                  {c.name}
                  {c.properties[0]?.address ? ` — ${c.properties[0].address}` : ""}
                </button>
                {c.properties.length > 1 ? (
                  <ul className="ml-3 border-l pl-2">
                    {c.properties.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full rounded px-2 py-0.5 text-left text-xs hover:bg-muted"
                          onClick={() => selectCustomer(c, p)}
                        >
                          {p.name}
                          {p.address ? ` — ${p.address}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer name</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      {customerId ? (
        <p className="text-xs text-muted-foreground">
          Linked customer ID: {customerId}
          {propertyId ? ` · property ${propertyId}` : ""}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No CRM customer linked</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save link"}
        </Button>
        {customerId ? (
          <Button type="button" variant="outline" onClick={clearLink}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
