import { runAutoApply } from "@/lib/auto-apply";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await runAutoApply(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    console.error("JobPilot agent cron failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Agent run failed" }, { status: 503 });
  }
}
