import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import * as zod from "zod";

const context = vm.createContext({
  AbortSignal,
  Date,
  Error,
  JSON,
  Map,
  Number,
  process,
  Response,
  Request,
  TextDecoder,
  URLSearchParams,
  console,
  setTimeout,
});
const exportsModule = (exports) =>
  new vm.SyntheticModule(
    Object.keys(exports),
    function () {
      for (const [key, value] of Object.entries(exports))
        this.setExport(key, value);
    },
    { context },
  );
const sourceModule = (path) =>
  new vm.SourceTextModule(
    ts.transpile(fs.readFileSync(path, "utf8"), {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    }),
    { context },
  );

const product = sourceModule("lib/product.ts");
await product.link(() => exportsModule(zod));
await product.evaluate();
const p = product.namespace;

assert.equal(p.score(p.demoProfile, p.demoJobs[0]), 100);
assert.equal(p.score({ ...p.demoProfile, skills: "React" }, p.demoJobs[0]), 0);
assert.equal(
  p.jobSchema.safeParse({ ...p.demoJobs[0], url: "javascript:alert(1)" })
    .success,
  false,
);
assert.equal(
  p.jobSchema.safeParse({
    ...p.demoJobs[0],
    salaryMin: 250000,
    salaryMax: 100000,
  }).success,
  false,
);
assert.equal(
  p.stateSchema.safeParse({
    ...p.emptyState,
    jobs: [p.demoJobs[0], p.demoJobs[0]],
  }).success,
  false,
);
assert.equal(
  p
    .salary({ ...p.demoJobs[0], salaryCurrency: "USD", salaryGross: true })
    .includes("$"),
  true,
);

const hh = sourceModule("lib/hh.ts");
await hh.link((name) => (name === "./product" ? product : exportsModule(zod)));
await hh.evaluate();
const normalized = hh.namespace.normalizeHhVacancy({
  id: "123456",
  name: "Frontend-разработчик",
  alternate_url: "https://hh.ru/vacancy/123456",
  apply_alternate_url:
    "https://hh.ru/applicant/vacancy_response?vacancyId=123456",
  published_at: "2026-09-13T12:00:00+0300",
  area: { name: "Москва" },
  employer: { name: "Пример", trusted: true },
  salary_range: { from: 180000, to: 240000, currency: "RUR", gross: false },
  experience: { name: "От 1 года до 3 лет" },
  work_format: [{ name: "Удалённо" }],
  professional_roles: [{ name: "Программист, разработчик" }],
  snippet: {
    requirement: "React и <highlighttext>TypeScript</highlighttext>",
    responsibility: "Разработка интерфейсов",
  },
});
assert.equal(normalized.id, "hh:123456");
assert.equal(normalized.source, "hh");
assert.equal(normalized.format, "Удалённо");
assert.equal(normalized.companyTrusted, true);
assert.ok(!normalized.description.includes("<"));

const agentConfig = sourceModule("lib/agent-config.ts");
await agentConfig.link(() => exportsModule(zod));
await agentConfig.evaluate();
const agent = sourceModule("lib/auto-apply.ts");
await agent.link((name) => {
  if (name === "@/lib/product") return product;
  if (name === "@/lib/agent-config") return agentConfig;
  if (name === "@/lib/hh") return exportsModule({ getHhVacancy: () => {}, searchHhVacancies: () => {} });
  if (name === "@/lib/ai-quota") return exportsModule({ adminClient: () => {} });
  if (name === "node:crypto") return exportsModule({ createCipheriv: () => {}, createDecipheriv: () => {}, randomBytes: () => {} });
  return exportsModule(zod);
});
await agent.evaluate();
const profile = { ...p.demoProfile, role: "Frontend-разработчик", skills: "React, TypeScript", resume: "Разрабатывал интерфейсы на React." };
const job = { ...normalized, description: "Разработка интерфейсов на React и TypeScript", skills: ["React", "TypeScript"] };
const config = { ...agentConfig.namespace.defaultAgentConfig, minSalary: 170000 };
assert.equal(agent.namespace.eligible(profile, job, config), true);
assert.equal(agent.namespace.eligible({ ...profile, role: "Разработчик интерфейсов" }, { ...job, title: "Разработчик интерфейсов" }, config), true);
assert.equal(agent.namespace.eligible(profile, { ...job, companyTrusted: false }, config), false);
assert.equal(agent.namespace.eligible(profile, { ...job, salaryMin: 0 }, config), false);
assert.equal(agent.namespace.eligible(profile, { ...job, skills: ["Python", "Go"] }, config), false);
assert.equal(agent.namespace.eligible(profile, job, { ...config, blockedCompanies: ["Пример"] }), false);
assert.match(agent.namespace.agentLetter(profile, job), /React/);
assert.equal(agentConfig.namespace.agentConfigSchema.safeParse({ ...config, dailyLimit: 100 }).success, false);

for (const route of [
  "app/api/state/route.ts",
  "app/api/jobs/search/route.ts",
  "app/api/jobs/[id]/route.ts",
  "app/api/ai/route.ts",
  "app/api/agent/route.ts",
]) {
  assert.match(fs.readFileSync(route, "utf8"), /getCurrentUser|getClaims/);
}
assert.doesNotMatch(
  fs.readFileSync("app/api/ai/route.ts", "utf8"),
  /NEXT_PUBLIC_OPENROUTER/,
);
assert.doesNotMatch(
  fs.readFileSync("app/api/jobs/search/route.ts", "utf8"),
  /NEXT_PUBLIC_HH_/,
);

console.log(
  "PASS: validation, matching, HH normalization, HTML cleanup, auth gates, and server-only secrets.",
);
