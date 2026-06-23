import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchCrmCustomersViaIntegration } from "@/lib/integrations/crm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const data = await searchCrmCustomersViaIntegration(q);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ customers: [] });
  }
}
