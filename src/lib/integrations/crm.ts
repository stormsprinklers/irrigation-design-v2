const CRM_BASE = process.env.CRM_INTEGRATION_URL?.replace(/\/$/, "") ?? "";
const CRM_KEY = process.env.CRM_INTEGRATION_KEY ?? "";

export function isCrmIntegrationConfigured() {
  return Boolean(CRM_BASE && CRM_KEY);
}

export async function exportEstimateToCrm(payload: unknown) {
  if (!isCrmIntegrationConfigured()) {
    throw new Error("CRM integration is not configured");
  }

  const res = await fetch(`${CRM_BASE}/design/estimates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRM_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `CRM export failed (${res.status})`);
  }

  return res.json() as Promise<{ estimateId: string; staffUrl: string; created: boolean }>;
}

export async function searchCrmCustomersViaIntegration(query: string) {
  if (!isCrmIntegrationConfigured()) {
    return { customers: [] };
  }

  const res = await fetch(
    `${CRM_BASE}/design/customers/search?q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${CRM_KEY}` },
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) throw new Error("Customer search failed");
  return res.json() as Promise<{
    customers: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      properties: Array<{ id: string; name: string; address: string | null }>;
    }>;
  }>;
}

export async function searchCrmCustomers(query: string) {
  const res = await fetch(`/api/crm/customers/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Customer search failed");
  return res.json() as Promise<{
    customers: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      properties: Array<{ id: string; name: string; address: string | null }>;
    }>;
  }>;
}
