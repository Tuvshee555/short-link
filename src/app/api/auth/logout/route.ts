import { NextResponse, type NextRequest } from "next/server";

import { clearSession } from "@/lib/auth";
import { fail, isSameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return fail(403, "cross_site", "This request didn’t come from the dashboard, so it was blocked.");
  }
  return clearSession(NextResponse.json({ ok: true }));
}
