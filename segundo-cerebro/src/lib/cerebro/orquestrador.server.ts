import catalogo from "./catalogo.json";
import { chamarModelo, type RespostaModelo } from "./llm.server";
import type { Ficha, Provedor } from "./types";

/**
 * Orquestrador da agência GD3. Recebe o pedido de quem está trabalhando (Claude Code, etc.),
 * escolhe área, subagentes do catálogo e o fluxo de trabalho, e DEVOLVE as instruções.
 * Quem executa o trabalho pesado é a ferramenta que chamou (com a assinatura dela).
 */
export type AgenteCatalogo = {
  id: string;
  nome: string;
  descricao: string;
  divisao: string;
  rotulo: string;
};
export const CATALOGO = catalogo as AgenteCatalogo[];
export const REPO_RAW = "https://raw.githubusercontent.com/henriquegalvao5134/agency-agents/main";

export type Area = "desenvolvimento" | "marketing" | "seguranca" | "estrategia";
const DIVISOES_POR_AREA: Record<Area, string[]> = {
  desenvolvimento: ["engineering", "testing", "product", "project-management", "design"],
  marketing: ["marketing", "paid-media", "sales", "design", "support"],
  seguranca: ["security", "engineering"],
  estrategia: ["specialized", "strategy", "finance", "product", "project-management"],
};
const SINAIS_AREA: Record<Area, string[]> = {
  desenvolvimento: [
    "codigo",
    "codar",
    "crm",
    "sistema",
    "site",
    "app",
    "api",
    "banco",
    "deploy",
    "bug",
    "frontend",
    "backend",
    "integracao",
    "software",
    "programar",
    "landing",
  ],
  marketing: [
    "anuncio",
    "campanha",
    "trafego",
    "meta",
    "google ads",
    "instagram",
    "post",
    "postagem",
    "conteudo",
    "carrossel",
    "seo",
    "video",
    "criativo",
    "copy",
    "lead",
    "funil",
    "marca",
    "social",
  ],
  seguranca: [
    "seguranca",
    "ciberseguranca",
    "vulnerabilidade",
    "pentest",
    "invasao",
    "lgpd",
    "senha",
    "ataque",
    "firewall",
  ],
  estrategia: [
    "estrategia",
    "plano de negocio",
    "proposta",
    "precificacao",
    "processo",
    "operacao",
    "contrato",
  ],
};
// Pedidos chegam em português; o catálogo está em inglês. Traduz os termos mais comuns para pontuar melhor.
const SINONIMOS: Record<string, string[]> = {
  anuncio: ["ads", "ppc", "paid", "advertising"],
  anuncios: ["ads", "ppc", "paid"],
  campanha: ["campaign", "ads"],
  trafego: ["paid", "ppc", "media"],
  crm: ["crm", "salesforce", "customer"],
  site: ["website", "frontend", "web"],
  codigo: ["code", "engineer", "developer"],
  sistema: ["system", "backend", "architect"],
  banco: ["database", "data"],
  seguranca: ["security", "threat"],
  ciberseguranca: ["security", "penetration", "threat"],
  video: ["video"],
  postagem: ["social", "content"],
  conteudo: ["content", "writer"],
  instagram: ["instagram", "social"],
  seo: ["seo", "search"],
  teste: ["testing", "qa"],
  design: ["design", "ui", "ux"],
  vendas: ["sales"],
  integracao: ["integration", "api"],
  processo: ["process", "workflow"],
  criativo: ["creative"],
  dados: ["data", "analytics"],
  relatorio: ["report", "analytics"],
};
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function detectarArea(pedido: string): Area {
  const t = normalizar(pedido);
  let melhor: Area = "desenvolvimento";
  let pontos = 0;
  for (const area of Object.keys(SINAIS_AREA) as Area[]) {
    const p = SINAIS_AREA[area].filter((s) => t.includes(s)).length;
    if (p > pontos) [melhor, pontos] = [area, p];
  }
  return melhor;
}

