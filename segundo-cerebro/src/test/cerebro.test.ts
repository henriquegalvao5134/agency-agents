import { describe, expect, it } from "vitest";
import { handleMcpRequest, tokenDaRequisicao } from "@/lib/cerebro/mcp.server";
import { handleCerebroHttp } from "@/lib/cerebro/http.server";
import { handlePainel } from "@/lib/cerebro/painel.server";
import { cifrar, criarSessao, decifrar, sessaoValida } from "@/lib/cerebro/cofre.server";
import { candidatos, detectarArea } from "@/lib/cerebro/orquestrador.server";
import {
  resumirAtividade,
  type CerebroStore,
  type ProvedorCifrado,
} from "@/lib/cerebro/store.server";
import type { Nucleo } from "@/lib/cerebro/nucleo.server";
import type { Evento, EventoSalvo, Ficha } from "@/lib/cerebro/types";

const TOKEN = "segredo-teste-123";
const SENHA = "senha-do-painel";
const MESTRA = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

type Memoria = CerebroStore & {
  fichas: Map<string, Ficha>;
  eventos: Evento[];
  provs: Map<string, ProvedorCifrado>;
};
function memoria(): Memoria {
  const fichas = new Map<string, Ficha>();
  const eventos: Evento[] = [];
  const provs = new Map<string, ProvedorCifrado>();
  return {
    fichas,
    eventos,
    provs,
    async lerFicha(p) {
      return fichas.get(p) ?? null;
    },
    async salvarFicha(f) {
      fichas.set(f.projeto, f);
      return f;
    },
    async listarFichas() {
      return [...fichas.values()];
    },
    async registrarEvento(e) {
      eventos.push(e);
    },
    async eventosDesde() {
      return [];
    },
    async listarProvedores() {
      return [...provs.values()];
    },
    async salvarProvedor(p) {
      provs.set(p.id, p);
    },
    async removerProvedor(id) {
      provs.delete(id);
    },
  };
}
const nucleo = (
  store: Memoria = memoria(),
  f: typeof fetch = fetch,
): Nucleo & { store: Memoria } => ({
  store,
  token: TOKEN,
  senhaPainel: SENHA,
  chaveMestra: MESTRA,
  f,
});
const rpc = (body: unknown, token = TOKEN, path = "/api/mcp") =>
  new Request(`https://x.dev${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
const chamar = (n: Nucleo, name: string, args: unknown) =>
  handleMcpRequest(
    rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }),
    n,
  ).then((r) => r.json());

describe("porta MCP do núcleo", () => {
  it("recusa sem token e avisa quando o núcleo não está configurado", async () => {
    expect(
      (await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, ""), nucleo())).status,
    ).toBe(401);
    expect(
      (await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }), null)).status,
    ).toBe(503);
  });

  it("aceita o token no fim da URL para apps que só aceitam endereço", () => {
    expect(tokenDaRequisicao(new Request(`https://x.dev/api/mcp/${TOKEN}`))).toBe(TOKEN);
  });

  it("inicializa, lista ferramentas e responde notificação com 202", async () => {
    const init = await (
      await handleMcpRequest(
        rpc({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        }),
        nucleo(),
      )
    ).json();
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.instructions).toContain("orquestrar");
    const lista = await (
      await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }), nucleo())
    ).json();
    expect(lista.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "orquestrar",
      "buscar_agente",
      "listar_fichas",
      "ler_ficha",
      "salvar_ficha",
      "registrar_evento",
    ]);
    expect(
      (
        await handleMcpRequest(
          rpc({ jsonrpc: "2.0", method: "notifications/initialized" }),
          nucleo(),
        )
      ).status,
    ).toBe(202);
  });

  it("salva e lê a ficha de retomada, registrando um checkpoint", async () => {
    const n = nucleo();
    const salvo = await chamar(n, "salvar_ficha", {
      projeto: "crm-cliente-x",
      titulo: "CRM do cliente X",
      proximo_passo: "Mapear funil",
      atualizado_por: "claude-code",
    });
    expect(salvo.result.isError).toBe(false);
    expect(n.store.eventos[0]).toMatchObject({
      tipo: "checkpoint",
      projeto: "crm-cliente-x",
      ferramenta: "claude-code",
    });
    expect(
      (await chamar(n, "ler_ficha", { projeto: "crm-cliente-x" })).result.content[0].text,
    ).toContain("Mapear funil");
  });

  it("devolve erro legível para dados inválidos, sem derrubar a conexão", async () => {
    const r = await chamar(nucleo(), "salvar_ficha", { projeto: "Nome Com Espaço", titulo: "x" });
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toContain("slug");
  });

  it("orquestra sem IA cadastrada: escolhe área, subagentes do catálogo e fluxo superpowers para código", async () => {
    const n = nucleo();
    n.store.fichas.set("crm-x", {
      projeto: "crm-x",
      titulo: "CRM X",
      objetivo: "CRM",
      decisoes: "",
      plano: "",
      etapa_atual: "início",
      proximo_passo: "levantar",
      arquivos: "",
      atualizado_por: "",
    });
    const r = await chamar(n, "orquestrar", {
      pedido: "Construir o CRM e a integração com o banco de dados do cliente",
      projeto: "crm-x",
      ferramenta: "claude-code",
    });
    const texto: string = r.result.content[0].text;
    expect(texto).toContain("# Orquestrador GD3 — desenvolvimento");
    expect(texto).toContain("superpowers:brainstorming");
    expect(texto).toContain("CRM X");
    expect(n.store.eventos.at(-1)).toMatchObject({
      tipo: "delegacao",
      agente: "orquestrador",
      ferramenta: "claude-code",
      projeto: "crm-x",
    });
    // O evento leva os nomes reais do catálogo, na mesma ordem dos ids, para o cérebro mostrar.
    const meta = n.store.eventos.at(-1)!.meta as { agentes: string[]; nomes: string[] };
    expect(meta.nomes).toHaveLength(meta.agentes.length);
    expect(meta.nomes.length).toBeGreaterThan(0);
    expect(texto).toContain(meta.nomes[0]!);
  });

  it("orquestra com a IA do cofre usando a chave decifrada e registra o consumo", async () => {
    const n = nucleo();
    const { cifra, iv } = await cifrar("sk-ant-chave-de-teste", MESTRA);
    n.store.provs.set("p1", {
      id: "p1",
      nome: "Haiku",
      fornecedor: "anthropic",
      modelo: "claude-haiku-5-5",
      papel: "orquestrador",
      cor: "cyan",
      final_chave: "este",
      criado_em: "",
      chave_cifrada: cifra,
      iv,
    });
    const pedido = "campanha de anúncios no Meta para o cliente";
    const lista = candidatos(pedido, "marketing");
    let chaveUsada = "";
    n.f = (async (_url: string, init: RequestInit) => {
      chaveUsada = (init.headers as Record<string, string>)["x-api-key"]!;
      const resposta = JSON.stringify({
        area: "marketing",
        agentes: [lista[0]!.id],
        plano: "1. Briefing",
      });
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: resposta }],
          usage: { input_tokens: 500, output_tokens: 40 },
        }),
      );
    }) as typeof fetch;
    const r = await chamar(n, "orquestrar", { pedido, ferramenta: "claude-code" });
    expect(chaveUsada).toBe("sk-ant-chave-de-teste");
    expect(r.result.content[0].text).toContain("Roteado por IA (claude-haiku-5-5)");
    expect(r.result.content[0].text).toContain(lista[0]!.nome);
    expect(n.store.eventos.at(-1)).toMatchObject({
      tokens_entrada: 500,
      tokens_saida: 40,
      modelo: "claude-haiku-5-5",
    });
  });

  it("busca as instruções completas de um agente só se ele estiver no catálogo", async () => {
    const n = nucleo(
      memoria(),
      (async (url: string) => new Response(`conteúdo de ${url}`)) as typeof fetch,
    );
    const ok = await chamar(n, "buscar_agente", { id: "specialized/agents-orchestrator" });
    expect(ok.result.content[0].text).toContain("specialized/agents-orchestrator.md");
    const fora = await chamar(n, "buscar_agente", { id: "../../segredo" });
    expect(fora.result.isError).toBe(true);
  });
});

