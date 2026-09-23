import { z } from "zod";
import { adminClient } from "@/lib/ai-quota";
import { accessToken, hhRequest } from "@/lib/auto-apply";
import { agentConfigSchema, defaultAgentConfig } from "@/lib/agent-config";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Войдите в аккаунт." }, 401);
  try {
    const admin = adminClient();
    const [{ data: row, error }, { data: attempts, error: attemptsError }] = await Promise.all([
      admin.from("agent_settings").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("agent_attempts").select("vacancy_id,title,company,status,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (error || attemptsError) throw error || attemptsError;
    let resumes: { id: string; title: string }[] = [];
    if (row?.access_token) {
      try {
        const token = await accessToken(row);
        const response = await hhRequest("/resumes/mine", token);
        if (response.ok) {
          const body = z.object({ items: z.array(z.object({ id: z.string(), title: z.string().nullish() })) }).parse(await response.json());
          resumes = body.items.map((item) => ({ id: item.id, title: item.title || "Резюме без названия" }));
        }
      } catch { /* Settings remain accessible when hh.ru is unavailable. */ }
    }
    return reply({ connected: Boolean(row?.access_token), config: row ? { enabled: row.enabled, resumeId: row.resume_id, dailyLimit: row.daily_limit, minSalary: row.min_salary, blockedCompanies: row.blocked_companies } : defaultAgentConfig, resumes, attempts });
  } catch (error) {
    console.error("JobPilot agent read failed", error instanceof Error ? error.message : error);
    return reply({ error: "Не удалось загрузить настройки агента." }, 503);
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Войдите в аккаунт." }, 401);
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Запрос отклонён." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Нужен JSON." }, 415);
  const raw = await request.text();
  if (raw.length > 5000) return reply({ error: "Слишком большой запрос." }, 413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return reply({ error: "Некорректный JSON." }, 400); }
  const parsed = agentConfigSchema.safeParse(input);
  if (!parsed.success) return reply({ error: parsed.error.issues[0].message }, 400);
  try {
    const admin = adminClient();
    const { data: row, error } = await admin.from("agent_settings").select("access_token").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!row?.access_token) return reply({ error: "Сначала подключите аккаунт hh.ru." }, 409);
    const config = parsed.data;
    if (config.enabled && !config.resumeId) return reply({ error: "Выберите резюме hh.ru." }, 400);
    // Check that the selected resume belongs to the connected applicant.
    if (config.enabled) {
      const full = await admin.from("agent_settings").select("*").eq("user_id", user.id).single();
      if (full.error) throw full.error;
      const response = await hhRequest("/resumes/mine", await accessToken(full.data));
      if (!response.ok) return reply({ error: "Не удалось проверить резюме hh.ru." }, 502);
      const resumes = z.object({ items: z.array(z.object({ id: z.string() })) }).parse(await response.json());
      if (!resumes.items.some((item) => item.id === config.resumeId)) return reply({ error: "Резюме не найдено в подключённом аккаунте hh.ru." }, 400);
    }
    const { error: updateError } = await admin.from("agent_settings").update({ enabled: config.enabled, resume_id: config.resumeId, daily_limit: config.dailyLimit, min_salary: config.minSalary, blocked_companies: config.blockedCompanies, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (updateError) throw updateError;
    return reply({ config });
  } catch (error) {
    console.error("JobPilot agent update failed", error instanceof Error ? error.message : error);
    return reply({ error: "Не удалось сохранить настройки агента." }, 503);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Войдите в аккаунт." }, 401);
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Запрос отклонён." }, 403);
  try {
    const { error } = await adminClient().from("agent_settings").delete().eq("user_id", user.id);
    if (error) throw error;
    return reply({ disconnected: true });
  } catch { return reply({ error: "Не удалось отключить hh.ru." }, 503); }
}
