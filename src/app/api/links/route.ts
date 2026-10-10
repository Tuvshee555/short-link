import { NextResponse, type NextRequest } from "next/server";

import { validateAlias } from "@/lib/alias";
import { validateDestination } from "@/lib/destination";
import { getBlockedHosts, getOwnHosts } from "@/lib/env";
import { fail, readJsonBody, requireAdmin, requireAdminWrite, serverFailure } from "@/lib/http";
import { AliasTakenError, createLink, createRandomLink, listLinks, toDTO } from "@/lib/links";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const { links, total } = await listLinks(q.slice(0, 200));
    return NextResponse.json({ links, total });
  } catch (error) {
    return serverFailure("list links", error);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminWrite(request);
  if (denied) return denied;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { destination, alias, random } = parsed.body;

  const checkedDestination = validateDestination(destination, {
    ownHosts: getOwnHosts(),
    blockedHosts: getBlockedHosts(),
  });
  if (!checkedDestination.ok) {
    return fail(400, "invalid_destination", checkedDestination.message, { field: "destination" });
  }

  const wantsRandom = random === true || typeof alias !== "string" || alias.trim() === "";

  try {
    if (wantsRandom) {
      const link = await createRandomLink(checkedDestination.url);
      return NextResponse.json({ link: toDTO(link) }, { status: 201 });
    }

    const checkedAlias = validateAlias(alias);
    if (!checkedAlias.ok) {
      return fail(400, "invalid_alias", checkedAlias.message, { field: "alias" });
    }

    const link = await createLink(checkedAlias.alias, checkedDestination.url);
    return NextResponse.json({ link: toDTO(link) }, { status: 201 });
  } catch (error) {
    if (error instanceof AliasTakenError) {
      return fail(409, "alias_taken", `“${error.alias}” is already taken. Pick another alias.`, {
        field: "alias",
      });
    }
    return serverFailure("create link", error);
  }
}