describe("orquestrador por pontuação", () => {
  it("detecta a área pelo pedido em português", () => {
    expect(detectarArea("subir campanha de tráfego no Instagram")).toBe("marketing");
    expect(detectarArea("teste de invasão e vulnerabilidade no servidor")).toBe("seguranca");
    expect(detectarArea("criar o sistema de CRM")).toBe("desenvolvimento");
  });
});

describe("cofre e sessão", () => {
  it("cifra e decifra a chave; com outra chave mestra não abre", async () => {
    const { cifra, iv } = await cifrar("sk-segredo", MESTRA);
    expect(cifra).not.toContain("sk-segredo");
    expect(await decifrar(cifra, iv, MESTRA)).toBe("sk-segredo");
    const outra = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
    await expect(decifrar(cifra, iv, outra)).rejects.toThrow();
  });
  it("sessão assinada expira e não aceita adulteração", async () => {
    const s = await criarSessao(MESTRA, 1000);
    expect(await sessaoValida(s, MESTRA, 2000)).toBe(true);
    expect(await sessaoValida(s, MESTRA, 1000 + 15 * 24 * 3600_000)).toBe(false);
    expect(await sessaoValida(s.replace(/^\d+/, "99999999999999"), MESTRA, 2000)).toBe(false);
  });
});

