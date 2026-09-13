import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabasePublishableKey, supabaseUrl } from './config';

export async function createClient(){
  const cookieStore=await cookies();
  return createServerClient(supabaseUrl,supabasePublishableKey,{
    cookies:{
      getAll(){return cookieStore.getAll()},
      setAll(cookiesToSet){
        try{cookiesToSet.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{}
      },
    },
  });
}

export async function getCurrentUser(){
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  if(error||!data?.claims?.sub)return null;
  return {id:String(data.claims.sub),email:typeof data.claims.email==='string'?data.claims.email:null,claims:data.claims};
}
