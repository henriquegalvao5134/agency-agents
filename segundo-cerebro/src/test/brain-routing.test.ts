import { describe, expect, it } from "vitest";
import { agentIsWorking, validateDelegation, type BrainTask } from "@/lib/brain-routing";
import { DEFAULT_AGENTS } from "@/components/dash/brain";

describe("Delegações do cérebro", () => {
  it("preserva agente e skill chamados pela LLM", () => {
    const result = validateDelegation({ agentId: "codex", skillId: "code", task: "Analisar código", reason: "Especialista em código" }, DEFAULT_AGENTS);
    expect(result.target.id).toBe("codex");
    expect(result.skill.path).toEqual(["occipital", "parietal", "frontal", "cerebellum"]);
  });
  it("não executa um agente desconectado", () => {
    expect(() => validateDelegation({ agentId: "grok", skillId: "code", task: "Analisar", reason: "Código" }, DEFAULT_AGENTS)).toThrow();
  });
  it("não aceita skills que não existem", () => {
    expect(() => validateDelegation({ agentId: "codex", skillId: "inexistente", task: "Analisar", reason: "Código" }, DEFAULT_AGENTS)).toThrow();
  });
  it("mantém o executor trabalhando quando outra tarefa dele termina", () => {
    const base: BrainTask = { id: "a", mode: "delegated", toolCallId: "tool-1", sourceId: "claude-code", source: "Claude Code", targetId: "codex", target: "Codex", skillId: "code", skill: "Análise de código", task: "Analisar", reason: "Código", phase: "completed", startedAt: 1, finishedAt: 2, events: [] };
    expect(agentIsWorking([base, { ...base, id: "b", phase: "running", finishedAt: null }], "codex")).toBe(true);
    expect(agentIsWorking([base], "codex")).toBe(false);
    expect(agentIsWorking([{ ...base, phase: "routing" }], "claude-code")).toBe(true);
    expect(agentIsWorking([{ ...base, phase: "running" }], "claude-code")).toBe(false);
  });
});