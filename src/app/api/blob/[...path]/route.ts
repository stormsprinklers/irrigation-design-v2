import { auth } from "@/lib/auth";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { canAccessBlobPath } from "@/lib/blob/urls";
import { getBlobToken } from "@/lib/blob/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const pathname = path.map((segment) => decodeURIComponent(segment)).join("/");

  if (!canAccessBlobPath(session.user.organizationId, pathname)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = getBlobToken();
  if (!token) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });
  }

  try {
    const result = await get(pathname, {
      access: "private",
      token,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
