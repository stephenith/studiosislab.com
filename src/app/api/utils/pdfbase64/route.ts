import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "StudiosisLABTEST.pdf");

    const buff = fs.readFileSync(filePath);
    const base64 = buff.toString("base64");

    return NextResponse.json({ ok: true, base64 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}