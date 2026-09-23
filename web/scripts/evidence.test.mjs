import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyRequirements } from "../lib/evidence.ts";

const profile = {
  skills: "React, TypeScript",
  resume: "Разрабатывал интерфейсы три года.",
  preferences: "Без командировок",
  city: "Москва",
  format: "Удалённо",
  experience: "3–6 лет",
};
const job = { description: "Нужен React. Частые командировки. Опыт Kubernetes.", skills: ["React", "Kubernetes"] };
const item = (requirement, verdict, evidence) => ({ requirement, verdict, evidence, explanation: "Проверка" });

test("verbatim profile evidence is accepted, and unmentioned skills remain unknown", () => {
  const result = verifyRequirements([
    item("React", "confirmed", "React"),
    item("Kubernetes", "confirmed", "Kubernetes"),
  ], profile, job);
  assert.deepEqual(result.requirements.map((r) => r.verdict), ["confirmed", "unclear"]);
  assert.equal(result.fitScore, 100);
});

test("invented job requirement and invented candidate evidence are discarded", () => {
  const result = verifyRequirements([
    item("AWS", "confirmed", "React"),
    item("React", "confirmed", "Работал в Google"),
  ], profile, job);
  assert.deepEqual(result.requirements.map((r) => r.verdict), ["unclear", "unclear"]);
  assert.equal(result.fitScore, null);
});

test("an explicit conflicting preference remains traceable to the profile", () => {
  const result = verifyRequirements([item("Частые командировки", "conflict", "Без командировок")], profile, job);
  assert.equal(result.requirements[0].verdict, "conflict");
  assert.equal(result.fitScore, 0);
});
