import { getCurrentUser } from "@/lib/supabase/server";
import { getHhVacancy } from "@/lib/hh";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentUser()))
    return Response.json({ error: "Нужно войти." }, { status: 401 });
  try {
    const { id } = await params;
    return Response.json(
      { job: await getHhVacancy(id) },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error(
      "JobPilot HH vacancy read failed",
      error instanceof Error ? error.message : error,
    );
    return Response.json(
      { error: "Не удалось загрузить полное описание вакансии." },
      { status: 502 },
    );
  }
}
