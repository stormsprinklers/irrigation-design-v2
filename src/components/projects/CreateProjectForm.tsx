"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProject } from "@/lib/actions/design";
import { searchCrmCustomers } from "@/lib/integrations/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
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
    } else {
      setPropertyId("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const project = await createProject({
        name: String(form.get("name")),
        customerName: customerName || String(form.get("customerName") || "") || undefined,
        address: address || String(form.get("address") || "") || undefined,
        crmCustomerId: customerId || undefined,
        crmPropertyId: propertyId || undefined,
      });
      router.push(`/projects/${project.id}/design`);
    } catch {
      toast.error("Failed to create project");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required placeholder="Smith residence" />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <Label>Link CRM customer (optional)</Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email"
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
              </li>
            ))}
          </ul>
        ) : null}
        {customerId ? (
          <p className="text-xs text-muted-foreground">
            Linked: {customerName} {address ? `· ${address}` : ""}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerName">Customer name</Label>
        <Input
          id="customerName"
          name="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="John Smith"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create & open design"}
      </Button>
    </form>
  );
}
