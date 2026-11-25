import { estadoAgencia, type CorFx, type DepartamentoId } from "@/lib/cerebro/agencia";
import divisoes from "@/lib/cerebro/divisoes.json";

/**
 * Brain map — lateral (sagittal) view, facing left. World coords ≈ x[-210,215], y[-155,185].
 *
 * Each agency department (src/lib/cerebro/agencia.ts) lives in the region that best matches what it does,
 * and each real agent of the catalog is a neuron inside it (REGIAO_DO_DEPARTAMENTO):
 *   Frontal lobe   → Estratégia, Produto e projetos   decision, planning
 *   Parietal lobe  → Desenvolvimento                  integration, structure
 *   Occipital lobe → Design, Mídia paga               visual intake and output
 *   Temporal lobe  → Marketing, Vendas e suporte      language and memory
 *   Cerebellum     → Qualidade, Especialistas         execution, routines
 *   Brainstem      → Segurança                        keeping the system alive
 *
 * Skills fire a sequence of regions (order = signal path):
 *   Plan         frontal → parietal → cerebellum
 *   Research     occipital → temporal → frontal
 *   Write        temporal (Wernicke) → frontal (Broca)
 *   Code analysis occipital → parietal → frontal → cerebellum
 *   Yearly review brainstem → temporal → frontal → parietal
 */
export type RegionId =
  "frontal" | "parietal" | "occipital" | "temporal" | "cerebellum" | "brainstem";
export const REGIONS: Record<
  RegionId,
  { name: string; c: string; cx: number; cy: number; r: number; role: string }
> = {
  frontal: {
    name: "Lobo frontal",
    c: "orange",
    cx: -115,
    cy: -55,
    r: 70,
    role: "planejamento · raciocínio · escrita",
  },
  parietal: {
    name: "Lobo parietal",
    c: "purple",
    cx: 70,
    cy: -95,
    r: 62,
    role: "integração · estrutura",
  },
  occipital: { name: "Lobo occipital", c: "blue", cx: 170, cy: -15, r: 42, role: "entrada visual" },
  temporal: { name: "Lobo temporal", c: "cyan", cx: 5, cy: 55, r: 55, role: "linguagem · memória" },
  cerebellum: {
    name: "Cerebelo",
    c: "yellow",
    cx: 113,
    cy: 112,
    r: 55,
    role: "rotinas · automação",
  },
  brainstem: { name: "Tronco cerebral", c: "green", cx: 36, cy: 160, r: 40, role: "ritmo diário" },
};
export const REGIAO_DO_DEPARTAMENTO: Record<DepartamentoId, RegionId> = {
  estrategia: "frontal",
  produto: "frontal",
  dev: "parietal",
  design: "occipital",
  midia: "occipital",
  marketing: "temporal",
  vendas: "temporal",
  qualidade: "cerebellum",
  especialistas: "cerebellum",
  seguranca: "brainstem",
};
/** One group per department, in DEPARTAMENTOS order; n = real agent count, taken from estadoAgencia so it matches the Agência GD3 column. */
export const GROUPS: { id: string; dep: DepartamentoId; c: CorFx; n: number; region: RegionId }[] =
  estadoAgencia(undefined, divisoes).departamentos.map((d) => ({
    id: d.rotulo,
    dep: d.id,
    c: d.cor,
    n: d.total,
    region: REGIAO_DO_DEPARTAMENTO[d.id],
  }));
export const SKILLS: { id: string; label: string; path: RegionId[]; why: string }[] = [
  {
    id: "plan",
    label: "Planejar",
    path: ["frontal", "parietal", "cerebellum"],
    why: "O frontal define metas, o parietal as estrutura e o cerebelo as transforma em modelos.",
  },
  {
    id: "research",
    label: "Pesquisar",
    path: ["occipital", "temporal", "frontal"],
    why: "Os recortes entram pela visão, viram referências e o frontal raciocina sobre eles.",
  },
  {
    id: "write",
    label: "Escrever",
    path: ["temporal", "frontal"],
    why: "Wernicke (temporal) encontra as palavras e Broca (frontal) as compõe em notas.",
  },
  {
    id: "code",
    label: "Análise de código",
    path: ["occipital", "parietal", "frontal", "cerebellum"],
    why: "Lê o código, mapeia a estrutura, raciocina sobre ele e automatiza a correção.",
  },
  {
    id: "review",
    label: "Revisão anual",
    path: ["brainstem", "temporal", "frontal", "parietal"],
    why: "As notas diárias alimentam a memória, o frontal reflete e o parietal conecta tudo.",
  },
];

