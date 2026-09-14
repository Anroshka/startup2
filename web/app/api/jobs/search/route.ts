import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { searchHhVacancies } from "@/lib/hh";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  text: z.string().trim().min(2).max(160),
  city: z.string().trim().max(100).optional().default(""),
  salary: z.number().int().min(0).max(10_000_000).optional().default(0),
  experience: z
    .enum(["Без опыта", "1–3 года", "3–6 лет", "Более 6 лет"])
    .optional(),
  format: z
    .enum(["Любой", "Удалённо", "Гибрид", "Офис"])
    .optional()
    .default("Любой"),
  page: z.number().int().min(0).max(99).optional().default(0),
});

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!(await getCurrentUser()))
    return reply({ error: "Войдите, чтобы искать вакансии." }, 401);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return reply({ error: "Запрос отклонён." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Нужен JSON." }, 415);

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      return reply({ error: parsed.error.issues[0].message }, 400);
    return reply(await searchHhVacancies(parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("JobPilot HH search failed", message);
    if (message === "HH_NOT_CONFIGURED") {
      return reply(
        {
          error:
            "Поиск hh.ru ещё не подключён: добавьте ключи приложения в Vercel.",
        },
        503,
      );
    }
    if (message.startsWith("HH_TOKEN_"))
      return reply({ error: "hh.ru отклонил ключи приложения." }, 502);
    if (message === "HH_API_403")
      return reply(
        { error: "hh.ru временно ограничил поиск. Повторите позже." },
        429,
      );
    return reply(
      { error: "Не удалось получить вакансии с hh.ru. Повторите позже." },
      502,
    );
  }
}
