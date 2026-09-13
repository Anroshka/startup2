'use client';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft, LoaderCircle, Mail} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

function GitHubMark(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.98 10.98 0 0 1 12 6.12c.98 0 1.96.13 2.87.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>}
function safeNext(){if(typeof window==='undefined')return '/onboarding';const v=new URLSearchParams(window.location.search).get('next');return v?.startsWith('/')&&!v.startsWith('//')?v:'/onboarding'}

export default function LoginPage(){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(''),[message,setMessage]=useState('');
  async function oauth(provider:'google'|'github'){
    setLoading(provider);setMessage('');
    const supabase=createClient(),next=safeNext();
    const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`}});
    if(error){setMessage(error.message);setLoading('')}
  }
  async function emailAuth(mode:'signin'|'signup'){
    if(!email||password.length<6){setMessage('Введите email и пароль минимум из 6 символов.');return}
    setLoading(mode);setMessage('');const supabase=createClient();
    if(mode==='signin'){
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error){setMessage(error.message);setLoading('');return}
      window.location.href=safeNext();return;
    }
    const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`}});
    if(error){setMessage(error.message);setLoading('');return}
    if(data.session){window.location.href=safeNext();return}
    setMessage('Аккаунт создан. Подтвердите email по ссылке в письме.');setLoading('');
  }
  return <div className="onboarding"><aside className="onboard-aside"><Link href="/" className="brand"><img src="/brand/radar.svg" alt=""/>JobPilot</Link><div><div className="eyebrow">ВАШ ПРОФИЛЬ</div><h1>Один вход.<br/>Весь поиск<br/><span>под контролем.</span></h1><p>Сохраняйте профиль, вакансии и отклики между устройствами.</p></div><span className="onboard-foot">JobPilot · ранний доступ</span></aside><main className="onboard-main"><div className="onboard-top"><Link href="/" className="back-link"><ArrowLeft size={16}/> На главную</Link><span>Вход и регистрация</span></div><div className="onboard-form"><div className="form-icon"><Mail/></div><h2>Войти в JobPilot</h2><p className="form-intro">Продолжите через Google или GitHub либо используйте email.</p><div className="auth-social"><button className="btn ghost" disabled={!!loading} onClick={()=>void oauth('google')}>{loading==='google'?<LoaderCircle className="spin" size={18}/>:<span className="google-mark">G</span>} Google</button><button className="btn ghost" disabled={!!loading} onClick={()=>void oauth('github')}>{loading==='github'?<LoaderCircle className="spin" size={18}/>:<GitHubMark/>} GitHub</button></div><div className="auth-divider"><span>или</span></div><label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label className="field"><span>Пароль</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 6 символов"/></label>{message&&<p className="error-box" role="status">{message}</p>}<div className="form-actions auth-actions"><button className="btn ghost" disabled={!!loading} onClick={()=>void emailAuth('signup')}>Создать аккаунт</button><button className="btn primary" disabled={!!loading} onClick={()=>void emailAuth('signin')}>{loading==='signin'?<LoaderCircle className="spin" size={17}/>:null} Войти</button></div><p className="field-hint">Продолжая, вы создаёте аккаунт JobPilot. Платёжные данные не требуются.</p></div></main></div>
}
