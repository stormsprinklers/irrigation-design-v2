import { getPricingProfile } from "@/lib/actions/design";
import { getCatalogItems } from "@/lib/catalog";
import { PricingForm } from "@/components/settings/PricingForm";
import { mapPricingProfile } from "@/lib/pricing/map-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PricingSettingsPage() {
  const pricing = await getPricingProfile();
  const catalog = await getCatalogItems(pricing?.organizationId);

  return (
    <div className="p-8">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Material & cost rules</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingForm initial={mapPricingProfile(pricing)} catalog={catalog} />
        </CardContent>
      </Card>
    </div>
  );
}
