import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/auth";
import { getAdminConfig } from "@/lib/env";

import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

/** Only ever send people back to somewhere inside the dashboard. */
function safeNext(next: string | undefined): string {
  if (next && /^\/admin(\/[A-Za-z0-9_\-/]*)?$/.test(next) && !next.includes("//")) return next;
  return "/admin/links";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;

  if (await isAdminSession()) redirect(safeNext(next));

  return <LoginForm next={safeNext(next)} expired={expired === "1"} configured={getAdminConfig().ok} />;
}
