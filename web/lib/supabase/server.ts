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
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return null;
  return {id:data.user.id,email:data.user.email||null};
}
