import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeHhCode, hhRequest, saveHhConnection } from "@/lib/auto-apply";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookie = (await cookies()).get("hh_oauth_state")?.value;
  const user = await getCurrentUser();
  const destination = new URL("/app?view=agent", request.url);
  if (!user || !state || !cookie || state !== cookie || !code || code.length > 1000) {
    destination.searchParams.set("error", "oauth");
  } else {
    try {
      const token = await exchangeHhCode(code);
      const identity = await hhRequest("/me", token.access_token);
      if (!identity.ok) throw new Error(`HH_ME_${identity.status}`);
      const body = await identity.json() as { id?: string | number; is_applicant?: boolean };
      if (!body.id || body.is_applicant === false) throw new Error("HH_NOT_APPLICANT");
      await saveHhConnection(user.id, token, String(body.id));
      destination.searchParams.set("connected", "1");
    } catch (error) {
      console.error("JobPilot hh OAuth failed", error instanceof Error ? error.message : error);
      destination.searchParams.set("error", "oauth");
    }
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set("hh_oauth_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/agent/hh/callback", maxAge: 0 });
  return response;
}
