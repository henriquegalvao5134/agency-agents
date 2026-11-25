import type { Atividade } from "./types";

export type FerramentaIA = "claude-code" | "codex" | "gemini";

/** Limite (em %) a partir do qual vale salvar e trocar de IA. */
export const LIMITE_TROCA = 85;

/** Texto para colar na outra IA: ela lê a ficha do projeto no MCP "cerebro" e segue de onde parou. */
export function comandoContinuar(ferramenta: FerramentaIA, projeto: string): string {
  return `Use o MCP "cerebro": chame ler_ficha com o projeto "${projeto}", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "${ferramenta}") ao fim de cada etapa.`;
}

/** Maior uso entre o limite de 5h e o semanal (0 quando não há leitura). */
export function maiorLimite(limites: Atividade["limites"]): number {
  return Math.max(limites.limite_5h_pct ?? 0, limites.limite_7d_pct ?? 0);
}

export function precisaTrocar(limites: Atividade["limites"]): boolean {
  return maiorLimite(limites) >= LIMITE_TROCA;
}

/** "há 5 min", "há 2 h", "há 3 dias"; vazio se a data for inválida. */
export function haQuantoTempo(iso: string | undefined, agora = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const min = Math.floor((agora - t) / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
