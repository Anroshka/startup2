import { z } from "zod";
import { adminClient } from "@/lib/ai-quota";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Нужно войти." }, { status: 401 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Запрос отклонён." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Нужен JSON." }, { status: 415 });
  const raw = await request.text();
  if (raw.length > 100) return Response.json({ error: "Некорректный запрос." }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); }
  catch { return Response.json({ error: "Некорректный JSON." }, { status: 400 }); }
  const payload = z.object({ confirmation: z.literal("УДАЛИТЬ") }).safeParse(input);
  if (!payload.success) return Response.json({ error: "Для подтверждения введите УДАЛИТЬ." }, { status: 400 });

  try {
    const admin = adminClient();
    // Remove the workspace before the Auth user, including data in deployments
    // whose original workspaces table did not have a cascading foreign key.
    const { error: workspaceError } = await admin.from("workspaces").delete().eq("user_id", user.id);
    if (workspaceError) throw workspaceError;
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    try { await (await createClient()).auth.signOut({ scope: "global" }); }
    catch { /* Account is already deleted; Auth lookups reject its old JWT. */ }
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("JobPilot account deletion failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Удаление не завершилось. Обратитесь в поддержку, если повторная попытка не помогает." }, { status: 503 });
  }
}
