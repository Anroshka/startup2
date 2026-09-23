"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Plus,
  ArrowUpRight,
  Bookmark,
  Check,
  MapPin,
  ArrowRight,
  Columns3,
  FileText,
  UserRound,
  Settings2,
  LogOut,
  Download,
  LoaderCircle,
  Radar,
  ChevronRight,
  CalendarDays,
  ExternalLink,
  Copy,
  Info,
  Trash2,
  Sparkles,
  RefreshCw,
  BadgeCheck,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import { diffWordsWithSpace } from "diff";
import { Choice } from "@/app/onboarding/onboarding";
import { useProduct } from "@/lib/use-product";
import {
  demoJobs,
  demoProfile,
  emptyState,
  skillMatch,
  score,
  salary,
  newApplication,
  statuses,
  jobSchema,
  type Job,
  type Application,
  type AiAnalysis,
  type ProductState,
} from "@/lib/product";
const nav = [
  ["vacancies", "Мой поиск", Radar],
  ["saved", "Сохранённое", Bookmark],
  ["tracker", "Отклики", Columns3],
  ["documents", "Мои документы", FileText],
  ["profile", "Мой профиль", UserRound],
] as const;
function download(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workspace({
  signedIn,
  initialDemo = false,
  initialView,
}: {
  signedIn: boolean;
  initialDemo?: boolean;
  initialView?: string;
}) {
  const product = useProduct(signedIn);
  const [demo, setDemo] = useState(!signedIn || initialDemo),
    [demoState, setDemoState] = useState<ProductState>({
      ...emptyState,
      profile: demoProfile,
    }),
    [view, setView] = useState(() =>
      nav.some((item) => item[0] === initialView) ? initialView! : "vacancies",
    ),
    [query, setQuery] = useState(""),
    [format, setFormat] = useState("Любой"),
    [source, setSource] = useState("all"),
    [selected, setSelected] = useState<Job | null>(null),
    [detailTab, setDetailTab] = useState("match"),
    [addOpen, setAddOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [accountDeleteOpen, setAccountDeleteOpen] = useState(false),
    [accountConfirmation, setAccountConfirmation] = useState(""),
    [deletingAccount, setDeletingAccount] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false),
    [working, setWorking] = useState(false),
    [remoteJobs, setRemoteJobs] = useState<Job[]>([]),
    [searchPage, setSearchPage] = useState(0),
    [searchPages, setSearchPages] = useState(0),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(""),
    [foundJobs, setFoundJobs] = useState(0),
    [fullJobLoading, setFullJobLoading] = useState(false),
    [aiBusy, setAiBusy] = useState<"" | "analysis" | "letter" | "resume">("");
  const [letter, setLetter] = useState(""),
    [resume, setResume] = useState(""),
    [notes, setNotes] = useState(""),
    [date, setDate] = useState(""),
    [dirty, setDirty] = useState(false);
  const state = demo ? demoState : product.state,
    profile = state.profile;
  const jobs = useMemo(() => {
    const all = [...state.jobs, ...remoteJobs, ...(demo ? demoJobs : [])];
    return [...new Map(all.map((job) => [job.id, job])).values()];
  }, [state.jobs, remoteJobs, demo]);
  const busy = working || product.saving || !!aiBusy;
  const resumeChanges = useMemo(
    () => reviewOpen ? diffWordsWithSpace(profile?.resume || "", resume) : [],
    [reviewOpen, profile?.resume, resume],
  );
  const writing = useRef(false);
  const autoSearched = useRef(false);
  const profileRole = profile?.role;
  useEffect(() => {
    if (demo || product.loading || !profileRole || autoSearched.current) return;
    autoSearched.current = true;
    const timer = window.setTimeout(() => {
      setQuery(profileRole);
      void searchJobs(profileRole);
    }, 0);
    return () => window.clearTimeout(timer);
    // searchJobs intentionally uses the latest loaded profile for the one-time initial search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, product.loading, profileRole]);
  async function persist(next: ProductState, message?: string) {
    if (writing.current || working || product.saving) return false;
    writing.current = true;
    setWorking(true);
    try {
      if (demo) setDemoState(next);
      else await product.save(next);
      if (message) toast.success(message);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    } finally {
      writing.current = false;
      setWorking(false);
    }
  }
  function current(j: Job) {
    return state.applications.find((a) => a.jobId === j.id);
  }
  function openJob(j: Job, tab = "match") {
    const a = current(j);
    setSelected(j);
    setDetailTab(tab);
    setLetter(a?.letter || "");
    setResume(a?.resume || "");
    setNotes(a?.notes || "");
    setDate(a?.nextDate || "");
    setDirty(false);
    if (j.source === "hh" && j.sourceId) void loadFullJob(j.sourceId, j.id);
  }
  async function loadFullJob(sourceId: string, id: string) {
    setFullJobLoading(true);
    try {
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(sourceId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !body.job)
        throw new Error(body.error || "Не удалось загрузить вакансию.");
      setSelected((current) => (current?.id === id ? body.job! : current));
      setRemoteJobs((current) =>
        current.map((job) => (job.id === id ? body.job! : job)),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить вакансию.",
      );
    } finally {
      setFullJobLoading(false);
    }
  }
  async function searchJobs(text = query, page = 0) {
    if (!profile || demo) return;
    if (text.trim().length < 2) {
      setSearchError("Введите должность или ключевые слова.");
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          city: profile.city,
          salary: profile.salary,
          experience: profile.experience,
          format: profile.format,
          page,
        }),
      });
      const body = (await response.json()) as {
        jobs?: Job[];
        found?: number;
        page?: number;
        pages?: number;
        error?: string;
      };
      if (!response.ok || !body.jobs)
        throw new Error(body.error || "Не удалось выполнить поиск.");
      setRemoteJobs(body.jobs);
      setFoundJobs(body.found || body.jobs.length);
      setSearchPage(body.page ?? page);
      setSearchPages(body.pages ?? 0);
    } catch (error) {
      setRemoteJobs([]);
      setFoundJobs(0);
      setSearchPages(0);
      setSearchError(
        error instanceof Error ? error.message : "Не удалось выполнить поиск.",
      );
    } finally {
      setSearching(false);
    }
  }
  async function storeApplication(
    j: Job,
    patch: Partial<Application>,
    message = "Сохранено",
  ) {
    const a = current(j) || newApplication(j.id);
    const status = patch.status || a.status;
    const updated = {
      ...a,
      ...patch,
      updatedAt: new Date().toISOString(),
      history:
        status === a.status
          ? a.history
          : [...a.history, { status, date: new Date().toISOString() }].slice(
              -100,
            ),
    };
    return persist(
      {
        ...state,
        jobs:
          !demo &&
          j.source === "hh" &&
          !state.jobs.some((job) => job.id === j.id)
            ? [j, ...state.jobs]
            : state.jobs,
        applications: [
          ...state.applications.filter((x) => x.jobId !== j.id),
          updated,
        ],
      },
      message,
    );
  }
  async function saveDetails() {
    if (!selected) return;
    const ok = await storeApplication(
      selected,
      {
        letter,
        resume,
        notes,
        nextDate: date,
        ...((letter || resume) &&
        (!current(selected) || current(selected)?.status === "Сохранено")
          ? { status: "Готовится" as const }
          : {}),
      },
      demo ? "Изменения применены в демо" : "Документы и заметки сохранены",
    );
    if (ok) setDirty(false);
  }
  async function runAi(type: "analysis" | "letter" | "resume") {
    if (demo) {
      toast.info("AI-функции доступны после входа в JobPilot.");
      return;
    }
    if (!profile) {
      toast.error("Сначала заполните профиль.");
      return;
    }
    if (!selected) return;
    setAiBusy(type);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, profile, job: selected }),
      });
      const body = (await response.json()) as {
        text?: string;
        analysis?: AiAnalysis;
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "AI-сервис временно недоступен.");
      if (type === "analysis") {
        if (!body.analysis) throw new Error("AI вернул неполный разбор.");
        await storeApplication(
          selected,
          { analysis: body.analysis },
          "AI-разбор готов",
        );
      } else {
        if (!body.text) throw new Error("AI вернул пустой текст.");
        if (type === "letter") setLetter(body.text);
        else setResume(body.text);
        setDirty(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "AI-сервис временно недоступен.",
      );
    } finally {
      setAiBusy("");
    }
  }
  const visible = jobs
    .filter((j) => format === "Любой" || j.format === format)
    .filter(
      (j) =>
        source === "all" ||
        (source === "hh" ? j.source === "hh" : j.source !== "hh"),
    )
    .filter((j) => view !== "saved" || !!current(j))
    .sort((a, b) => score(profile, b) - score(profile, a));
  const agentState = useRef({ jobs, profile, openJob });
  agentState.current = { jobs, profile, openJob };
  useEffect(() => {
    type Tool = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            opts: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      try {
        Promise.resolve(
          ctx.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "list_job_matches",
      title: "Показать соответствие вакансий",
      description:
        "Вернуть вакансии и число навыков из текущего профиля. Не сохраняет и не отправляет отклики.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw new Error("Ожидается пустой объект");
        return agentState.current.jobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          demo: j.demo,
          matched: skillMatch(agentState.current.profile, j).filter(
            (m) => m.matched,
          ).length,
          required: j.skills.length,
        }));
      },
    });
    register({
      name: "open_job_detail",
      title: "Открыть разбор вакансии",
      description: "Открыть панель вакансии для проверки. Не создаёт отклик.",
      inputSchema: {
        type: "object",
        properties: { jobId: { type: "string" } },
        required: ["jobId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).some((k) => k !== "jobId") ||
          !("jobId" in input) ||
          typeof input.jobId !== "string"
        )
          throw new Error("Нужен jobId");
        const j = agentState.current.jobs.find((j) => j.id === input.jobId);
        if (!j) throw new Error("Вакансия не найдена");
        agentState.current.openJob(j);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return { opened: j.id };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const count = (status: string) =>
    state.applications.filter((a) => a.status === status).length;
  return (
    <SidebarProvider
      className="workspace"
      style={{ "--sidebar-width": "246px" } as React.CSSProperties}
    >
      <Toaster richColors position="top-center" />
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <Link href="/" className="brand">
            <img src="/brand/radar.svg" alt="" />
            JobPilot
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
          <SidebarMenu>
            {nav.map(([id, label, Icon]) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={view === id}
                  onClick={() => setView(id)}
                  className="app-nav"
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {id === "saved" && state.applications.length > 0 && (
                    <b>{state.applications.length}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-tip">
            <Radar size={22} />
            <h3>Ваш следующий шаг</h3>
            <p>
              {profile
                ? "Обновите поиск — покажем свежие вакансии с hh.ru под ваши условия."
                : "Заполните профиль, чтобы сравнивать вакансии с вашим опытом."}
            </p>
            {profile ? (
              <button onClick={() => void searchJobs(query || profile.role)}>
                Найти вакансии <ArrowRight size={14} />
              </button>
            ) : (
              <Link href="/onboarding">
                Настроить профиль <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-user">
            <span>{profile?.name.charAt(0) || "Я"}</span>
            <div>
              <strong>{profile?.name || "Мой аккаунт"}</strong>
              <small>{demo ? "Демонстрационный режим" : "Ранний доступ"}</small>
            </div>
            <button
              onClick={() => setView("profile")}
              aria-label="Открыть профиль"
            >
              <Settings2 size={17} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="app-inset">
        <header className="app-topbar">
          <div>
            <SidebarTrigger aria-label="Открыть меню" />
            <span>Рабочее пространство</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n[0] === view)?.[1]}</strong>
          </div>
          <div>
            <span className="prototype-tag">BETA</span>
            <Link href="/" className="home-link">
              На сайт <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <Info size={16} />
            <span>
              Демо: вымышленные вакансии. Изменения действуют до перезагрузки.
            </span>
            {signedIn ? (
              <button
                onClick={() => {
                  setDemo(false);
                  window.history.replaceState(null, "", "/app");
                }}
              >
                Мой кабинет <ArrowRight size={15} />
              </button>
            ) : (
              <a href="/login?next=%2Fonboarding" target="_top">
                Войти и сохранить <ArrowRight size={15} />
              </a>
            )}
          </div>
        )}
        <main className="app-main">
          {!demo && product.loading ? (
            <div className="app-loading">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !demo && product.error ? (
            <div className="error-box" role="alert">
              {product.error}
              <br />
              <button className="btn ghost" onClick={product.reload}>
                Попробовать снова
              </button>
            </div>
          ) : (
            <>
              {!profile && (
                <div className="setup-banner">
                  <div>
                    <strong>Давайте настроим ваш поиск</strong>
                    <p>Сначала добавьте навыки и желаемую должность.</p>
                  </div>
                  <Link href="/onboarding" className="btn primary">
                    Заполнить профиль <ArrowRight size={16} />
                  </Link>
                </div>
              )}
              {(view === "vacancies" || view === "saved") && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {view === "saved"
                          ? "ВАШ КОРОТКИЙ СПИСОК"
                          : "ДВИГАЕМСЯ К СЛЕДУЮЩЕМУ ШАГУ"}
                      </div>
                      <h1>
                        {view === "saved"
                          ? "Сохранённое"
                          : profile
                            ? `${profile.name}, всё начинается здесь.`
                            : "Мой поиск"}
                      </h1>
                      <p>
                        {view === "saved"
                          ? "Возможности, к которым стоит вернуться."
                          : "Подходящие вакансии и понятный план действий."}
                      </p>
                    </div>
                    <div className="heading-actions">
                      {!demo && (
                        <button
                          className="btn primary"
                          disabled={!profile || searching}
                          onClick={() =>
                            void searchJobs(query || profile?.role || "")
                          }
                        >
                          {searching ? (
                            <LoaderCircle className="spin" size={18} />
                          ) : (
                            <RefreshCw size={18} />
                          )}
                          {searching ? "Ищем…" : "Обновить с hh.ru"}
                        </button>
                      )}
                      <button
                        className="btn ghost"
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus size={18} /> Добавить по ссылке
                      </button>
                    </div>
                  </div>
                  <div className="stat-grid">
                    <div>
                      <span>Вакансий в поиске</span>
                      <strong>{jobs.length.toString().padStart(2, "0")}</strong>
                      <small>
                        {demo
                          ? `${demoJobs.length} примеров`
                          : `${remoteJobs.length} с hh.ru · ${state.jobs.length} сохранено`}
                      </small>
                    </div>
                    <div>
                      <span>В работе</span>
                      <strong>
                        {state.applications
                          .filter((a) => !["Архив", "Отказ"].includes(a.status))
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <small>сохранённые и активные отклики</small>
                    </div>
                    <div>
                      <span>Интервью</span>
                      <strong>
                        {count("Интервью").toString().padStart(2, "0")}
                      </strong>
                      <small>следующий шаг навстречу</small>
                    </div>
                    <div>
                      <span>Офферы</span>
                      <strong>
                        {count("Оффер").toString().padStart(2, "0")}
                      </strong>
                      <small>есть из чего выбирать</small>
                    </div>
                  </div>
                  <form
                    className="list-toolbar"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void searchJobs();
                    }}
                  >
                    <div className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Поиск вакансий"
                        placeholder="Должность или ключевые слова"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger
                        aria-label="Фильтр формата"
                        className="filter-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Любой", "Удалённо", "Гибрид", "Офис"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v === "Любой" ? "Любой формат" : v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!demo && (
                      <button
                        className="btn primary search-submit"
                        type="submit"
                        disabled={!profile || searching}
                      >
                        {searching ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Search size={17} />
                        )}
                        Найти
                      </button>
                    )}
                  </form>
                  {searchError && (
                    <div className="integration-error" role="alert">
                      <Info size={17} />
                      <span>{searchError}</span>
                    </div>
                  )}
                  <Tabs value={source} onValueChange={setSource}>
                    <div className="list-heading">
                      <TabsList variant="line">
                        <TabsTrigger value="all">Все вакансии</TabsTrigger>
                        {!demo && <TabsTrigger value="hh">hh.ru</TabsTrigger>}
                        <TabsTrigger value="own">Добавленные</TabsTrigger>
                      </TabsList>
                      <span>
                        {visible.length} в списке
                        {!demo && foundJobs > 0
                          ? ` · ${foundJobs.toLocaleString("ru-RU")} найдено`
                          : ""}
                      </span>
                    </div>
                  </Tabs>
                  <div className="jobs-grid">
                    {visible.map((j) => {
                      const match = score(profile, j),
                        a = current(j);
                      return (
                        <article key={j.id} className="job-card">
                          <div className="job-card-top">
                            <span
                              className={
                                "job-avatar tone-" + (j.company.length % 4)
                              }
                            >
                              {j.company.charAt(0)}
                            </span>
                            <div>
                              <strong>{j.company}</strong>
                              <span>
                                {j.demo
                                  ? "Демо-вакансия"
                                  : j.source === "hh"
                                    ? "hh.ru"
                                    : "Добавлено вручную"}
                                {j.companyTrusted && (
                                  <BadgeCheck
                                    size={13}
                                    aria-label="Компания проверена"
                                  />
                                )}
                              </span>
                            </div>
                            <button
                              aria-label={
                                a
                                  ? "Открыть сохранённую вакансию"
                                  : "Сохранить " + j.title
                              }
                              className={
                                "bookmark-btn " + (a ? "is-saved" : "")
                              }
                              disabled={busy}
                              onClick={() =>
                                a ? openJob(j) : void storeApplication(j, {})
                              }
                            >
                              <Bookmark
                                size={19}
                                fill={a ? "currentColor" : "none"}
                              />
                            </button>
                          </div>
                          <button
                            className="job-title"
                            onClick={() => openJob(j)}
                          >
                            {j.title}
                          </button>
                          <p className="job-salary">
                            {salary(j)}
                            {(j.salaryMin > 0 || j.salaryMax > 0) && (
                              <small>
                                {j.salaryGross
                                  ? " до вычета налогов"
                                  : " на руки"}
                              </small>
                            )}
                          </p>
                          <div className="job-meta">
                            <span>
                              <MapPin size={13} />
                              {j.city || "Город не указан"}
                            </span>
                            <span>{j.format}</span>
                            <span>{j.experience}</span>
                          </div>
                          <div className="job-skills">
                            {j.skills.slice(0, 3).map((s) => (
                              <span key={s}>{s}</span>
                            ))}
                          </div>
                          <div className="job-card-bottom">
                            <span
                              className={
                                match > 60 ? "match-good" : "match-neutral"
                              }
                            >
                              {match > 60 ? (
                                <Check size={14} />
                              ) : (
                                <Radar size={14} />
                              )}{" "}
                              {j.skills.length ? <>{skillMatch(profile, j).filter((m) => m.matched).length} из {j.skills.length} навыков</> : "Навыки не указаны"}
                            </span>
                            <button onClick={() => openJob(j)}>
                              Подробнее <ArrowUpRight size={16} />
                            </button>
                          </div>
                          {a && <div className="job-status">{a.status}</div>}
                        </article>
                      );
                    })}
                  </div>
                  {!demo && source !== "own" && searchPages > 1 && (
                    <nav className="search-pagination" aria-label="Страницы вакансий">
                      <button
                        className="btn ghost"
                        disabled={searching || searchPage === 0}
                        onClick={() => void searchJobs(query || profile?.role || "", searchPage - 1)}
                      >
                        Предыдущая
                      </button>
                      <span>Страница {searchPage + 1} из {searchPages}</span>
                      <button
                        className="btn ghost"
                        disabled={searching || searchPage + 1 >= searchPages}
                        onClick={() => void searchJobs(query || profile?.role || "", searchPage + 1)}
                      >
                        Следующая
                      </button>
                    </nav>
                  )}
                  {!visible.length && !searching && (
                    <div className="empty-state">
                      <Search size={32} />
                      <h3>
                        {view === "saved"
                          ? "Здесь будет ваш короткий список"
                          : "Ничего не нашлось"}
                      </h3>
                      <p>
                        {view === "saved"
                          ? "Нажмите закладку у интересной вакансии."
                          : searchError
                            ? "Проверьте подключение hh.ru или добавьте вакансию вручную."
                            : "Введите должность и запустите поиск по hh.ru."}
                      </p>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setQuery("");
                          setFormat("Любой");
                          setSource("all");
                          setView("vacancies");
                        }}
                      >
                        Открыть все вакансии
                      </button>
                    </div>
                  )}
                  <p className="catalog-note">
                    <Info size={14} />{" "}
                    {demo
                      ? "Демо-каталог содержит вымышленные вакансии."
                      : "Вакансии получены через API hh.ru. Сохраните интересные позиции, чтобы они остались в вашем профиле."}
                  </p>
                </>
              )}
              {view === "tracker" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">ВСЁ ПОД КОНТРОЛЕМ</div>
                      <h1>Путь до оффера.</h1>
                      <p>Меняйте этапы после общения с работодателем.</p>
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() =>
                        download(
                          "jobpilot-history.json",
                          JSON.stringify(state.applications, null, 2),
                          "application/json",
                        )
                      }
                    >
                      <Download size={17} /> Выгрузить историю
                    </button>
                  </div>
                  {!state.applications.length ? (
                    <div className="empty-state">
                      <Columns3 size={35} />
                      <h3>Первый отклик — впереди</h3>
                      <p>Сохраните вакансию, чтобы начать вести её историю.</p>
                      <button
                        className="btn primary"
                        onClick={() => setView("vacancies")}
                      >
                        Выбрать вакансию <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <div className="kanban">
                      {statuses.map((status) => (
                        <section className="kanban-column" key={status}>
                          <h2>
                            <span
                              className={
                                "status-dot status-" + statuses.indexOf(status)
                              }
                            />
                            {status}
                            <small>{count(status)}</small>
                          </h2>
                          {state.applications
                            .filter((a) => a.status === status)
                            .map((a) => {
                              const j = jobs.find((j) => j.id === a.jobId);
                              if (!j) return null;
                              return (
                                <article key={a.jobId} className="kanban-card">
                                  <span>
                                    {j.company}
                                    {j.demo ? " · демо" : ""}
                                  </span>
                                  <button
                                    onClick={() => openJob(j, "activity")}
                                  >
                                    {j.title}
                                  </button>
                                  {a.nextDate && (
                                    <p>
                                      <CalendarDays size={13} />
                                      {new Date(
                                        a.nextDate + "T12:00:00",
                                      ).toLocaleDateString("ru-RU")}
                                    </p>
                                  )}
                                  <Select
                                    value={a.status}
                                    disabled={busy}
                                    onValueChange={(v) =>
                                      void storeApplication(
                                        j,
                                        { status: v as Application["status"] },
                                        "Этап обновлён",
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      aria-label={"Статус " + j.title}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statuses.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {s}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </article>
                              );
                            })}
                          {!count(status) && (
                            <div className="kanban-empty">Пока пусто</div>
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                  <p className="catalog-note">
                    Изменение статуса не отправляет отклик работодателю.
                    Отправляйте проверенные документы на выбранной площадке.
                  </p>
                </>
              )}
              {view === "documents" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">ТОЧНО ПОД ПОЗИЦИЮ</div>
                      <h1>Мои документы.</h1>
                      <p>Сохранённые версии резюме и сопроводительных писем.</p>
                    </div>
                  </div>
                  {state.applications.some((a) => a.letter || a.resume) ? (
                    <div className="document-grid">
                      {state.applications
                        .filter((a) => a.letter || a.resume)
                        .map((a) => {
                          const j = jobs.find((j) => j.id === a.jobId)!;
                          return (
                            <article className="document-card" key={a.jobId}>
                              <FileText size={27} />
                              <h3>{j.title}</h3>
                              <p>{j.company}</p>
                              <span>
                                {[
                                  a.letter ? "Письмо" : "",
                                  a.resume ? "Резюме" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              <button
                                className="btn ghost"
                                onClick={() =>
                                  openJob(j, a.letter ? "letter" : "resume")
                                }
                              >
                                Открыть документы <ArrowUpRight size={16} />
                              </button>
                            </article>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <FileText size={36} />
                      <h3>У каждого отклика — свой акцент</h3>
                      <p>
                        Откройте вакансию и создайте черновик письма или резюме.
                      </p>
                      <button
                        className="btn primary"
                        onClick={() => setView("vacancies")}
                      >
                        Выбрать вакансию
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "profile" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">ОСНОВА ВАШЕГО ПОИСКА</div>
                      <h1>Мой профиль.</h1>
                      <p>Опыт и условия, на которые ориентируется JobPilot.</p>
                    </div>
                    <Link href="/onboarding" className="btn primary">
                      Редактировать <ArrowUpRight size={17} />
                    </Link>
                  </div>
                  {profile && (
                    <div className="profile-layout">
                      <div className="profile-summary">
                        <span className="profile-avatar">
                          {profile.name.charAt(0)}
                        </span>
                        <h3>{profile.name}</h3>
                        <p>{profile.role}</p>
                        <dl>
                          {[
                            ["Город", profile.city],
                            ["Формат", profile.format],
                            [
                              "Зарплата",
                              `от ${profile.salary.toLocaleString("ru-RU")} ₽ на руки`,
                            ],
                            ["Опыт", profile.experience],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="profile-details">
                        <h3>Навыки</h3>
                        <p>{profile.skills || "Пока не добавлены"}</p>
                        <h3>Опыт</h3>
                        <p>{profile.resume || "Пока не добавлен"}</p>
                        <h3>Предпочтения</h3>
                        <p>{profile.preferences || "Не указаны"}</p>
                      </div>
                    </div>
                  )}
                  <div className="account-actions">
                    <button
                      className="btn ghost"
                      onClick={() =>
                        download(
                          "jobpilot-data.json",
                          JSON.stringify(state, null, 2),
                          "application/json",
                        )
                      }
                    >
                      <Download size={17} /> Скачать мои данные
                    </button>
                    {!demo && (
                      <form action="/auth/signout" method="post">
                        <button className="btn ghost" type="submit">
                          <LogOut size={17} /> Выйти
                        </button>
                      </form>
                    )}
                    {!demo && (
                      <button className="btn ghost" onClick={() => setAccountDeleteOpen(true)}>
                        <Trash2 size={17} /> Удалить аккаунт и данные
                      </button>
                    )}
                  </div>
                  <div className="prototype-info">
                    <Info size={19} />
                    <p>
                      Профиль, сохранённые вакансии, документы и этапы откликов
                      хранятся в вашем аккаунте. Поиск работает через hh.ru, а
                      AI-разбор и документы — через OpenRouter в режиме beta.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </SidebarInset>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            if (dirty) {
              toast.info(
                "Сначала сохраните изменения или нажмите «Закрыть без сохранения».",
              );
              return;
            }
            setSelected(null);
          }
        }}
      >
        <SheetContent className="job-sheet" showCloseButton={!dirty}>
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
            <SheetDescription>
              {selected?.company} ·{" "}
              {selected?.demo
                ? "Демонстрационная вакансия"
                : selected?.source === "hh"
                  ? "hh.ru"
                  : "Добавлена вручную"}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <>
              <div className="detail-summary">
                <strong>{salary(selected)}</strong>
                <span>
                  {selected.city} · {selected.format} · {selected.experience}
                </span>
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть источник <ExternalLink size={14} />
                  </a>
                )}
                {selected.publishedAt && (
                  <small>
                    Опубликована{" "}
                    {new Date(selected.publishedAt).toLocaleDateString("ru-RU")}
                  </small>
                )}
              </div>
              <Tabs
                value={detailTab}
                onValueChange={setDetailTab}
                className="detail-tabs"
              >
                <TabsList variant="line">
                  <TabsTrigger value="match">Разбор</TabsTrigger>
                  <TabsTrigger value="letter">Письмо</TabsTrigger>
                  <TabsTrigger value="resume">Резюме</TabsTrigger>
                  <TabsTrigger value="activity">История</TabsTrigger>
                </TabsList>
                <TabsContent value="match">
                  <h3>Что предстоит делать</h3>
                  {fullJobLoading ? (
                    <div className="detail-loading">
                      <LoaderCircle className="spin" size={18} /> Загружаем
                      полное описание с hh.ru…
                    </div>
                  ) : (
                    <p className="description-text">
                      {selected.description || "Описание пока не добавлено."}
                    </p>
                  )}
                  {current(selected)?.analysis ? (
                    <>
                      <AiAnalysisView analysis={current(selected)!.analysis!} />
                      <button className="btn ghost" disabled={demo || !profile || !!aiBusy || fullJobLoading} onClick={() => void runAi("analysis")}>Обновить разбор после изменения профиля</button>
                    </>
                  ) : (
                    <div className="ai-callout">
                      <div>
                        <Sparkles size={19} />
                        <span>
                          <strong>AI-разбор beta</strong>
                          <small>
                            Сравнит вакансию с опытом без выдуманных фактов.
                          </small>
                        </span>
                      </div>
                      <button
                        className="btn primary"
                        disabled={demo || !profile || !!aiBusy || fullJobLoading}
                        onClick={() => void runAi("analysis")}
                      >
                        {aiBusy === "analysis" ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        {aiBusy === "analysis"
                          ? "Анализируем…"
                          : demo
                            ? "Доступно после входа"
                            : "Разобрать вакансию"}
                      </button>
                    </div>
                  )}
                  <h3>Соответствие по навыкам</h3>
                  <p className="field-hint">
                    Сравнение с полем «Навыки» вашего профиля. Отсутствующий
                    навык нужно уточнить — это не отказ.
                  </p>
                  <div className="match-list">
                    {skillMatch(profile, selected).map((m) => (
                      <div key={m.skill}>
                        <span>{m.skill}</span>
                        <small
                          className={m.matched ? "match-good" : "match-neutral"}
                        >
                          {m.matched ? <Check size={14} /> : <Info size={14} />}{" "}
                          {m.matched ? "Указан в профиле" : "Нужно уточнить"}
                        </small>
                      </div>
                    ))}
                    {!selected.skills.length && (
                      <p>Добавьте требования вакансии для сопоставления.</p>
                    )}
                  </div>
                  <h3>Ваши условия</h3>
                  <div className="conditions">
                    <p>
                      Формат:{" "}
                      {profile?.format === "Любой" ||
                      profile?.format === selected.format
                        ? "совпадает"
                        : "проверьте формат работы"}
                    </p>
                    <p>
                      Доход:{" "}
                      {!selected.salaryMax
                        ? "верхняя граница не указана"
                        : selected.salaryMax >= (profile?.salary || 0)
                          ? "верхняя граница не ниже вашей цели"
                          : "верхняя граница ниже вашей цели"}
                    </p>
                    <p>
                      Опыт: требуется {selected.experience}. У вас:{" "}
                      {profile?.experience || "не указан"}.
                    </p>
                  </div>
                  <div className="detail-actions">
                    <button
                      className="btn primary"
                      disabled={demo || !profile}
                      onClick={() => {
                        if (!letter) void runAi("letter");
                        setDetailTab("letter");
                      }}
                    >
                      Подготовить письмо <ArrowRight size={17} />
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void storeApplication(selected, {})}
                    >
                      <Bookmark size={17} />
                      {current(selected) ? "Сохранено" : "Сохранить"}
                    </button>
                  </div>
                </TabsContent>
                <TabsContent value="letter">
                  <h3>Сопроводительное письмо</h3>
                  <p className="field-hint">
                    AI-черновик по фактам профиля. Проверьте формулировки перед
                    отправкой работодателю.
                  </p>
                  {!letter ? (
                    <div className="draft-empty">
                      <FileText size={28} />
                      <p>Подготовим основу письма для этой позиции.</p>
                      <button
                        disabled={demo || !profile || !!aiBusy}
                        className="btn primary"
                        onClick={() => void runAi("letter")}
                      >
                        {aiBusy === "letter" ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        {aiBusy === "letter"
                          ? "Пишем…"
                          : demo
                            ? "Доступно после входа"
                            : "Создать через AI"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span className="sr-only">Текст письма</span>
                        <textarea
                          aria-label="Текст письма"
                          rows={15}
                          value={letter}
                          maxLength={20000}
                          onChange={(e) => {
                            setLetter(e.target.value);
                            setDirty(true);
                          }}
                        />
                      </label>
                      <div className="document-actions">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(letter)
                              .then(() => toast.success("Письмо скопировано"))
                              .catch(() =>
                                toast.error(
                                  "Выделите и скопируйте текст вручную.",
                                ),
                              );
                          }}
                        >
                          <Copy size={16} /> Копировать
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() =>
                            download("jobpilot-letter.txt", letter)
                          }
                        >
                          <Download size={16} /> Скачать .txt
                        </button>
                      </div>
                    </>
                  )}
                </TabsContent>
                <TabsContent value="resume">
                  <h3>Резюме под позицию</h3>
                  <p className="field-hint">
                    AI переставит акценты под вакансию, не добавляя выдуманный
                    опыт, навыки или достижения.
                  </p>
                  <p className="field-hint">При генерации текст профиля и вакансии передаётся OpenRouter. Проверьте черновик перед использованием.</p>
                  {!resume ? (
                    <div className="draft-empty">
                      <FileText size={28} />
                      <p>Соберите отдельную версию для этой вакансии.</p>
                      <button
                        disabled={demo || !profile || !!aiBusy}
                        className="btn primary"
                        onClick={() => void runAi("resume")}
                      >
                        {aiBusy === "resume" ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        {aiBusy === "resume"
                          ? "Готовим…"
                          : demo
                            ? "Доступно после входа"
                            : "Подготовить через AI"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <details className="resume-review" onToggle={(event) => setReviewOpen(event.currentTarget.open)}>
                        <summary>Сравнить с исходным резюме и проверить изменения</summary>
                        {reviewOpen && <div className="resume-review-grid">
                          <div><h4>Ваш исходный текст</h4><pre>{profile?.resume || "В профиле нет исходного резюме."}</pre></div>
                          <div><h4>Изменения в черновике</h4><div className="resume-diff">
                            {resumeChanges.map((part, index) => (
                              <span key={index} className={part.added ? "added" : part.removed ? "removed" : ""}>{part.value}</span>
                            ))}
                          </div></div>
                        </div>}
                      </details>
                      <label className="field">
                        <span className="sr-only">Текст резюме</span>
                        <textarea
                          aria-label="Текст резюме"
                          rows={16}
                          value={resume}
                          maxLength={30000}
                          onChange={(e) => {
                            setResume(e.target.value);
                            setDirty(true);
                          }}
                        />
                      </label>
                      <button
                        className="btn ghost"
                        onClick={() => download("jobpilot-resume.txt", resume)}
                      >
                        <Download size={17} /> Скачать .txt
                      </button>
                      <button className="btn ghost" disabled={!!aiBusy || demo || dirty} onClick={() => void runAi("resume")}>Сгенерировать снова</button>
                    </>
                  )}
                </TabsContent>
                <TabsContent value="activity">
                  <h3>Этап отклика</h3>
                  <Select
                    value={current(selected)?.status || "Сохранено"}
                    disabled={busy}
                    onValueChange={(v) =>
                      void storeApplication(
                        selected,
                        { status: v as Application["status"] },
                        "Этап обновлён",
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label="Этап отклика"
                      className="field-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem value={s} key={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="field-hint">
                    Статус «Отправлено» фиксирует ваше действие. JobPilot не
                    отправляет письмо за вас.
                  </p>
                  <label className="field">
                    <span>Следующая встреча или действие</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Заметки</span>
                    <textarea
                      rows={4}
                      value={notes}
                      maxLength={5000}
                      placeholder="Что обсудили и о чём договорились?"
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <h3>История изменений</h3>
                  <div className="activity-list">
                    {current(selected)
                      ?.history.slice()
                      .reverse()
                      .map((h, i) => (
                        <div key={i}>
                          <span>{h.status}</span>
                          <time>
                            {new Date(h.date).toLocaleString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      )) || (
                      <p className="field-hint">
                        История появится после сохранения вакансии.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <div className="sheet-save">
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void saveDetails()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Check size={17} />
                  )}
                  Сохранить изменения
                </button>
                {dirty ? (
                  <button
                    className="discard-btn"
                    onClick={() => {
                      setDirty(false);
                      setSelected(null);
                    }}
                  >
                    Закрыть без сохранения
                  </button>
                ) : (
                  current(selected) && (
                    <button
                      className="delete-btn"
                      aria-label="Удалить отклик"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="add-dialog">
          <DialogHeader>
            <DialogTitle>Добавить вакансию</DialogTitle>
            <DialogDescription>
              Сохраните позицию с любой площадки. Текст и требования заполняются
              вручную.
            </DialogDescription>
          </DialogHeader>
          <AddJob
            busy={busy}
            onAdd={async (j) => {
              const ok = await persist(
                { ...state, jobs: [j, ...state.jobs] },
                "Вакансия добавлена",
              );
              if (ok) {
                setAddOpen(false);
                setSource("own");
                setView("vacancies");
                setQuery("");
                setFormat("Любой");
              }
            }}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отклик из трекера?</AlertDialogTitle>
            <AlertDialogDescription>
              Заметки, история и сохранённые документы этого отклика будут
              удалены. Сама вакансия останется в поиске.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (
                  selected &&
                  (await persist(
                    {
                      ...state,
                      applications: state.applications.filter(
                        (a) => a.jobId !== selected.id,
                      ),
                    },
                    "Отклик удалён",
                  ))
                ) {
                  setDirty(false);
                  setSelected(null);
                }
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={accountDeleteOpen} onOpenChange={setAccountDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт и все данные?</AlertDialogTitle>
            <AlertDialogDescription>Профиль, сохранённые вакансии, разборы, документы и история откликов будут удалены без возможности восстановления. Введите УДАЛИТЬ для подтверждения.</AlertDialogDescription>
          </AlertDialogHeader>
          <input aria-label="Подтверждение удаления аккаунта" value={accountConfirmation} onChange={(e) => setAccountConfirmation(e.target.value)} placeholder="УДАЛИТЬ" autoComplete="off" />
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <button className="btn primary" disabled={deletingAccount || accountConfirmation !== "УДАЛИТЬ"} onClick={async () => {
              setDeletingAccount(true);
              try {
                const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: accountConfirmation }) });
                const body = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(body.error || "Не удалось удалить аккаунт.");
                window.location.href = "/";
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Не удалось удалить аккаунт.");
                setDeletingAccount(false);
              }
            }}>Удалить навсегда</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
function AiAnalysisView({ analysis }: { analysis: AiAnalysis }) {
  const groups = [
    ["Сильные стороны", analysis.strengths, "good"],
    ["Что уточнить", analysis.gaps, "neutral"],
    ["Вопросы работодателю", analysis.questions, "neutral"],
    ["Риски", analysis.risks, "risk"],
  ] as const;
  return (
    <section className="ai-analysis">
      <div className="ai-analysis-head">
        <span>
          <Sparkles size={17} /> AI-разбор
        </span>
        <strong>{analysis.requirements.filter((r) => r.verdict === "confirmed").length} из {analysis.requirements.length} подтверждено</strong>
      </div>
      <p>{analysis.summary}</p>
      {analysis.requirements.length > 0 && (
        <div className="evidence-list">
          <h4>Требования и факты профиля</h4>
          {analysis.requirements.map((item, index) => (
            <div className="evidence-item" key={`${item.requirement}-${index}`}>
              <strong>{item.requirement}</strong>
              <span>{item.verdict === "confirmed" ? "Подтверждено" : item.verdict === "conflict" ? "Противоречие" : "Нужно уточнить"}</span>
              {item.evidence && <blockquote>«{item.evidence}»</blockquote>}
              <p>{item.explanation}</p>
            </div>
          ))}
        </div>
      )}
      <p className="field-hint">Это разбор требований, а не вероятность получить приглашение. Исправьте профиль, если факт указан неверно.</p>
      <div className="ai-analysis-grid">
        {groups.map(([title, items, tone]) =>
          items.length ? (
            <div key={title} data-tone={tone}>
              <h4>{title}</h4>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
      <small>
        Создано{" "}
        {new Date(analysis.generatedAt).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </small>
    </section>
  );
}
function AddJob({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (j: Job) => Promise<void>;
}) {
  const [title, setTitle] = useState(""),
    [company, setCompany] = useState(""),
    [city, setCity] = useState("Москва"),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [format, setFormat] = useState("Удалённо"),
    [skills, setSkills] = useState(""),
    [description, setDescription] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const p = jobSchema.safeParse({
          id: crypto.randomUUID(),
          title,
          company,
          city,
          salaryMin: Number(min),
          salaryMax: Number(max),
          format,
          skills: [
            ...new Set(
              skills
                .split(/[,;\n]/)
                .map((x) => x.trim())
                .filter(Boolean),
            ),
          ],
          description,
          url,
          experience: "Уточнить у работодателя",
          demo: false,
        });
        if (!p.success) {
          setError(p.error.issues[0].message);
          return;
        }
        setError("");
        void onAdd(p.data);
      }}
    >
      <div className="field-pair">
        <label className="field">
          <span>Должность</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={160}
            placeholder="Продуктовый дизайнер"
          />
        </label>
        <label className="field">
          <span>Компания</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            maxLength={100}
            placeholder="Название команды"
          />
        </label>
      </div>
      <div className="field-pair">
        <label className="field">
          <span>Город</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
          />
        </label>
        <Choice
          label="Формат"
          value={format}
          onChange={setFormat}
          options={["Удалённо", "Гибрид", "Офис"]}
        />
      </div>
      <div className="field-pair">
        <label className="field">
          <span>Зарплата от, ₽ на руки</span>
          <input
            type="number"
            value={min}
            min={0}
            max={10000000}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Не указана"
          />
        </label>
        <label className="field">
          <span>Зарплата до, ₽ на руки</span>
          <input
            type="number"
            value={max}
            min={0}
            max={10000000}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Не указана"
          />
        </label>
      </div>
      <label className="field">
        <span>Требуемые навыки через запятую</span>
        <input
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Figma, SQL, React…"
          maxLength={2000}
        />
      </label>
      <label className="field">
        <span>Описание</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={15000}
          placeholder="Вставьте обязанности и требования"
        />
      </label>
      <label className="field">
        <span>
          Ссылка на источник <small>необязательно</small>
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2048}
          placeholder="https://…"
        />
      </label>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={busy} type="submit">
        {busy ? "Сохраняем…" : "Добавить в мой поиск"}
        <Plus size={17} />
      </button>
    </form>
  );
}
