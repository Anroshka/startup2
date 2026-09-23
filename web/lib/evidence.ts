import type { Job, Profile } from "./product";

export type Requirement = {
  requirement: string;
  verdict: "confirmed" | "unclear" | "conflict";
  evidence: string;
  explanation: string;
};

export function verifyRequirements(
  entries: Requirement[],
  profile: Profile,
  job: Job,
) {
  const source = `${profile.skills}\n${profile.resume}\n${profile.preferences}\n${profile.city}\n${profile.format}\n${profile.experience}`.toLocaleLowerCase("ru");
  const vacancy = `${job.description}\n${job.skills.join("\n")}`.toLocaleLowerCase("ru");
  const requirements = entries.map((item) => {
    const inVacancy = vacancy.includes(item.requirement.trim().toLocaleLowerCase("ru"));
    const hasEvidence = item.evidence.trim().length >= 3 && source.includes(item.evidence.trim().toLocaleLowerCase("ru"));
    return {
      ...item,
      verdict: inVacancy && hasEvidence ? item.verdict : "unclear" as const,
      evidence: inVacancy && hasEvidence ? item.evidence : "",
    };
  });
  const known = requirements.filter((item) => item.verdict !== "unclear");
  const fitScore = known.length
    ? Math.round(100 * known.filter((item) => item.verdict === "confirmed").length / known.length)
    : null;
  return { requirements, fitScore };
}
