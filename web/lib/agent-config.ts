import { z } from "zod";

export const agentConfigSchema = z.object({
  enabled: z.boolean(),
  resumeId: z.string().regex(/^[a-zA-Z0-9_-]{5,100}$/).or(z.literal("")),
  dailyLimit: z.number().int().min(1).max(5),
  minSalary: z.number().int().min(0).max(10_000_000),
  blockedCompanies: z.array(z.string().trim().min(2).max(100)).max(20),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export const defaultAgentConfig: AgentConfig = { enabled: false, resumeId: "", dailyLimit: 2, minSalary: 0, blockedCompanies: [] };
