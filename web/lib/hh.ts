import { z } from "zod";
import { jobSchema, type Job } from "./product";

const HH_API = "https://api.hh.ru";
const HH_TIMEOUT_MS = 12_000;

const hhSearchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  alternate_url: z.string().url().nullable().optional(),
  apply_alternate_url: z.string().url().nullable().optional(),
  published_at: z.string().optional(),
  area: z.object({ name: z.string() }).nullable().optional(),
  employer: z
    .object({ name: z.string(), trusted: z.boolean().optional() })
    .nullable()
    .optional(),
  salary: z
    .object({
      from: z.number().nullable(),
      to: z.number().nullable(),
      currency: z.string().nullable(),
      gross: z.boolean().nullable(),
    })
    .nullable()
    .optional(),
  salary_range: z
    .object({
      from: z.number().nullable().optional(),
      to: z.number().nullable().optional(),
      currency: z.string().optional(),
      gross: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  experience: z.object({ name: z.string() }).nullable().optional(),
  schedule: z
    .object({ name: z.string().nullable().optional() })
    .nullable()
    .optional(),
  work_format: z
    .array(z.object({ name: z.string().optional() }))
    .nullable()
    .optional(),
  professional_roles: z
    .array(z.object({ name: z.string().optional() }))
    .optional(),
  snippet: z
    .object({
      requirement: z.string().nullable().optional(),
      responsibility: z.string().nullable().optional(),
    })
    .optional(),
});

const hhVacancySchema = hhSearchItemSchema.extend({
  description: z.string().nullable().optional(),
  key_skills: z
    .array(z.object({ name: z.string() }))
    .nullable()
    .optional(),
});

const hhSearchResponseSchema = z.object({
  found: z.number(),
  page: z.number(),
  pages: z.number(),
  per_page: z.number(),
  items: z.array(hhSearchItemSchema),
});

type HhItem = z.infer<typeof hhSearchItemSchema>;
type HhVacancy = z.infer<typeof hhVacancySchema>;

let applicationToken: string | null = null;
let tokenRequestedAt = 0;

