'use client';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowLeft, Github, LoaderCircle, Mail} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

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
  return <div className="onboarding"><aside className="onboard-aside"><Link href="/" className="brand"><img src="/brand/radar.svg" alt=""/>JobPilot</Link><div><div className="eyebrow">ВАШ ПРОФИЛЬ</div><h1>Один вход.<br/>Весь поиск<br/><span>под контролем.</span></h1><p>Сохраняйте профиль, вакансии и отклики между устройствами.</p></div><span className="onboard-foot">JobPilot · ранний доступ</span></aside><main className="onboard-main"><div className="onboard-top"><Link href="/" className="back-link"><ArrowLeft size={16}/> На главную</Link><span>Вход и регистрация</span></div><div className="onboard-form"><div className="form-icon"><Mail/></div><h2>Войти в JobPilot</h2><p className="form-intro">Продолжите через Google или GitHub либо используйте email.</p><div className="auth-social"><button className="btn ghost" disabled={!!loading} onClick={()=>void oauth('google')}>{loading==='google'?<LoaderCircle className="spin" size={18}/>:<span className="google-mark">G</span>} Google</button><button className="btn ghost" disabled={!!loading} onClick={()=>void oauth('github')}>{loading==='github'?<LoaderCircle className="spin" size={18}/>:<Github size={18}/>} GitHub</button></div><div className="auth-divider"><span>или</span></div><label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label className="field"><span>Пароль</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 6 символов"/></label>{message&&<p className="error-box" role="status">{message}</p>}<div className="form-actions auth-actions"><button className="btn ghost" disabled={!!loading} onClick={()=>void emailAuth('signup')}>Создать аккаунт</button><button className="btn primary" disabled={!!loading} onClick={()=>void emailAuth('signin')}>{loading==='signin'?<LoaderCircle className="spin" size={17}/>:null} Войти</button></div><p className="field-hint">Продолжая, вы создаёте аккаунт JobPilot. Платёжные данные не требуются.</p></div></main></div>
}
