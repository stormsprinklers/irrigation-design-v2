import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getShareLinkByToken } from "@/lib/actions/design";
import { getBlobToken } from "@/lib/blob/storage";
import { canAccessBlobPath } from "@/lib/blob/urls";
import { prisma } from "@/lib/prisma";
import type { DesignDocument } from "@/lib/domain/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  const version = link.versionId
    ? await prisma.designVersion.findUnique({ where: { id: link.versionId } })
    : await prisma.designVersion.findFirst({
        where: { projectId: link.projectId, isActive: true },
      });

  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = version.designData as DesignDocument;
  const blobPath = doc.propertyImage?.blobPath;
  if (!blobPath) {
    return NextResponse.json({ error: "No property image" }, { status: 404 });
  }

  if (!canAccessBlobPath(link.project.organizationId, blobPath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const blobToken = getBlobToken();
  if (!blobToken) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });
  }

  try {
    const result = await get(blobPath, {
      access: "private",
      token: blobToken,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
