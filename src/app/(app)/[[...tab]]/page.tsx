import { redirect } from "next/navigation";
import { TabShell } from "@/components/shell/tab-shell";
import { TABS, type TabId } from "@/components/shell/tabs";

export default async function AppPage({
  params,
}: {
  params: Promise<{ tab?: string[] }>;
}) {
  const { tab } = await params;
  const slug = tab?.[0] ?? "";
  const match = TABS.find((t) => t.slug === slug);
  // single-user app has no 404 audience — unknown paths land on Today
  if (!match || (tab?.length ?? 0) > 1) redirect("/");
  return <TabShell initialTab={match.id as TabId} />;
}
