import { z } from "zod";
import { SKILLS, type Agent } from "@/components/dash/brain";

/** Only connected agent IDs and documented skills may be dispatched. */
export const Delegation = z.object({
  agentId: z.string().max(100),
  skillId: z.string().max(60),
  task: z.string().min(1).max(4000),
  reason: z.string().min(1).max(300),
});
export function validateDelegation(input: unknown, agents: Agent[]) {
  const decision = Delegation.parse(input);
  const target = agents.find(a => a.id === decision.agentId && a.model);
  const skill = SKILLS.find(s => s.id === decision.skillId);
  if (!target || !skill) throw new Error("Destino de delegação indisponível.");
  return { decision, target, skill };
}
export type TaskPhase = "routing" | "running" | "completed" | "failed";
export type BrainTask = {
  id: string;
  mode: "delegated" | "direct";
  toolCallId: string | null;
  sourceId: string;
  source: string;
  targetId: string | null;
  target: string | null;
  skillId: string | null;
  skill: string | null;
  task: string;
  reason: string;
  phase: TaskPhase;
  startedAt: number;
  finishedAt: number | null;
  events: { at: number; label: string }[];
};
export const isTaskActive = (task: BrainTask) => task.phase === "routing" || task.phase === "running";
export function agentIsWorking(tasks: BrainTask[], agentId: string) {
  return tasks.some(t => isTaskActive(t) && (t.phase === "routing" ? t.sourceId === agentId : t.targetId === agentId));
}