function hhUserAgent() {
  return (
    process.env.HH_USER_AGENT ||
    "JobPilot/0.2 (https://startup2-self.vercel.app)"
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripHhHtml(value: string | null | undefined) {
  if (!value) return "";
  return decodeEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function formatFromHh(item: HhItem): Job["format"] {
  const text = [
    ...(item.work_format || []).map((x) => x.name || ""),
    item.schedule?.name || "",
  ]
    .join(" ")
    .toLocaleLowerCase("ru");
  if (text.includes("гибрид")) return "Гибрид";
  if (text.includes("удален") || text.includes("удалён")) return "Удалённо";
  return "Офис";
}

function salaryFromHh(item: HhItem) {
  const salary = item.salary_range || item.salary;
  return {
    salaryMin: salary?.from || 0,
    salaryMax: salary?.to || 0,
    salaryCurrency: salary?.currency || "RUR",
    salaryGross: Boolean(salary?.gross),
  };
}

export function normalizeHhVacancy(item: HhItem | HhVacancy): Job {
  const detail = "description" in item ? item : null;
  const snippet = [item.snippet?.responsibility, item.snippet?.requirement]
    .map(stripHhHtml)
    .filter(Boolean)
    .join("\n\n");
  const detailSkills =
    detail?.key_skills
      ?.map((skill) => skill.name.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 30) || [];
  const roleSkills =
    item.professional_roles
      ?.map((role) => (role.name || "").trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 30) || [];
  return jobSchema.parse({
    id: `hh:${item.id}`,
    sourceId: item.id,
    source: "hh",
    title: item.name.slice(0, 160),
    company: (item.employer?.name || "Компания не указана").slice(0, 100),
    companyTrusted: item.employer?.trusted || false,
    city: (item.area?.name || "").slice(0, 100),
    ...salaryFromHh(item),
    format: formatFromHh(item),
    experience: (item.experience?.name || "Не указан").slice(0, 60),
    skills: detailSkills.length ? detailSkills : roleSkills,
    description: (stripHhHtml(detail?.description) || snippet).slice(0, 15_000),
    url: (item.alternate_url || "").slice(0, 2048),
    applyUrl: (item.apply_alternate_url || item.alternate_url || "").slice(
      0,
      2048,
    ),
    publishedAt: item.published_at || "",
    demo: false,
  });
}

async function requestApplicationToken() {
  const directToken = process.env.HH_ACCESS_TOKEN?.trim();
  if (directToken) return directToken;

  const clientId = process.env.HH_CLIENT_ID?.trim();
  const clientSecret = process.env.HH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("HH_NOT_CONFIGURED");
  }

  if (applicationToken && Date.now() - tokenRequestedAt < 12 * 60 * 60 * 1000) {
    return applicationToken;
  }

  const response = await fetch(`${HH_API}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "HH-User-Agent": hhUserAgent(),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(HH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HH_TOKEN_${response.status}`);
  const body = z
    .object({ access_token: z.string().min(10) })
    .parse(await response.json());
  applicationToken = body.access_token;
  tokenRequestedAt = Date.now();
  return applicationToken;
}

async function fetchHhJson(path: string, retry = true): Promise<unknown> {
  const token = await requestApplicationToken();
  const response = await fetch(`${HH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "HH-User-Agent": hhUserAgent(),
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(HH_TIMEOUT_MS),
  });
  if (response.status === 401 && retry && !process.env.HH_ACCESS_TOKEN) {
    applicationToken = null;
    return fetchHhJson(path, false);
  }
  if (!response.ok) throw new Error(`HH_API_${response.status}`);
  return response.json();
}

async function resolveArea(city: string) {
  if (city.trim().length < 2) return null;
  const response = z
    .object({
      items: z.array(z.object({ id: z.string(), text: z.string().optional() })),
    })
    .safeParse(
      await fetchHhJson(
        `/suggests/areas?text=${encodeURIComponent(city.trim())}`,
      ),
    );
  return response.success ? response.data.items[0]?.id || null : null;
}

export async function searchHhVacancies(input: {
  text: string;
  city?: string;
  salary?: number;
  experience?: string;
  format?: Job["format"] | "Любой";
  page?: number;
}) {
  const params = new URLSearchParams({
    text: input.text.trim(),
    page: String(input.page || 0),
    per_page: "20",
    order_by: "publication_time",
    responses_count_enabled: "false",
  });
  const area = input.city ? await resolveArea(input.city) : null;
  if (area) params.set("area", area);
  if (input.salary && input.salary > 0) {
    params.set("salary", String(Math.round(input.salary)));
    params.set("currency", "RUR");
  }
  const experienceIds: Record<string, string> = {
    "Без опыта": "noExperience",
    "1–3 года": "between1And3",
    "3–6 лет": "between3And6",
    "Более 6 лет": "moreThan6",
  };
  if (input.experience && experienceIds[input.experience]) {
    params.set("experience", experienceIds[input.experience]);
  }
  const workFormats: Partial<Record<Job["format"], string>> = {
    Удалённо: "REMOTE",
    Гибрид: "HYBRID",
    Офис: "ON_SITE",
  };
  if (input.format && input.format !== "Любой" && workFormats[input.format]) {
    params.set("work_format", workFormats[input.format]!);
  }

  const response = hhSearchResponseSchema.parse(
    await fetchHhJson(`/vacancies?${params}`),
  );
  return {
    found: response.found,
    page: response.page,
    pages: response.pages,
    jobs: response.items.map(normalizeHhVacancy),
  };
}

export async function getHhVacancy(id: string) {
  if (!/^\d{4,20}$/.test(id)) throw new Error("HH_BAD_ID");
  return normalizeHhVacancy(
    hhVacancySchema.parse(await fetchHhJson(`/vacancies/${id}`)),
  );
}
