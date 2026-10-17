import { NextResponse } from "next/server";
import { verifyAuditLedgerChain } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const verification = await verifyAuditLedgerChain();
    return NextResponse.json({
      ok: true,
      ...verification,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
