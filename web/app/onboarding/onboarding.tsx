"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Compass,
  SlidersHorizontal,
  FileText,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultProfile, profileSchema, type Profile } from "@/lib/product";
import { useProduct } from "@/lib/use-product";
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="field-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((x) => (
            <SelectItem key={x} value={x}>
              {x}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export default function Onboarding({ signedIn }: { signedIn: boolean }) {
  const { state, loading, error, saving, save, reload } = useProduct(signedIn);
  const [p, setP] = useState<Profile>(defaultProfile),
    [step, setStep] = useState(0),
    [message, setMessage] = useState(""),
    [importNotice, setImportNotice] = useState("");
  const restored = useRef(false),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (loading || error || restored.current) return;
    restored.current = true;
    const restore = () => {
      try {
        const draft = sessionStorage.getItem("jobpilot-onboarding-draft");
        if (draft) {
          setP({ ...defaultProfile, ...JSON.parse(draft) });
          return;
        }
      } catch {}
      if (state.profile) setP(state.profile);
    };
    const timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
  }, [loading, error, state.profile]);
  function field<K extends keyof Profile>(key: K, v: Profile[K]) {
    setP({ ...p, [key]: v });
    setMessage("");
  }
  async function next() {
    setMessage("");
    if (step === 0 && (!p.name.trim() || p.role.trim().length < 2)) {
      setMessage("Укажите имя и желаемую должность.");
      return;
    }
    if (
      step === 1 &&
      (!Number.isFinite(p.salary) || p.salary < 0 || p.salary > 10000000)
    ) {
      setMessage("Укажите зарплату от 0 до 10 000 000 ₽.");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    const parsed = profileSchema.safeParse(p);
    if (!parsed.success) {
      setMessage("Проверьте поля профиля: " + parsed.error.issues[0].message);
      return;
    }
    if (!signedIn) {
      try {
        sessionStorage.setItem("jobpilot-onboarding-draft", JSON.stringify(p));
      } catch {}
      window.location.href = "/login?next=%2Fonboarding";
      return;
    }
    try {
      await save({ ...state, profile: parsed.data });
      sessionStorage.removeItem("jobpilot-onboarding-draft");
      window.location.href = "/app";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось сохранить.");
    }
  }
  return (
    <div className="onboarding">
      <aside className="onboard-aside">
        <Link href="/" className="brand">
          <img src="/brand/radar.svg" alt="" />
          JobPilot
        </Link>
        <div>
          <div className="eyebrow">НАСТРОИМ ВАШ РАДАР</div>
          <h1>
            Хороший поиск
            <br />
            начинается
            <br />
            <span>с вас.</span>
          </h1>
          <p>
            Несколько деталей, чтобы видеть подходящие возможности и не тратить
            время на остальные.
          </p>
        </div>
        <ol>
          {["Ваша цель", "Условия работы", "Опыт и навыки", "Всё готово"].map(
            (s, i) => (
              <li key={s} className={i <= step ? "active" : ""}>
                <span>{i < step ? <Check size={15} /> : i + 1}</span>
                {s}
              </li>
            ),
          )}
        </ol>
        <span className="onboard-foot">
          <ShieldCheck size={16} /> Отправка откликов — только вами
        </span>
      </aside>
      <main className="onboard-main">
        <div className="onboard-top">
          <Link href="/" className="back-link">
            <ArrowLeft size={16} /> На главную
          </Link>
          <span>Шаг {step + 1} из 4</span>
        </div>
        <Progress value={(step + 1) * 25} className="onboard-progress" />
        <div className="onboard-form">
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" /> Загружаем профиль…
            </div>
          ) : error ? (
            <div role="alert" className="error-box">
              {error}
              <button onClick={reload} className="btn ghost">
                Попробовать снова
              </button>
            </div>
          ) : (
            <>
              <div className="form-icon">
                {step === 0 ? (
                  <Compass />
                ) : step === 1 ? (
                  <SlidersHorizontal />
                ) : step === 2 ? (
                  <FileText />
                ) : (
                  <Check />
                )}
              </div>
              <h2>
                {
                  [
                    "Куда хотите двигаться?",
                    "Что для вас важно?",
                    "Расскажите о своём опыте",
                    "Ваш радар настроен.",
                  ][step]
                }
              </h2>
              <p className="form-intro">
                {
                  [
                    "Начнём с имени и позиции, которую вы ищете.",
                    "Эти условия помогут отсеять неподходящие вакансии.",
                    "Используем только те факты, которые вы укажете.",
                    "Проверьте профиль. Все настройки можно изменить позже.",
                  ][step]
                }
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void next();
                }}
              >
                {step === 0 && (
                  <>
                    <label className="field">
                      <span>Как вас зовут?</span>
                      <input
                        autoFocus
                        autoComplete="given-name"
                        value={p.name}
                        maxLength={100}
                        onChange={(e) => field("name", e.target.value)}
                        placeholder="Ваше имя"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Желаемая должность</span>
                      <input
                        value={p.role}
                        maxLength={160}
                        onChange={(e) => field("role", e.target.value)}
                        placeholder="Например, продуктовый дизайнер"
                        required
                        minLength={2}
                      />
                    </label>
                    <div className="suggestions">
                      {[
                        "Продуктовый дизайнер",
                        "Frontend-разработчик",
                        "Аналитик",
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field("role", t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="field-pair">
                      <label className="field">
                        <span>Город</span>
                        <input
                          value={p.city}
                          onChange={(e) => field("city", e.target.value)}
                          maxLength={100}
                          placeholder="Москва"
                        />
                      </label>
                      <label className="field">
                        <span>Зарплата от, ₽ на руки</span>
                        <input
                          type="number"
                          min={0}
                          max={10000000}
                          step={1000}
                          value={p.salary}
                          onChange={(e) =>
                            field("salary", Number(e.target.value))
                          }
                        />
                      </label>
                    </div>
                    <Choice
                      label="Формат работы"
                      value={p.format}
                      onChange={(v) => field("format", v as Profile["format"])}
                      options={["Любой", "Удалённо", "Гибрид", "Офис"]}
                    />
                    <label className="field">
                      <span>
                        Пожелания и ограничения <small>необязательно</small>
                      </span>
                      <textarea
                        value={p.preferences}
                        onChange={(e) => field("preferences", e.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="Например: без командировок, гибкое начало дня"
                      />
                    </label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <Choice
                      label="Опыт работы"
                      value={p.experience}
                      onChange={(v) =>
                        field("experience", v as Profile["experience"])
                      }
                      options={[
                        "Без опыта",
                        "1–3 года",
                        "3–6 лет",
                        "Более 6 лет",
                      ]}
                    />
                    <label className="field">
                      <span>Навыки через запятую</span>
                      <input
                        value={p.skills}
                        onChange={(e) => field("skills", e.target.value)}
                        maxLength={2000}
                        placeholder="Figma, UX-исследования, Прототипирование"
                      />
                    </label>
                    <label className="field">
                      <span>Резюме или описание опыта</span>
                      <textarea
                        value={p.resume}
                        onChange={(e) => field("resume", e.target.value)}
                        rows={6}
                        maxLength={20000}
                        placeholder="Вставьте текст резюме: где работали, какие задачи решали, чего достигли."
                      />
                    </label>
                    <input
                      ref={file}
                      type="file"
                      accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          let text: string;
                          if (f.name.toLowerCase().endsWith(".txt")) {
                            if (f.size > 80_000) throw new Error("Текстовый файл слишком большой (до 80 КБ).");
                            text = await f.text();
                          } else {
                            const data = new FormData();
                            data.set("file", f);
                            const response = await fetch("/api/resume/import", { method: "POST", body: data });
                            const result = (await response.json()) as { text?: string; error?: string };
                            if (!response.ok || !result.text) throw new Error(result.error || "Не удалось прочитать файл.");
                            text = result.text;
                          }
                          if (text.includes("\0") || text.length > 20000) throw new Error("Резюме должно быть короче 20 000 символов.");
                          field("resume", text);
                          setImportNotice("Текст извлечён. Проверьте опыт и навыки перед сохранением.");
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Не удалось импортировать резюме.");
                        }
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="import-text"
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={16} /> Импортировать .txt, PDF или DOCX
                    </button>
                    <p className="field-hint">
                      PDF и DOCX обрабатываются после входа. Оригинальный файл не сохраняется; проверьте извлечённый текст.
                    </p>
                    {importNotice && <p className="field-hint" role="status">{importNotice}</p>}
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="profile-summary">
                      <span className="profile-avatar">
                        {p.name.charAt(0) || "Я"}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.role}</p>
                      <dl>
                        <div>
                          <dt>Город и формат</dt>
                          <dd>
                            {p.city || "Не указан"} · {p.format}
                          </dd>
                        </div>
                        <div>
                          <dt>Зарплата</dt>
                          <dd>
                            от {p.salary.toLocaleString("ru-RU")} ₽ на руки
                          </dd>
                        </div>
                        <div>
                          <dt>Опыт</dt>
                          <dd>{p.experience}</dd>
                        </div>
                        <div>
                          <dt>Навыки</dt>
                          <dd>{p.skills || "Можно добавить позже"}</dd>
                        </div>
                      </dl>
                    </div>
                    <p className="field-hint">
                      JobPilot найдёт свежие вакансии на hh.ru по этой цели и
                      сохранит выбранные позиции в вашем кабинете.
                    </p>
                    {!signedIn && (
                      <p className="signin-note">
                        Для сохранения профиля войдите в JobPilot. Черновик
                        останется в этой вкладке.
                      </p>
                    )}
                  </>
                )}
                {message && (
                  <p className="error-box" role="alert">
                    {message}
                  </p>
                )}
                <div className="form-actions">
                  {step > 0 ? (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setStep(step - 1)}
                    >
                      <ArrowLeft size={17} /> Назад
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    disabled={saving}
                    className="btn primary"
                    type="submit"
                  >
                    {saving
                      ? "Сохраняем…"
                      : step === 3
                        ? signedIn
                          ? "Открыть мой поиск"
                          : "Войти и сохранить"
                        : "Продолжить"}{" "}
                    {saving ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        <div className="onboard-bottom">
          Ваш поиск. Ваши условия. Ваш следующий шаг.
        </div>
      </main>
    </div>
  );
}