describe("painel protegido", () => {
  const req = (path: string, init: RequestInit = {}, cookie = "") =>
    new Request(`https://x.dev/api/painel/${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...((init.headers as Record<string, string>) ?? {}),
      },
    });

  it("sem login não mostra atividade nem cofre; senha errada é recusada", async () => {
    const n = nucleo();
    expect((await handlePainel(req("atividade"), n)).status).toBe(401);
    expect((await handlePainel(req("provedores"), n)).status).toBe(401);
    expect(
      (
        await handlePainel(
          req("entrar", { method: "POST", body: JSON.stringify({ senha: "errada" }) }),
          n,
        )
      ).status,
    ).toBe(401);
  });

  it("com login cadastra a IA, guarda a chave cifrada e nunca devolve a chave", async () => {
    const n = nucleo();
    const entrar = await handlePainel(
      req("entrar", { method: "POST", body: JSON.stringify({ senha: SENHA }) }),
      n,
    );
    expect(entrar.headers.get("set-cookie")).toContain("HttpOnly");
    const cookie = entrar.headers.get("set-cookie")!.split(";")[0]!;
    const corpoNovo = {
      nome: "Haiku",
      fornecedor: "anthropic",
      modelo: "claude-haiku-5-5",
      papel: "orquestrador",
      chave: "sk-ant-1234567890-ABCD",
    };
    const criado = await handlePainel(
      req("provedores", { method: "POST", body: JSON.stringify(corpoNovo) }, cookie),
      n,
    );
    const corpo = await criado.text();
    expect(criado.status).toBe(201);
    expect(corpo).not.toContain("sk-ant");
    expect(JSON.parse(corpo).final_chave).toBe("ABCD");
    expect([...n.store.provs.values()][0]!.chave_cifrada).not.toContain("sk-ant");
    const lista = await (await handlePainel(req("provedores", {}, cookie), n)).text();
    expect(lista).not.toContain("chave_cifrada");
    expect(lista).not.toContain("sk-ant");
  });

  it("GET fichas exige login e devolve as fichas salvas", async () => {
    const n = nucleo();
    expect((await handlePainel(req("fichas"), n)).status).toBe(401);
    const entrar = await handlePainel(
      req("entrar", { method: "POST", body: JSON.stringify({ senha: SENHA }) }),
      n,
    );
    const cookie = entrar.headers.get("set-cookie")!.split(";")[0]!;
    await n.store.salvarFicha({
      projeto: "crm-x",
      titulo: "CRM X",
      objetivo: "",
      decisoes: "",
      plano: "",
      etapa_atual: "login",
      proximo_passo: "telas",
      arquivos: "",
      atualizado_por: "codex",
    });
    const r = await handlePainel(req("fichas", {}, cookie), n);
    expect(r.status).toBe(200);
    const lista = (await r.json()) as { projeto: string }[];
    expect(lista.map((f) => f.projeto)).toEqual(["crm-x"]);
  });

  it("recusa escrita vinda de outro site", async () => {
    const r = await handlePainel(
      req("entrar", {
        method: "POST",
        headers: { origin: "https://malicioso.com" },
        body: JSON.stringify({ senha: SENHA }),
      }),
      nucleo(),
    );
    expect(r.status).toBe(403);
  });
});

describe("rotas dos ganchos automáticos", () => {
  it("registra uma lista de eventos com token e recusa token errado", async () => {
    const n = nucleo();
    const ok = new Request("https://x.dev/api/cerebro/eventos", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify([{ ferramenta: "claude-code", tipo: "uso", tokens_entrada: 10 }]),
    });
    expect((await handleCerebroHttp(ok, n)).status).toBe(200);
    expect(n.store.eventos[0]!.tokens_entrada).toBe(10);
    const ruim = new Request("https://x.dev/api/cerebro/fichas", {
      headers: { authorization: "Bearer errado" },
    });
    expect((await handleCerebroHttp(ruim, n)).status).toBe(401);
  });
});

describe("resumo de atividade para o painel", () => {
  const ev = (p: Partial<EventoSalvo>): EventoSalvo => ({
    id: 1,
    criado_em: new Date().toISOString(),
    ferramenta: "claude-code",
    sessao: "",
    projeto: "",
    agente: "",
    tipo: "uso",
    descricao: "",
    modelo: "",
    tokens_entrada: 0,
    tokens_saida: 0,
    tokens_cache: 0,
    custo_usd: 0,
    limite_5h_pct: null,
    limite_7d_pct: null,
    meta: {},
    ...p,
  });
  it("soma consumo por agente, pega o limite mais recente e marca quem está ativo", () => {
    const r = resumirAtividade(
      [
        ev({
          id: 3,
          agente: "backend-architect",
          tokens_entrada: 1000,
          limite_5h_pct: 40,
          limite_7d_pct: 12,
        }),
        ev({ id: 2, ferramenta: "chatgpt", tipo: "fim", tokens_saida: 500 }),
        ev({
          id: 1,
          agente: "backend-architect",
          tokens_saida: 200,
          limite_5h_pct: 10,
          limite_7d_pct: 5,
        }),
      ],
      new Date(),
    );
    expect(r.consumo[0]).toMatchObject({ agente: "backend-architect", tokens: 1200 });
    expect(r.limites).toMatchObject({ limite_5h_pct: 40, limite_7d_pct: 12 });
    expect(r.ativos).toEqual(["claude-code"]);
    expect(r.semana.tokens).toBe(1700);
  });
  it("delegações trazem os nomes dos agentes (vazio em eventos antigos sem nomes)", () => {
    const r = resumirAtividade(
      [
        ev({
          id: 2,
          tipo: "delegacao",
          agente: "orquestrador",
          meta: {
            area: "desenvolvimento",
            agentes: ["engineering/engineering-backend-architect"],
            nomes: ["Backend Architect"],
          },
        }),
        ev({
          id: 1,
          tipo: "delegacao",
          agente: "orquestrador",
          meta: { area: "marketing", agentes: ["marketing/marketing-x"] },
        }),
      ],
      new Date(),
    );
    expect(r.delegacoes.map((d) => d.nomes)).toEqual([["Backend Architect"], []]);
  });
});