/** Pontua os agentes do catálogo pelo pedido (sem custo de IA). */
export function candidatos(pedido: string, area: Area, limite = 40): AgenteCatalogo[] {
  const palavras = normalizar(pedido)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2);
  const termos = new Set(palavras.flatMap((p) => [p, ...(SINONIMOS[p] ?? [])]));
  const divisoes = DIVISOES_POR_AREA[area];
  return CATALOGO.map((a) => {
    const texto = normalizar(`${a.nome} ${a.descricao} ${a.id}`);
    let pontos = [...termos].filter((t) => texto.includes(t)).length * 2;
    if (divisoes.includes(a.divisao)) pontos += 1;
    return { a, pontos };
  })
    .filter((x) => x.pontos > 1)
    .sort((x, y) => y.pontos - x.pontos)
    .slice(0, limite)
    .map((x) => x.a);
}

const FLUXO: Record<Area, string> = {
  desenvolvimento: [
    "Use as skills do plugin **superpowers** nesta ordem (instale o plugin obra/superpowers se faltar):",
    "1. `superpowers:brainstorming` — entender o pedido e fechar o desenho com o Henrique.",
    "2. `superpowers:writing-plans` — plano em tarefas pequenas, com testes.",
    "3. `superpowers:subagent-driven-development` — um subagente por tarefa, com as instruções dos agentes abaixo; `superpowers:test-driven-development` em cada uma.",
    "4. `superpowers:requesting-code-review` e `superpowers:finishing-a-development-branch` no fim.",
  ].join("\n"),
  marketing: [
    "1. Briefing: ler a ficha do cliente e confirmar objetivo, público, oferta, verba e prazo.",
    "2. Estratégia: o agente estrategista define canais, mensagens e metas (CAC/LTV quando houver dados).",
    "3. Produção: cada agente produz sua peça (campanha, criativo, copy, post) como subagente separado.",
    "4. Revisão: conferir marca, números e conformidade antes de publicar; nada vai ao ar sem aprovação do Henrique.",
    "5. Registro: salvar decisões e resultados na ficha do cliente.",
  ].join("\n"),
  seguranca: [
    "1. Delimitar escopo e autorização por escrito do cliente antes de qualquer teste.",
    "2. Modelagem de ameaças com o agente de segurança; inventário de ativos.",
    "3. Execução em subagentes por frente (aplicação, infraestrutura, dados), com evidências.",
    "4. Relatório com riscos priorizados e correções; registrar na ficha.",
  ].join("\n"),
  estrategia: [
    "1. Diagnóstico com os dados da ficha; perguntas só do que falta.",
    "2. Opções com prós e contras; recomendação clara.",
    "3. Plano de ação com responsáveis e prazos; registrar na ficha.",
  ].join("\n"),
};

export type Decisao = {
  area: Area;
  agentes: AgenteCatalogo[];
  plano: string;
  viaIa: boolean;
  uso: RespostaModelo | null;
  modelo: string;
};

