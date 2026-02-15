import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/page";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await requirePageSession();
  if (session.role !== "OWNER") redirect("/");

  const settings = await prisma.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings) return null;

  return (
    <AppShell title="Owner Settings" role={session.role}>
      <SettingsForm initial={settings as any} />
    </AppShell>
  );
}
