import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Dev-only endpoint to persist screenshots taken via html2canvas-style
// captures from the browser. NOT intended for production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const name = String(body?.name ?? "shot").replace(/[^a-zA-Z0-9._-]/g, "_");
    const dataUrl = String(body?.dataUrl ?? "");
    const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!m) return NextResponse.json({ ok: false, error: "bad dataUrl" }, { status: 400 });
    const ext = m[1] === "jpeg" ? "jpg" : "png";
    const buf = Buffer.from(m[2], "base64");
    const dir = path.resolve(process.cwd(), "screenshots");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${name}.${ext}`);
    await writeFile(file, buf);
    return NextResponse.json({ ok: true, path: file, bytes: buf.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
