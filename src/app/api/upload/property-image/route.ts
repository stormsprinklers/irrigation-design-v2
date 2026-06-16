import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { uploadPrivateBlob } from "@/lib/blob/storage";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
    }

    const pathname = `properties/${session.user.organizationId}/${projectId}/${file.name}`;
    const blob = await uploadPrivateBlob(pathname, file, {
      contentType: file.type,
      allowOverwrite: true,
    });

    return NextResponse.json({
      blobPath: blob.pathname,
      url: blob.url,
      width: 1200,
      height: 800,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
