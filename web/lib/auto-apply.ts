import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { adminClient } from "@/lib/ai-quota";
import { getHhVacancy, searchHhVacancies } from "@/lib/hh";
import { score, skillMatch, stateSchema, type Job, type Profile } from "@/lib/product";
import { type AgentConfig } from "@/lib/agent-config";

type Token = { access_token: string; refresh_token?: string; expires_in?: number };
type AgentRow = { user_id: string; enabled: boolean; resume_id: string; daily_limit: number; min_salary: number; blocked_companies: string[]; access_token: string | null; refresh_token: string | null; token_expires_at: string | null };
const HH_API = "https://api.hh.ru";
const headers = () => ({ "HH-User-Agent": process.env.HH_USER_AGENT || "JobPilot/0.2 (https://startup2-self.vercel.app)" });

function encryptionKey() {
  const key = Buffer.from(process.env.AGENT_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("AGENT_KEY_NOT_CONFIGURED");
  return key;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
export function hhRedirectUri() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw new Error("SITE_URL_NOT_CONFIGURED");
  return `${origin}/api/agent/hh/callback`;
}
export function hhAuthorizeUrl(state: string) {
  const clientId = process.env.HH_CLIENT_ID;
  if (!clientId || !process.env.HH_CLIENT_SECRET) throw new Error("HH_NOT_CONFIGURED");
  const url = new URL("https://hh.ru/oauth/authorize");
  url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: hhRedirectUri(), state }).toString();
  return url.toString();
}
async function hhToken(params: URLSearchParams): Promise<Token> {
  const response = await fetch(`${HH_API}/token`, { method: "POST", headers: { ...headers(), "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HH_TOKEN_${response.status}`);
  return z.object({ access_token: z.string().min(10), refresh_token: z.string().optional(), expires_in: z.number().optional() }).parse(await response.json());
}
export async function exchangeHhCode(code: string) {
  return hhToken(new URLSearchParams({ grant_type: "authorization_code", client_id: process.env.HH_CLIENT_ID || "", client_secret: process.env.HH_CLIENT_SECRET || "", redirect_uri: hhRedirectUri(), code }));
}
export async function hhRequest(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${HH_API}${path}`, { ...init, headers: { ...headers(), Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  return response;
}
export async function saveHhConnection(userId: string, token: Token, hhUserId: string) {
  const { error } = await adminClient().from("agent_settings").upsert({ user_id: userId, enabled: false, resume_id: "", access_token: encrypt(token.access_token), refresh_token: token.refresh_token ? encrypt(token.refresh_token) : null, token_expires_at: new Date(Date.now() + Math.max(0, token.expires_in || 86400) * 1000).toISOString(), hh_user_id: hhUserId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
export async function accessToken(row: AgentRow) {
  if (!row.access_token) throw new Error("HH_NOT_CONNECTED");
  if (!row.token_expires_at || Date.parse(row.token_expires_at) > Date.now()) return decrypt(row.access_token);
  if (!row.refresh_token) throw new Error("HH_RECONNECT_REQUIRED");
  const token = await hhToken(new URLSearchParams({ grant_type: "refresh_token", client_id: process.env.HH_CLIENT_ID || "", client_secret: process.env.HH_CLIENT_SECRET || "", refresh_token: decrypt(row.refresh_token) }));
  const { data, error } = await adminClient().from("agent_settings").update({ access_token: encrypt(token.access_token), refresh_token: token.refresh_token ? encrypt(token.refresh_token) : row.refresh_token, token_expires_at: new Date(Date.now() + (token.expires_in || 86400) * 1000).toISOString() }).eq("user_id", row.user_id).eq("refresh_token", row.refresh_token).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("HH_TOKEN_CHANGED");
  return token.access_token;
}
export function eligible(profile: Profile, job: Job, config: AgentConfig) {
  if (job.source !== "hh" || !job.sourceId || !job.companyTrusted) return false;
  if (config.blockedCompanies.some((name) => job.company.toLocaleLowerCase("ru").includes(name.toLocaleLowerCase("ru")))) return false;
  if (profile.format !== "Любой" && profile.format !== job.format) return false;
  if (config.minSalary && (!job.salaryMin || job.salaryCurrency !== "RUR" || job.salaryMin < config.minSalary)) return false;
  const roleWords = profile.role.toLocaleLowerCase("ru").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
  if (!roleWords.length || !roleWords.some((word) => job.title.toLocaleLowerCase("ru").includes(word))) return false;
  if (!job.description || !job.skills.length || score(profile, job) < 50) return false;
  return true;
}

export function agentLetter(profile: Profile, job: Job) {
  const skills = skillMatch(profile, job).filter((item) => item.matched).map((item) => item.skill);
  return `Здравствуйте! Меня заинтересовала вакансия «${job.title}» в компании «${job.company}».\n\nВ моём профиле указаны релевантные навыки: ${skills.join(", ")}. ${profile.resume.trim().slice(0, 700)}\n\nБуду рад(а) обсудить задачи позиции.\n${profile.name}`.slice(0, 1500);
}

export async function runAutoApply() {
  const admin = adminClient();
  const { data: users, error } = await admin.from("agent_settings").select("*").eq("enabled", true).limit(30);
  if (error) throw error;
  const result = { users: 0, sent: 0, review: 0 };
  for (const row of (users || []) as AgentRow[]) {
    result.users++;
    try {
      const token = await accessToken(row);
      const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("data").eq("user_id", row.user_id).single();
      if (workspaceError) throw workspaceError;
      const parsed = stateSchema.safeParse(workspace.data);
      const state = parsed.success ? parsed.data : null;
      const profile = state?.profile;
      if (!profile?.resume || !profile.skills || !profile.role) continue;
      const config: AgentConfig = { enabled: true, resumeId: row.resume_id, dailyLimit: row.daily_limit, minSalary: row.min_salary, blockedCompanies: row.blocked_companies };
      const { jobs } = await searchHhVacancies({ text: profile.role, city: profile.city, salary: config.minSalary, format: profile.format, experience: profile.experience, page: 0 });
      for (const preview of jobs.slice(0, 20)) {
        if (!preview.companyTrusted || !preview.sourceId) continue;
        const job = await getHhVacancy(preview.sourceId);
        if (!eligible(profile, job, config)) continue;
        if (state!.applications.some((application) => application.jobId === job.id)) continue;
        const { data: reserved, error: reserveError } = await admin.rpc("reserve_agent_attempt", { p_user_id: row.user_id, p_vacancy_id: job.sourceId, p_title: job.title, p_company: job.company, p_daily_limit: config.dailyLimit });
        if (reserveError) throw reserveError;
        if (!reserved) continue;
        // Once reserved, any failure is review-only. Network timeouts can mean
        // hh.ru received the request, so automatically retrying can duplicate it.
        let status = "review", reason = "Не удалось подтвердить отправку. Проверьте отклики на hh.ru.";
        try {
          const latest = await admin.from("agent_settings").select("enabled,resume_id").eq("user_id", row.user_id).maybeSingle();
          if (latest.error) throw latest.error;
          if (!latest.data?.enabled || latest.data.resume_id !== config.resumeId) {
            status = "skipped"; reason = "Агент остановлен или настройки изменились.";
          } else {
          const message = agentLetter(profile, job);
          const body = new URLSearchParams({ vacancy_id: job.sourceId, resume_id: config.resumeId, message });
          const response = await hhRequest("/negotiations", token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
          if (response.ok) { status = "sent"; reason = "Отправлено через API hh.ru"; result.sent++; }
          else {
            const payload = await response.json().catch(() => ({})) as { errors?: { value?: string }[] };
            const code = payload.errors?.[0]?.value || `HTTP ${response.status}`;
            status = code === "already_applied" || code === "test_required" || code === "limit_exceeded" ? "skipped" : "review";
            reason = `hh.ru: ${code}`.slice(0, 200);
          }
          }
        } catch { /* An ambiguous response always needs manual review. */ }
        if (status === "review") result.review++;
        const { error: updateError } = await admin.from("agent_attempts").update({ status, reason, updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("vacancy_id", job.sourceId);
        if (updateError) throw updateError;
        if (reason === "hh.ru: limit_exceeded" || reason === "hh.ru: HTTP 429") break;
      }
    } catch (cause) {
      // A broken connection for one account must not stop other accounts.
      console.error("JobPilot agent run failed", row.user_id, cause instanceof Error ? cause.message : cause);
    }
  }
  return result;
}
