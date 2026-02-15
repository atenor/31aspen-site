import Link from "next/link";
import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";

export function AppShell({
  title,
  role,
  children
}: {
  title: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl p-4 md:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4">
        <div>
          <p className="text-sm text-muted-foreground">BodyShop Quote & Lien</p>
          <h1 className="text-2xl">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{role}</Badge>
          <nav className="flex gap-2 text-sm">
            <Link href="/" className="rounded border px-2 py-1">Home</Link>
            <Link href="/dashboard" className="rounded border px-2 py-1">Dashboard</Link>
            <Link href="/shop-floor" className="rounded border px-2 py-1">Shop Floor</Link>
            <Link href="/settings" className="rounded border px-2 py-1">Settings</Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
