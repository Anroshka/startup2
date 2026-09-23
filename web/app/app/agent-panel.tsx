"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { defaultAgentConfig, type AgentConfig } from "@/lib/agent-config";

type Attempt = { vacancy_id: string; title: string; company: string; status: string; reason: string; created_at: string };
type AgentData = { connected: boolean; config: AgentConfig; resumes: { id: string; title: string }[]; attempts: Attempt[]; error?: string };

export default function AgentPanel({ hasProfile }: { hasProfile: boolean }) {
  const [data, setData] = useState<AgentData | null>(null);
  const [config, setConfig] = useState<AgentConfig>(defaultAgentConfig);
  const [blocked, setBlocked] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", { cache: "no-store" });
      const body = await response.json() as AgentData;
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить агента.");
      setData(body);
      setConfig(body.config);
      setBlocked(body.config.blockedCompanies.join(", "));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки"); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function save(enabled: boolean) {
    setBusy(true);
    try {
      const next = { ...config, enabled, blockedCompanies: blocked.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) };
      const response = await fetch("/api/agent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Не удалось сохранить настройки.");
      await load();
      toast.success(enabled ? "Агент включён. Следующий запуск в 08:00 UTC." : "Агент остановлен. Настройки сохранены.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка сохранения"); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/agent", { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось отключить hh.ru.");
      await load(); toast.success("Аккаунт hh.ru отключён, агент остановлен.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка отключения"); }
    finally { setBusy(false); }
  }

  return <div className="agent-page">
    <div className="page-heading"><div><div className="eyebrow">ПОИСК И ОТКЛИКИ</div><h1>Агент автоотклика.</h1><p>Ищет вакансии по вашему профилю и откликается через подключённый аккаунт hh.ru.</p></div></div>
    <div className="agent-card">
      <h2>Подключение и правила</h2>
      <p>Агент выключен по умолчанию. Он использует опубликованное резюме hh.ru и сведения из профиля JobPilot. При включении он получает право отправлять отклики без отдельного подтверждения каждого письма.</p>
      {!data ? <p>Загружаем настройки…</p> : !data.connected ? <a className="btn primary" href="/api/agent/hh/connect">Подключить hh.ru</a> : <>
        <p className="agent-connected">Аккаунт hh.ru подключён. {config.enabled ? "Агент работает." : "Агент остановлен."}</p>
        <div className="agent-fields">
          <label>Резюме для отклика<select value={config.resumeId} onChange={(event) => setConfig({ ...config, resumeId: event.target.value })}><option value="">Выберите резюме</option>{data.resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</select></label>
          <label>Откликов в сутки (1–5)<input type="number" min="1" max="5" value={config.dailyLimit} onChange={(event) => setConfig({ ...config, dailyLimit: Number(event.target.value) })} /></label>
          <label>Минимальная зарплата, ₽<input type="number" min="0" step="10000" value={config.minSalary} onChange={(event) => setConfig({ ...config, minSalary: Number(event.target.value) })} /></label>
          <label>Исключить компании (через запятую)<input value={blocked} maxLength={2000} onChange={(event) => setBlocked(event.target.value)} placeholder="Компания А, Компания Б" /></label>
        </div>
        <p>Агент рассматривает только вакансии доверенных работодателей, подходящие по названию роли, формату и навыкам. При заданной зарплате вакансии без указанной суммы пропускаются. Письмо составляется из фактов вашего профиля; проверьте профиль перед включением.</p>
        <div className="agent-actions"><button className="btn primary" disabled={busy || !hasProfile || !config.resumeId} onClick={() => void save(true)}>{config.enabled ? "Сохранить правила" : "Включить автоотклик"}</button><button className="btn ghost" disabled={busy} onClick={() => void save(false)}>Остановить</button><button className="btn ghost" disabled={busy} onClick={() => void disconnect()}>Отключить hh.ru</button></div>
        {!hasProfile && <p>Заполните в профиле роль, навыки и опыт, чтобы включить агента.</p>}
        {!data.resumes.length && <p>Не удалось получить резюме hh.ru. Проверьте, что в аккаунте есть опубликованное резюме, и обновите страницу.</p>}
      </>}
    </div>
    <div className="agent-card"><h2>Журнал решений</h2><p>Повторные отправки по одной вакансии исключены. Если ответ hh.ru неясен, запись остаётся на проверке и агент её не повторяет.</p>
      {!data?.attempts.length ? <p>Пока нет попыток. Агент запускается ежедневно в 08:00 UTC после включения.</p> : <div className="agent-log">{data.attempts.map((attempt) => <div key={attempt.vacancy_id}><strong>{attempt.title}</strong> · {attempt.company}<br/><small>{new Date(attempt.created_at).toLocaleString("ru-RU")} · {attempt.status === "sent" ? "Отправлено" : attempt.status === "skipped" ? "Пропущено" : "Проверьте на hh.ru"} · {attempt.reason}</small> <a href={`https://hh.ru/vacancy/${encodeURIComponent(attempt.vacancy_id)}`} target="_blank" rel="noopener noreferrer">Вакансия ↗</a></div>)}</div>}
    </div>
  </div>;
}