/** Pede a uma IA do cofre para escolher os subagentes; sem IA cadastrada, usa só a pontuação. */
export async function decidir(
  pedido: string,
  roteador: { provedor: Provedor; chave: string } | null,
  f: typeof fetch = fetch,
): Promise<Decisao> {
  const area = detectarArea(pedido);
  const lista = candidatos(pedido, area);
  const reserva: Decisao = {
    area,
    agentes: lista.slice(0, 3),
    plano: "",
    viaIa: false,
    uso: null,
    modelo: "",
  };
  if (!roteador || !lista.length) return reserva;
  const sistema =
    'Você é o orquestrador da agência GD3 (marketing digital e desenvolvimento de software). Escolha de 1 a 4 agentes da lista para o pedido e escreva um plano curto. Responda SOMENTE com JSON: {"area":"desenvolvimento|marketing|seguranca|estrategia","agentes":["id",...],"plano":"passos numerados, em português"}';
  const pedidoIa = `Pedido: ${pedido}\n\nAgentes disponíveis:\n${lista.map((a) => `- ${a.id}: ${a.nome} — ${a.descricao}`).join("\n")}`;
  try {
    const uso = await chamarModelo(roteador.provedor, roteador.chave, sistema, pedidoIa, 800, f);
    const json = JSON.parse(
      uso.texto.slice(uso.texto.indexOf("{"), uso.texto.lastIndexOf("}") + 1),
    ) as { area?: string; agentes?: string[]; plano?: string };
    const escolhidos = (json.agentes ?? [])
      .map((id) => lista.find((a) => a.id === id))
      .filter((a): a is AgenteCatalogo => !!a)
      .slice(0, 4);
    const areaIa = (Object.keys(FLUXO) as Area[]).find((a) => a === json.area) ?? area;
    return {
      area: areaIa,
      agentes: escolhidos.length ? escolhidos : reserva.agentes,
      plano: String(json.plano ?? ""),
      viaIa: true,
      uso,
      modelo: roteador.provedor.modelo,
    };
  } catch {
    return reserva;
  }
}

/** Monta a resposta que volta para o Claude Code (ou outra IA): o que fazer, com quem e como dividir os modelos. */
export function montarInstrucoes(
  pedido: string,
  d: Decisao,
  ficha: Ficha | null,
  projeto: string,
): string {
  const agentes = d.agentes.length
    ? d.agentes.map((a) => `- **${a.nome}** (\`${a.id}\`, ${a.rotulo}) — ${a.descricao}`).join("\n")
    : "- Nenhum agente do catálogo bateu com o pedido; trabalhe direto e registre o que fizer.";
  return [
    `# Orquestrador GD3 — ${d.area}`,
    `Pedido: ${pedido}`,
    d.viaIa
      ? `Roteado por IA (${d.modelo}).`
      : "Roteado por pontuação do catálogo (cadastre uma IA com papel 'orquestrador' no cofre para roteamento por IA).",
    "",
    "## Ficha do projeto",
    ficha
      ? `${ficha.titulo} — etapa atual: ${ficha.etapa_atual || "?"}; próximo passo: ${ficha.proximo_passo || "?"}\nObjetivo: ${ficha.objetivo}\nDecisões:\n${ficha.decisoes}`
      : projeto
        ? `Não há ficha para "${projeto}". Crie com salvar_ficha assim que o objetivo estiver claro.`
        : "Nenhum projeto informado. Se o trabalho for de um cliente/projeto, use listar_fichas e informe o slug.",
    "",
    "## Subagentes",
    agentes,
    "Para cada um: chame `buscar_agente` com o id para receber as instruções completas e use-as como prompt de um subagente.",
    "",
    "## Fluxo",
    FLUXO[d.area],
    d.plano ? `\n## Plano sugerido\n${d.plano}` : "",
    "",
    "## Divisão de modelos (economia de tokens)",
    "- Planejar e decidir: modelo alto (Opus/Fable) — no Claude Code, use o `/advisor` com Opus.",
    "- Executar tarefas e subagentes: modelo menor (Sonnet ou Haiku) seguindo o plano à risca.",
    "",
    "## Memória",
    "Salve a ficha (salvar_ficha) ao fim de cada etapa e registre delegações com registrar_evento (tipo 'delegacao', agente = id do subagente).",
  ].join("\n");
}

export async function lerAgente(id: string, f: typeof fetch = fetch): Promise<string> {
  const agente = CATALOGO.find((a) => a.id === id);
  if (!agente) throw new Error(`Agente "${id}" não está no catálogo.`);
  const r = await f(`${REPO_RAW}/${agente.id}.md`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Não consegui ler o agente no GitHub (${r.status}).`);
  return (await r.text()).slice(0, 30_000);
}
