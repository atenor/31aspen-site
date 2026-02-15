"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@bodyshop.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [magicEmail, setMagicEmail] = useState("owner@bodyshop.local");
  const [error, setError] = useState<string | null>(null);
  const [magicMessage, setMagicMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Login failed");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function requestMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setMagicMessage(null);

    const response = await fetch("/api/auth/magic-link/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: magicEmail })
    });

    if (!response.ok) {
      setMagicMessage("Unable to send magic link.");
      return;
    }

    setMagicMessage("If that email exists, a sign-in link was sent.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-4">
        <h1 className="text-2xl">BodyShop Quote & Lien</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label>Email</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-1">
            <label>Password</label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full">Sign In</Button>
        </form>
        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-semibold">Or use a magic link</p>
          <form onSubmit={requestMagicLink} className="space-y-2">
            <Input value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} required />
            <Button type="submit" variant="outline" className="w-full">Send Magic Link</Button>
          </form>
          {magicMessage ? <p className="mt-2 text-xs text-muted-foreground">{magicMessage}</p> : null}
        </div>
      </Card>
    </main>
  );
}