/** Cerebrum outline (lateral profile) — frontal pole on the left, temporal lobe hanging below the Sylvian fissure. */
export const CEREBRUM =
  "M-200,-10 C-208,-95 -130,-152 -30,-152 C75,-157 175,-118 205,-38 C218,2 208,42 182,60 C150,72 112,66 82,70 C55,74 32,80 12,86 C-28,106 -92,102 -122,82 C-142,70 -142,48 -152,42 C-178,36 -200,24 -200,-10Z";
export const CEREBELLUM =
  "M80,78 C92,58 160,52 196,74 C214,90 206,120 178,130 C146,140 102,134 86,116 C76,104 74,90 80,78Z";
export const BRAINSTEM =
  "M30,78 C46,74 66,74 76,82 C80,112 76,150 82,186 L46,186 C44,150 36,112 30,78Z";
export const SULCI = [
  { d: "M22,-152 C4,-108 14,-64 -16,-12", label: "central sulcus" },
  { d: "M-150,40 C-92,12 -22,10 62,-14", label: "lateral (Sylvian) fissure" },
  { d: "M148,-112 C134,-80 144,-58 126,-36", label: "parieto-occipital" },
];
export const FOLIA = [0, 1, 2, 3, 4].map(
  (i) =>
    `M${90 + i * 4},${84 + i * 10} C${120},${74 + i * 10} ${170},${78 + i * 10} ${200 - i * 6},${86 + i * 9}`,
);

export function inRegion(id: RegionId, x: number, y: number) {
  if (id === "cerebellum") return ((x - 113) / 62) ** 2 + ((y - 113) / 44) ** 2 < 0.75;
  if (id === "brainstem") return x > 18 + (y - 110) * 0.08 && x < 52 && y > 105 && y < 205;
  const inCerebrum =
    (x / 200) ** 2 + ((y + 24) / 126) ** 2 < 0.82 &&
    y < 95 &&
    !(x > 40 && y > 62) &&
    !(x < -90 && y > 50);
  return inCerebrum;
}

/**
 * AI inputs — every assistant plugs into the same brain through the AI core (thalamus relay).
 * The active AI is the one currently "reading" the regions of the skill being run.
 *   Codex        → OpenAI's coding agent
 *   Grok         → xAI model
 *   Claude Code  → Anthropic's coding agent in the terminal
 *   Anthropic API → Claude models called directly
 * Ferramentas (Claude Code, Codex) acendem pelo registro do núcleo; IAs com chave vêm do cofre (src/lib/cerebro).
 */
export const CORE = { x: 10, y: -30 };
/** Illustration placement in world coords (lateral brain art, see src/assets/brain-lateral.png). */
export const BRAIN_IMG = { x: -211.5, y: -162, w: 430.3, h: 393.3 };
export type AgentKind = "autonomous" | "api";
export type Agent = {
  id: string;
  name: string;
  vendor: string;
  c: string;
  model: string | null;
  kind?: AgentKind;
};
/** Starting inputs. Users can connect any other AI from the "Connect AI" menu; model = null means it still needs its own key. */
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    c: "orange",
    model: null,
    kind: "autonomous",
  },
  { id: "codex", name: "Codex", vendor: "OpenAI", c: "green", model: null, kind: "autonomous" },
];
export const portY = (i: number, n: number) =>
  (i - (n - 1) / 2) * Math.min(58, 440 / Math.max(1, n)) - 15;
export type AgentId = string;
export const PORT_X = -320;
export const wirePath = (y: number) =>
  `M${PORT_X + 70},${y} C${PORT_X + 150},${y} -230,${y * 0.4 + 150} -120,150 S${CORE.x - 60},${CORE.y + 110} ${CORE.x},${CORE.y}`;

/**
 * Orchestrator: every AI reads ONE compact central file (brain.md) instead of the whole vault.
 * It lists departments → lobes, skills → region paths and the agents on duty, so each call
 * carries a few hundred tokens of context rather than millions.
 */
export function buildBrainIndex(agents: Agent[]) {
  const lines = [
    "# brain.md — índice do orquestrador",
    "## Departamentos → regiões",
    ...GROUPS.map(
      (g) => `- ${g.id} → ${REGIONS[g.region].name} (${REGIONS[g.region].role}), ${g.n} agentes`,
    ),
    "## Skills → caminho do sinal",
    ...SKILLS.map(
      (s) => `- ${s.label}: ${s.path.map((r) => REGIONS[r].name.replace("Lobo ", "")).join(" → ")}`,
    ),
    "## Agentes em serviço",
    ...agents.map(
      (a) =>
        `- ${a.name} [${a.kind === "autonomous" ? "autônomo" : "chave API"}] ${a.model ?? "precisa de chave"}`,
    ),
    "## Regras",
    "- Leia apenas as pastas das regiões do caminho da sua skill.",
    "- Registre decisões e progresso na ficha do projeto (salvar_ficha).",
  ];
  return lines.join("\n");
}
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
