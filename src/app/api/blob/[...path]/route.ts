import { NextResponse } from "next/server";
import { head } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = decodeURIComponent(path.join("/"));

  try {
    const blob = await head(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.redirect(blob.url);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
