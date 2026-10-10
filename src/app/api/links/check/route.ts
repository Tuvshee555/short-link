import { NextResponse, type NextRequest } from "next/server";

import { validateAlias } from "@/lib/alias";
import { requireAdmin, serverFailure } from "@/lib/http";
import { aliasExists } from "@/lib/links";

export const dynamic = "force-dynamic";

/** Live "is this alias free?" check for the create form. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const checked = validateAlias(request.nextUrl.searchParams.get("alias") ?? "");
  if (!checked.ok) {
    return NextResponse.json({ available: false, reason: "invalid", alias: checked.alias, message: checked.message });
  }

  try {
    const taken = await aliasExists(checked.alias);
    return NextResponse.json(
      taken
        ? { available: false, reason: "taken", alias: checked.alias, message: `“${checked.alias}” is already taken.` }
        : { available: true, alias: checked.alias },
    );
  } catch (error) {
    return serverFailure("check alias", error);
  }
}
