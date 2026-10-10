import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { listLinks } from "@/lib/links";

import LinksDashboard from "./LinksDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Short links — Dashboard" };

export default async function LinksPage() {
  // The real gate. Every API route re-checks the session itself, too.
  if (!(await isAdminSession())) redirect("/admin/login");

  const { links, total } = await listLinks();

  return <LinksDashboard initialLinks={links} initialTotal={total} baseUrl={getBaseUrl()} />;
}
