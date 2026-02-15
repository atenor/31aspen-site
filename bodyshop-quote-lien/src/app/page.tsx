import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (session.role === "TECH") redirect("/shop-floor");
  redirect("/dashboard");
}
