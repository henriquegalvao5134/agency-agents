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