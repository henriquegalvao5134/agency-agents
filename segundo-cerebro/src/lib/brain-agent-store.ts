import { DEFAULT_AGENTS, type Agent } from "@/components/dash/brain";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedAgents: Agent[] = DEFAULT_AGENTS;
export const serverAgentSnapshot = () => DEFAULT_AGENTS;
export function agentSnapshot(): Agent[] {
  if (typeof window === "undefined") return DEFAULT_AGENTS;
  try {
    const raw = localStorage.getItem("brain-agents");
    if (raw === cachedRaw) return cachedAgents;
    cachedRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : DEFAULT_AGENTS;
    cachedAgents = Array.isArray(parsed) && parsed.every((a: unknown) => !!a && typeof a === "object" && "id" in a && typeof a.id === "string" && "name" in a && typeof a.name === "string" && "vendor" in a && typeof a.vendor === "string" && "c" in a && typeof a.c === "string" && "model" in a && (a.model === null || typeof a.model === "string")) ? parsed : DEFAULT_AGENTS;
    return cachedAgents;
  } catch { return DEFAULT_AGENTS; }
}
export function subscribeAgents(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === "brain-agents") listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export function saveAgentSnapshot(agents: Agent[]) {
  cachedAgents = agents;
  cachedRaw = JSON.stringify(agents);
  try { localStorage.setItem("brain-agents", cachedRaw); } catch { /* Keep the session usable when browser storage is unavailable. */ }
  listeners.forEach(listener => listener());
}