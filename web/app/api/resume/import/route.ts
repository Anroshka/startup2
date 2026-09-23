import { getCurrentUser } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/resume-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Нужно войти." }, { status: 401 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Запрос отклонён." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return Response.json({ error: "Нужен файл." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 2_200_000) return Response.json({ error: "Файл слишком большой (максимум 2 МБ)." }, { status: 413 });

  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size > 2_000_000 || file.size === 0) return Response.json({ error: "Нужен файл до 2 МБ." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(file.name, buffer);
    if (text.length < 30) return Response.json({ error: "Текст не найден. Для скана PDF понадобится OCR; пока вставьте текст вручную." }, { status: 422 });
    if (text.length > 20_000) return Response.json({ error: "Резюме длиннее 20 000 символов. Сократите текст перед импортом." }, { status: 413 });
    return Response.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_FILE") return Response.json({ error: "Поддерживаются текстовые PDF и DOCX." }, { status: 415 });
    console.error("JobPilot resume extraction failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Не удалось прочитать файл. Проверьте его или вставьте текст вручную." }, { status: 422 });
  }
}
