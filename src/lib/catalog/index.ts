import { prisma } from "@/lib/prisma";
import type { CatalogItemData } from "@/lib/domain/types";

export async function getCatalogItems(organizationId?: string): Promise<CatalogItemData[]> {
  const items = await prisma.catalogItem.findMany({
    where: {
      OR: [{ isSystem: true }, { organizationId }],
    },
    orderBy: [{ category: "asc" }, { manufacturer: "asc" }],
  });

  return items.map((item) => ({
    id: item.id,
    category: item.category,
    manufacturer: item.manufacturer,
    model: item.model,
    specs: item.specs as Record<string, unknown>,
    nozzleChart: item.nozzleChart as CatalogItemData["nozzleChart"],
  }));
}
