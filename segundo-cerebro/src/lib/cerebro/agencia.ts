import type { Atividade } from "./types";

export type DepartamentoId =
  | "marketing"
  | "midia"
  | "vendas"
  | "design"
  | "dev"
  | "qualidade"
  | "produto"
  | "seguranca"
  | "estrategia"
  | "especialistas";

export const DEPARTAMENTOS: {
  id: DepartamentoId;
  rotulo: string;
  divisoes: string[];
  cor: string;
}[] = [
  { id: "marketing", rotulo: "Marketing", divisoes: ["marketing"], cor: "magenta" },
  { id: "midia", rotulo: "Mídia paga", divisoes: ["paid-media"], cor: "red" },
  { id: "vendas", rotulo: "Vendas e suporte", divisoes: ["sales", "support"], cor: "orange" },
  { id: "design", rotulo: "Design", divisoes: ["design"], cor: "purple" },
  { id: "dev", rotulo: "Desenvolvimento", divisoes: ["engineering"], cor: "blue" },
  { id: "qualidade", rotulo: "Qualidade", divisoes: ["testing"], cor: "green" },
  {
    id: "produto",
    rotulo: "Produto e projetos",
    divisoes: ["product", "project-management"],
    cor: "cyan",
  },
  { id: "seguranca", rotulo: "Segurança", divisoes: ["security"], cor: "yellow" },
  {
    id: "estrategia",
    rotulo: "Estratégia",
    divisoes: ["specialized", "strategy", "finance"],
    cor: "purple",
  },
  { id: "especialistas", rotulo: "Especialistas", divisoes: [], cor: "cyan" },
];

const ID_ESPECIALISTAS: DepartamentoId = "especialistas";

function divisaoDe(agenteId: string): string {
  const i = agenteId.indexOf("/");
  return i < 0 ? agenteId : agenteId.slice(0, i);
}

export function departamentoDe(agenteId: string): DepartamentoId {
  const divisao = divisaoDe(agenteId);
  return DEPARTAMENTOS.find((d) => d.divisoes.includes(divisao))?.id ?? ID_ESPECIALISTAS;
}

export function nomeAgente(agenteId: string): string {
  const divisao = divisaoDe(agenteId);
  const ultimo = agenteId.slice(agenteId.lastIndexOf("/") + 1);
  const semPrefixo = ultimo.startsWith(`${divisao}-`) ? ultimo.slice(divisao.length + 1) : ultimo;
  return semPrefixo
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type SkillTrabalho = { id: string; rotulo: string; grupo: "superpowers" | "gd3" };

export const SKILLS_TRABALHO: SkillTrabalho[] = [
  { id: "brainstorming", rotulo: "Brainstorming", grupo: "superpowers" },
  { id: "writing-plans", rotulo: "Plano", grupo: "superpowers" },
  { id: "subagent-driven-development", rotulo: "Subagentes", grupo: "superpowers" },
  { id: "test-driven-development", rotulo: "TDD", grupo: "superpowers" },
  { id: "systematic-debugging", rotulo: "Depuração", grupo: "superpowers" },
  { id: "requesting-code-review", rotulo: "Revisão de código", grupo: "superpowers" },
  { id: "fluxo-marketing", rotulo: "Fluxo de marketing", grupo: "gd3" },
  { id: "salvar-no-cerebro", rotulo: "Salvar no cérebro", grupo: "gd3" },
];

export type EstadoAgencia = {
  departamentos: {
    id: DepartamentoId;
    rotulo: string;
    cor: string;
    total: number;
    aceso: boolean;
    agentes: string[];
  }[];
  skillsAcesas: string[];
  orquestradorAtivo: boolean;
};

const JANELA_ORQUESTRADOR_MS = 2 * 60_000;

export function estadoAgencia(
  atividade: Pick<Atividade, "delegacoes" | "salvouAgora"> | undefined,
  divisoes: Record<string, number>,
  agora: Date = new Date(),
): EstadoAgencia {
  const delegacoes = [...(atividade?.delegacoes ?? [])].sort((a, b) =>
    b.criado_em.localeCompare(a.criado_em),
  );
  const listadas = new Set(DEPARTAMENTOS.flatMap((d) => d.divisoes));

  const agentesPorDepto = new Map<DepartamentoId, string[]>();
  for (const deleg of delegacoes) {
    for (const id of deleg.agentes) {
      const depto = departamentoDe(id);
      const nome = nomeAgente(id);
      const lista = agentesPorDepto.get(depto) ?? [];
      if (!lista.includes(nome)) lista.push(nome);
      agentesPorDepto.set(depto, lista);
    }
  }

  const departamentos = DEPARTAMENTOS.map((d) => {
    const total =
      d.id === ID_ESPECIALISTAS
        ? Object.entries(divisoes).reduce(
            (soma, [div, n]) => (listadas.has(div) ? soma : soma + n),
            0,
          )
        : d.divisoes.reduce((soma, div) => soma + (divisoes[div] ?? 0), 0);
    const agentes = agentesPorDepto.get(d.id) ?? [];
    return { id: d.id, rotulo: d.rotulo, cor: d.cor, total, aceso: agentes.length > 0, agentes };
  });

  const maisNova = delegacoes[0];
  const acesas = new Set<string>();
  if (maisNova?.area === "desenvolvimento") {
    for (const s of SKILLS_TRABALHO) if (s.grupo === "superpowers") acesas.add(s.id);
  }
  if (maisNova?.area === "marketing") acesas.add("fluxo-marketing");
  if (atividade?.salvouAgora) acesas.add("salvar-no-cerebro");

  const orquestradorAtivo = maisNova
    ? agora.getTime() - new Date(maisNova.criado_em).getTime() < JANELA_ORQUESTRADOR_MS
    : false;

  return {
    departamentos,
    skillsAcesas: SKILLS_TRABALHO.filter((s) => acesas.has(s.id)).map((s) => s.id),
    orquestradorAtivo,
  };
}
