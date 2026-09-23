import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/config";

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error("AI_QUOTA_NOT_CONFIGURED");
  return createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function reserveAiRequest(userId: string) {
  const { data, error } = await adminClient().rpc("reserve_ai_request", { p_user_id: userId });
  if (error) throw error;
  return data === true;
}

export async function recordAiUsage(userId: string, tokens: number, cost: number) {
  const { error } = await adminClient().rpc("record_ai_usage", {
    p_user_id: userId,
    p_tokens: Math.max(0, Math.floor(tokens)),
    p_cost: Math.max(0, cost),
  });
  if (error) console.error("JobPilot AI usage accounting failed", error.code);
}

export { adminClient };
