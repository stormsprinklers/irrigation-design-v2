import { getPricingProfile } from "@/lib/actions/design";
import { PricingForm } from "@/components/settings/PricingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PricingSettingsPage() {
  const pricing = await getPricingProfile();

  const initial = pricing
    ? {
        pipePerFoot: pricing.pipePerFoot,
        headCost: pricing.headCost,
        valveCost: pricing.valveCost,
        laborMultiplier: pricing.laborMultiplier,
        markup: pricing.markup,
        targetProfitMarginPercent: pricing.targetProfitMarginPercent,
        tax: pricing.tax,
        wasteFactor: pricing.wasteFactor,
      }
    : {
        pipePerFoot: 1.25,
        headCost: 8.5,
        valveCost: 45,
        laborMultiplier: 1.5,
        markup: 0.25,
        targetProfitMarginPercent: 35,
        tax: 0.08,
        wasteFactor: 0.1,
      };

  return (
    <div className="p-8">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Material & cost rules</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingForm initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
