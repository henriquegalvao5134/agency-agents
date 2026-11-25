import { z } from "zod";
import { iguais } from "./cofre.server";
import type { Nucleo } from "./nucleo.server";
import { roteadorDoCofre } from "./nucleo.server";
import { decidir, lerAgente, montarInstrucoes } from "./orquestrador.server";
import { Evento, Ficha, TIPOS_EVENTO } from "./types";

/**
 * Servidor MCP do núcleo (Streamable HTTP, sem estado, respostas JSON).
 * Qualquer IA que fale MCP (Claude Code, Claude desktop, ChatGPT, Cursor, Codex) se liga aqui
 * para ler/gravar fichas de retomada e registrar o que fez.
 */
const PROTOCOLOS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCOES = [
  "Você está ligado ao Segundo Cérebro da AutoGTEC/GD3. A memória do trabalho mora aqui, não no chat.",
  "0) Para qualquer trabalho de cliente/projeto (CRM, site, campanha, conteúdo, segurança), chame orquestrar primeiro: ele devolve os subagentes, o fluxo e a divisão de modelos.",
  "1) Ao começar num projeto: chame ler_ficha (ou listar_fichas se não souber o slug) e continue de onde parou.",
  "2) A cada etapa relevante concluída, e SEMPRE antes de a conversa ficar longa ou o limite acabar: chame salvar_ficha com decisões, plano, etapa atual e próximo passo.",
  "3) Registre o que fez com registrar_evento (tipo inicio/etapa/delegacao/fim) para aparecer no painel.",
  "Nunca invente dados de clientes; escreva em português do Brasil.",
].join("\n");

