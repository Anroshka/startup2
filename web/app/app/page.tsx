import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; view?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user && params.demo !== "1") redirect("/login?next=%2Fapp");
  return (
    <Workspace
      signedIn={!!user}
      initialDemo={params.demo === "1"}
      initialView={params.view}
    />
  );
}
