import { NextResponse } from "next/server";
import { checkModel } from "@/lib/model";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkModel();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
