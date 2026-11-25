import type { Atividade } from "./types";

export type FerramentaIA = "claude-code" | "claude-app" | "codex" | "gemini";

/** Endereço do cérebro quando não dá para ler o do navegador. */
export const SITE_CEREBRO =
  "https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev";

/** Limite (em %) a partir do qual vale salvar e trocar de IA. */
export const LIMITE_TROCA = 85;

const HORA = 3_600_000;

/**
 * Como ligar a ferramenta ao cérebro (uma vez só): onde fazer e o comando/endereço para copiar.
 * O token nunca vai para o navegador: aparece como SEU_TOKEN para a pessoa trocar pelo CEREBRO_TOKEN.
 */
export function ligarFerramenta(
  ferramenta: FerramentaIA,
  site: string,
): { como: string; comando: string } {
  const mcp = `${site}/api/mcp`;
  switch (ferramenta) {
    case "claude-code":
      return {
        como: "No terminal (PowerShell), troque SEU_TOKEN pelo seu token e rode uma vez. Depois abra o Claude Code na pasta do projeto.",
        comando: `claude mcp add --scope user --transport http cerebro ${mcp} --header "Authorization: Bearer SEU_TOKEN"`,
      };
    case "claude-app":
      return {
        como: "No Claude do site, do app ou de outra conta: em Configurações → Conectores, adicione um conector personalizado chamado cerebro com este endereço (troque SEU_TOKEN pelo seu token). Depois abra uma conversa nova.",
        comando: `${mcp}/SEU_TOKEN`,
      };
    case "codex":
      return {
        como: "No terminal (PowerShell), troque SEU_TOKEN pelo seu token e rode as duas linhas uma vez. Depois abra um terminal novo e rode o Codex na pasta do projeto.",
        comando: `setx CEREBRO_TOKEN "SEU_TOKEN"\ncodex mcp add cerebro --url ${mcp} --bearer-token-env-var CEREBRO_TOKEN`,
      };
    case "gemini":
      return {
        como: "No terminal (PowerShell), troque SEU_TOKEN pelo seu token e rode uma vez. Depois abra o Gemini CLI na pasta do projeto.",
        comando: `gemini mcp add -s user --transport http --header "Authorization: Bearer SEU_TOKEN" cerebro ${mcp}`,
      };
  }
}

/** Texto para colar na outra IA: ela lê a ficha do projeto no MCP "cerebro" e segue de onde parou. */
export function comandoContinuar(ferramenta: FerramentaIA, projeto: string): string {
  return `Use o MCP "cerebro": chame ler_ficha com o projeto "${projeto}", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "${ferramenta}") ao fim de cada etapa.`;
}

/**
 * Leituras de limite que ainda valem: a de 5h deixa de valer depois de 5 h e a semanal depois de 7 dias
 * (a janela já virou). Sem data de leitura válida, nenhuma vale.
 */
export function limitesValidos(
  limites: Atividade["limites"],
  agora = Date.now(),
): { limite_5h_pct: number | null; limite_7d_pct: number | null } {
  const lido = limites.em ? Date.parse(limites.em) : NaN;
  const idade = Number.isNaN(lido) ? Infinity : agora - lido;
  return {
    limite_5h_pct: idade <= 5 * HORA ? limites.limite_5h_pct : null,
    limite_7d_pct: idade <= 7 * 24 * HORA ? limites.limite_7d_pct : null,
  };
}

/** Maior uso entre o limite de 5h e o semanal que ainda valem (0 quando não há leitura válida). */
export function maiorLimite(limites: Atividade["limites"], agora = Date.now()): number {
  const v = limitesValidos(limites, agora);
  return Math.max(v.limite_5h_pct ?? 0, v.limite_7d_pct ?? 0);
}

export function precisaTrocar(limites: Atividade["limites"], agora = Date.now()): boolean {
  return maiorLimite(limites, agora) >= LIMITE_TROCA;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Quando a leitura foi feita, no horário do navegador: "às 14:05" (hoje) ou "em 22/11 às 14:05"; vazio se inválida. */
export function quandoLido(iso: string | null | undefined, agora = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const hoje = new Date(agora);
  const hora = `às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
  return d.toDateString() === hoje.toDateString()
    ? hora
    : `em ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${hora}`;
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
