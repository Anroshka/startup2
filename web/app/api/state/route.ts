import { createClient } from '@/lib/supabase/server';
import { emptyState,stateSchema } from '@/lib/product';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});

export async function GET(){
  try{
    const supabase=await createClient();
    const {data:claimsData,error:claimsError}=await supabase.auth.getClaims();
    const userId=claimsData?.claims?.sub;
    if(claimsError||!userId)return reply({error:'Войдите, чтобы открыть свой профиль.'},401);
    const {data,error}=await supabase.from('workspaces').select('data,revision').eq('user_id',userId).maybeSingle();
    if(error)throw error;
    return reply({state:data?.data??emptyState,revision:data?.revision??0});
  }catch(e){console.error('JobPilot state read failed',e);return reply({error:'Не удалось загрузить данные. Попробуйте ещё раз.'},503)}
}

export async function PUT(request:Request){
  try{
    const supabase=await createClient();
    const {data:claimsData,error:claimsError}=await supabase.auth.getClaims();
    const userId=claimsData?.claims?.sub;
    if(claimsError||!userId)return reply({error:'Нужно войти в аккаунт.'},401);
    if(request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Запрос отклонён.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Нужен JSON.'},415);
    if(Number(request.headers.get('content-length')||0)>900000)return reply({error:'Слишком большой объём данных.'},413);
    const text=await request.text();
    if(text.length>800000)return reply({error:'Лимит данных превышен. Выгрузите историю и удалите старые записи.'},413);
    let payload;try{payload=JSON.parse(text)}catch{return reply({error:'Некорректный запрос.'},400)}
    const parsed=stateSchema.safeParse(payload.state);
    if(!parsed.success||!Number.isSafeInteger(payload.revision)||payload.revision<0)return reply({error:parsed.success?'Некорректная версия.':parsed.error.issues[0].message},400);
    const now=new Date().toISOString();
    if(payload.revision===0){
      const {data,error}=await supabase.from('workspaces').insert({user_id:userId,data:parsed.data,revision:1,updated_at:now}).select('revision').single();
      if(error){if(error.code==='23505')return reply({error:'Данные изменились в другой вкладке. Обновите страницу.'},409);throw error}
      return reply({revision:data.revision});
    }
    const {data,error}=await supabase.from('workspaces').update({data:parsed.data,revision:payload.revision+1,updated_at:now}).eq('user_id',userId).eq('revision',payload.revision).select('revision').maybeSingle();
    if(error)throw error;
    if(!data)return reply({error:'Данные изменились в другой вкладке. Скопируйте несохранённый текст и обновите страницу.'},409);
    return reply({revision:data.revision});
  }catch(e){console.error('JobPilot state write failed',e);return reply({error:'Не удалось сохранить. Ваш ввод остался на экране — повторите попытку.'},503)}
}
