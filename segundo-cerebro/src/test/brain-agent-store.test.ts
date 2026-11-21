import { expect, it } from "vitest";
import { agentSnapshot, saveAgentSnapshot } from "../lib/brain-agent-store";
it("restores a newly added independent agent from browser storage", () => {
  localStorage.removeItem("brain-agents");
  const original = agentSnapshot();
  const added = { id: "client-agent", name: "Agente do cliente", vendor: "openai", c: "blue", model: "openai/gpt-6-astra" };
  saveAgentSnapshot([...original, added]);
  expect(agentSnapshot().find(a => a.id === "client-agent")).toEqual(added);
  expect(JSON.parse(localStorage.getItem("brain-agents") ?? "[]")).toContainEqual(added);
});