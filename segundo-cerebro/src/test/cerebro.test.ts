import { describe, expect, it } from "vitest";
import { handleMcpRequest, tokenDaRequisicao } from "@/lib/cerebro/mcp.server";
import { handleCerebroHttp } from "@/lib/cerebro/http.server";
import { resumirAtividade, type CerebroStore } from "@/lib/cerebro/store.server";
import type { Evento, EventoSalvo, Ficha } from "@/lib/cerebro/types";

function memoria(): CerebroStore & { fichas: Map<string, Ficha>; eventos: Evento[] } {
  const fichas = new Map<string, Ficha>();
  const eventos: Evento[] = [];
  return {
    fichas,
    eventos,
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
  };
}
const TOKEN = "segredo-teste-123";
const rpc = (body: unknown, token = TOKEN, path = "/api/mcp") =>
  new Request(`https://x.dev${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe("porta MCP do núcleo", () => {
  it("recusa sem token e avisa quando o núcleo não está configurado", async () => {
    expect(
      (await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, ""), memoria(), TOKEN))
        .status,
    ).toBe(401);
    expect(
      (await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }), null, null)).status,
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
        memoria(),
        TOKEN,
      )
    ).json();
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.instructions).toContain("ler_ficha");
    const lista = await (
      await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }), memoria(), TOKEN)
    ).json();
    expect(lista.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "listar_fichas",
      "ler_ficha",
      "salvar_ficha",
      "registrar_evento",
    ]);
    expect(
      (
        await handleMcpRequest(
          rpc({ jsonrpc: "2.0", method: "notifications/initialized" }),
          memoria(),
          TOKEN,
        )
      ).status,
    ).toBe(202);
  });

  it("salva e lê a ficha de retomada, registrando um checkpoint", async () => {
    const store = memoria();
    const call = (name: string, args: unknown) =>
      handleMcpRequest(
        rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }),
        store,
        TOKEN,
      ).then((r) => r.json());
    const salvo = await call("salvar_ficha", {
      projeto: "crm-cliente-x",
      titulo: "CRM do cliente X",
      etapa_atual: "Levantamento",
      proximo_passo: "Mapear funil",
      atualizado_por: "claude-code",
    });
    expect(salvo.result.isError).toBe(false);
    expect(store.eventos[0]).toMatchObject({
      tipo: "checkpoint",
      projeto: "crm-cliente-x",
      ferramenta: "claude-code",
    });
    const lido = await call("ler_ficha", { projeto: "crm-cliente-x" });
    expect(lido.result.content[0].text).toContain("Mapear funil");
  });

  it("devolve erro legível para dados inválidos, sem derrubar a conexão", async () => {
    const r = await (
      await handleMcpRequest(
        rpc({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "salvar_ficha", arguments: { projeto: "Nome Com Espaço", titulo: "x" } },
        }),
        memoria(),
        TOKEN,
      )
    ).json();
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toContain("slug");
  });
});

describe("rotas dos ganchos automáticos", () => {
  it("registra uma lista de eventos com token", async () => {
    const store = memoria();
    const req = new Request("https://x.dev/api/cerebro/eventos", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify([{ ferramenta: "claude-code", tipo: "uso", tokens_entrada: 10 }]),
    });
    const r = await handleCerebroHttp(req, store, TOKEN);
    expect(r.status).toBe(200);
    expect(store.eventos[0]!.tokens_entrada).toBe(10);
  });
  it("recusa token errado", async () => {
    const req = new Request("https://x.dev/api/cerebro/fichas", {
      headers: { authorization: "Bearer errado" },
    });
    expect((await handleCerebroHttp(req, memoria(), TOKEN)).status).toBe(401);
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
    const agora = new Date();
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
      agora,
    );
    expect(r.consumo[0]).toMatchObject({ agente: "backend-architect", tokens: 1200 });
    expect(r.limites).toMatchObject({ limite_5h_pct: 40, limite_7d_pct: 12 });
    expect(r.ativos).toEqual(["claude-code"]);
    expect(r.semana.tokens).toBe(1700);
  });
});
