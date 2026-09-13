import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNext(value:string|null){return value?.startsWith('/')&&!value.startsWith('//')?value:'/onboarding'}

export async function GET(request:Request){
  const url=new URL(request.url),code=url.searchParams.get('code'),next=safeNext(url.searchParams.get('next'));
  if(code){
    const supabase=await createClient();
    const {error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){
      const host=request.headers.get('x-forwarded-host');
      const proto=request.headers.get('x-forwarded-proto')||'https';
      const origin=host?`${proto}://${host}`:url.origin;
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(new URL('/login?error=oauth',url.origin));
}
