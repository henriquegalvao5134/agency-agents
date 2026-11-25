import { describe, expect, it } from "vitest";
import { agentIsWorking, type BrainTask } from "@/lib/brain-routing";

describe("Delegações do cérebro", () => {
  it("mantém o executor trabalhando quando outra tarefa dele termina", () => {
    const base: BrainTask = { id: "a", mode: "delegated", toolCallId: "tool-1", sourceId: "claude-code", source: "Claude Code", targetId: "codex", target: "Codex", skillId: "code", skill: "Análise de código", task: "Analisar", reason: "Código", phase: "completed", startedAt: 1, finishedAt: 2, events: [] };
    expect(agentIsWorking([base, { ...base, id: "b", phase: "running", finishedAt: null }], "codex")).toBe(true);
    expect(agentIsWorking([base], "codex")).toBe(false);
    expect(agentIsWorking([{ ...base, phase: "routing" }], "claude-code")).toBe(true);
    expect(agentIsWorking([{ ...base, phase: "running" }], "claude-code")).toBe(false);
  });
});