import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hhAuthorizeUrl } from "@/lib/auto-apply";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const state = randomBytes(32).toString("hex");
    const response = NextResponse.redirect(hhAuthorizeUrl(state));
    response.cookies.set("hh_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/agent/hh/callback", maxAge: 600 });
    return response;
  } catch { return NextResponse.redirect(new URL("/app?view=agent&error=config", request.url)); }
}
