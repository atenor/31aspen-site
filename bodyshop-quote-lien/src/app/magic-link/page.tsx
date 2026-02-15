"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";

export default function MagicLinkPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Verifying sign-in link...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("Missing token.");
      return;
    }

    fetch("/api/auth/magic-link/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Verification failed");
        }
        setStatus("Success. Redirecting...");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 600);
      })
      .catch((error) => {
        setStatus(error.message || "Verification failed");
      });
  }, [params, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <h1 className="mb-2 text-xl">Magic Link Sign-in</h1>
        <p className="text-sm text-muted-foreground">{status}</p>
      </Card>
    </main>
  );
}