const textoCampo = (descricao: string) => ({ type: "string", description: descricao });
const FERRAMENTAS = [
  {
    name: "orquestrar",
    description:
      "Orquestrador da agência GD3. Envie o pedido de trabalho; ele identifica a área, escolhe os subagentes do catálogo, o fluxo (código → skills superpowers) e a divisão de modelos (planejar com modelo alto, executar com menor), e devolve tudo junto com a ficha do projeto. Você executa.",
    inputSchema: {
      type: "object",
      properties: {
        pedido: textoCampo("O que precisa ser feito, com as palavras do usuário"),
        projeto: textoCampo("Slug do projeto/cliente, se houver"),
        ferramenta: textoCampo("Quem está chamando: claude-code, claude-desktop, chatgpt..."),
      },
      required: ["pedido"],
      additionalProperties: false,
    },
  },
  {
    name: "buscar_agente",
    description:
      "Devolve as instruções completas de um agente do catálogo (id vindo do orquestrar), para usar como prompt de um subagente.",
    inputSchema: {
      type: "object",
      properties: {
        id: textoCampo("Id do agente, ex.: engineering/engineering-backend-architect"),
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_fichas",
    description:
      "Lista os projetos/clientes que têm ficha de retomada, com etapa atual e próximo passo.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ler_ficha",
    description:
      "Lê a ficha de retomada de um projeto: objetivo, decisões, plano, etapa atual, próximo passo e arquivos. Use antes de continuar qualquer trabalho.",
    inputSchema: {
      type: "object",
      properties: { projeto: textoCampo("Slug do projeto, ex.: crm-cliente-x") },
      required: ["projeto"],
      additionalProperties: false,
    },
  },
  {
    name: "salvar_ficha",
    description:
      "Cria ou substitui a ficha de retomada de um projeto. Envie o estado COMPLETO e atualizado (não só a mudança), para que outra IA consiga continuar sem reler a conversa.",
    inputSchema: {
      type: "object",
      properties: {
        projeto: textoCampo("Slug: letras minúsculas, números e hífen"),
        titulo: textoCampo("Nome legível do projeto"),
        objetivo: textoCampo("O que o projeto precisa entregar e por quê"),
        decisoes: textoCampo("Decisões tomadas até agora, em markdown"),
        plano: textoCampo("Plano/etapas, marcando o que já foi feito, em markdown"),
        etapa_atual: textoCampo("O que está sendo feito agora"),
        proximo_passo: textoCampo("O próximo passo concreto"),
        arquivos: textoCampo("Arquivos, repositórios e links mexidos"),
        atualizado_por: textoCampo("Quem salvou: ex. claude-code, claude-desktop, chatgpt"),
      },
      required: ["projeto", "titulo"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_evento",
    description:
      "Registra no painel uma atividade (início, etapa, delegação a subagente, checkpoint, fim) e, se souber, o consumo de tokens.",
    inputSchema: {
      type: "object",
      properties: {
        ferramenta: textoCampo(
          "Quem está trabalhando: claude-code, claude-desktop, chatgpt, cursor...",
        ),
        tipo: { type: "string", enum: [...TIPOS_EVENTO] },
        descricao: textoCampo("O que foi feito, em uma frase"),
        projeto: textoCampo("Slug do projeto"),
        agente: textoCampo("Agente ou subagente que fez o trabalho"),
        modelo: textoCampo("Modelo usado"),
        sessao: textoCampo("Id da sessão/conversa"),
        tokens_entrada: { type: "integer" },
        tokens_saida: { type: "integer" },
        tokens_cache: { type: "integer" },
        custo_usd: { type: "number" },
      },
      required: ["ferramenta", "tipo", "descricao"],
      additionalProperties: false,
    },
  },
];

type Rpc = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const erro = (id: Rpc["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});
const texto = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], isError });

async function chamarFerramenta(n: Nucleo, nome: string, args: Record<string, unknown>) {
  const store = n.store;
  switch (nome) {
    case "orquestrar": {
      const { pedido, projeto, ferramenta } = z
        .object({
          pedido: z.string().min(3).max(4000),
          projeto: z.string().max(80).default(""),
          ferramenta: z.string().max(60).default("desconhecida"),
        })
        .parse(args);
      const decisao = await decidir(pedido, await roteadorDoCofre(n), n.f);
      const ficha = projeto ? await store.lerFicha(projeto) : null;
      await store.registrarEvento(
        Evento.parse({
          ferramenta,
          projeto,
          agente: "orquestrador",
          tipo: "delegacao",
          descricao:
            `${decisao.area}: ${decisao.agentes.map((a) => a.nome).join(", ") || "sem agente"} — ${pedido}`.slice(
              0,
              2000,
            ),
          modelo: decisao.modelo,
          tokens_entrada: decisao.uso?.tokens_entrada ?? 0,
          tokens_saida: decisao.uso?.tokens_saida ?? 0,
          tokens_cache: decisao.uso?.tokens_cache ?? 0,
        }),
      );
      return texto(montarInstrucoes(pedido, decisao, ficha, projeto));
    }
    case "buscar_agente": {
      return texto(await lerAgente(z.string().min(1).parse(args["id"]), n.f));
    }
    case "listar_fichas": {
      const fichas = await store.listarFichas();
      return texto(
        fichas.length
          ? JSON.stringify(fichas, null, 2)
          : "Nenhuma ficha ainda. Crie uma com salvar_ficha.",
      );
    }
    case "ler_ficha": {
      const projeto = z.string().min(1).parse(args["projeto"]);
      const ficha = await store.lerFicha(projeto);
      return ficha
        ? texto(JSON.stringify(ficha, null, 2))
        : texto(`Não existe ficha para "${projeto}". Use listar_fichas ou crie com salvar_ficha.`);
    }
    case "salvar_ficha": {
      const ficha = await store.salvarFicha(Ficha.parse(args));
      await store.registrarEvento(
        Evento.parse({
          ferramenta: ficha.atualizado_por || "desconhecida",
          tipo: "checkpoint",
          projeto: ficha.projeto,
          descricao: `Ficha salva: ${ficha.etapa_atual || ficha.titulo}`.slice(0, 2000),
        }),
      );
      return texto(`Ficha "${ficha.projeto}" salva.`);
    }
    case "registrar_evento": {
      await store.registrarEvento(Evento.parse(args));
      return texto("Evento registrado.");
    }
    default:
      throw new RpcError(-32602, `Ferramenta desconhecida: ${nome}`);
  }
}
class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

async function responder(n: Nucleo, msg: Rpc) {
  switch (msg.method) {
    case "initialize": {
      const pedida =
        typeof msg.params?.["protocolVersion"] === "string" ? msg.params["protocolVersion"] : "";
      return ok(msg.id, {
        protocolVersion: PROTOCOLOS.includes(pedida) ? pedida : PROTOCOLOS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "segundo-cerebro-autogtec", version: "0.2.0" },
        instructions: INSTRUCOES,
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: FERRAMENTAS });
    case "tools/call": {
      const nome = String(msg.params?.["name"] ?? "");
      const args = (msg.params?.["arguments"] ?? {}) as Record<string, unknown>;
      try {
        return ok(msg.id, await chamarFerramenta(n, nome, args));
      } catch (e) {
        if (e instanceof RpcError) return erro(msg.id, e.code, e.message);
        const detalhe =
          e instanceof z.ZodError
            ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : e instanceof Error
              ? e.message
              : "erro desconhecido";
        return ok(msg.id, texto(`Falhou: ${detalhe}`, true));
      }
    }
    default:
      return erro(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}

/** Token pode vir no cabeçalho Authorization (Claude Code, Cursor) ou no fim da URL /api/mcp/<token> (apps que só aceitam URL). */
export function tokenDaRequisicao(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const partes = new URL(request.url).pathname.split("/").filter(Boolean);
  return partes.length === 3 && partes[0] === "api" && partes[1] === "mcp"
    ? decodeURIComponent(partes[2]!)
    : "";
}

export const tokenConfere = iguais;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function handleMcpRequest(request: Request, n: Nucleo | null): Promise<Response> {
  if (!n)
    return json(
      erro(null, -32000, "Núcleo não configurado na Cloudflare (banco D1 ou segredos faltando)."),
      503,
    );
  if (!tokenConfere(tokenDaRequisicao(request), n.token))
    return json(erro(null, -32001, "Não autorizado."), 401);
  if (request.method === "GET")
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (request.method === "DELETE") return new Response(null, { status: 204 });
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json(erro(null, -32700, "JSON inválido."), 400);
  }
  const lote = Array.isArray(corpo) ? (corpo as Rpc[]) : [corpo as Rpc];
  const respostas = [];
  for (const msg of lote) {
    if (!msg || typeof msg.method !== "string") {
      respostas.push(erro(null, -32600, "Requisição inválida."));
      continue;
    }
    if (msg.id === undefined) continue; // notificação (ex.: notifications/initialized): não tem resposta
    respostas.push(await responder(n, msg));
  }
  if (!respostas.length) return new Response(null, { status: 202 });
  return json(Array.isArray(corpo) ? respostas : respostas[0]);
}
