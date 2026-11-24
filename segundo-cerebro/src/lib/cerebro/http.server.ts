import { z } from "zod";
import { tokenConfere } from "./mcp.server";
import type { CerebroStore } from "./store.server";
import { Evento } from "./types";

/**
 * Rotas simples para os ganchos automáticos (hooks do Claude Code, scripts, n8n):
 *   POST /api/cerebro/eventos         → registra um evento ou uma lista de eventos
 *   GET  /api/cerebro/fichas/<slug>   → devolve a ficha de retomada (texto pronto para injetar no contexto)
 * Todas exigem Authorization: Bearer <CEREBRO_TOKEN>.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function handleCerebroHttp(
  request: Request,
  store: CerebroStore | null,
  token: string | null,
): Promise<Response> {
  if (!store || !token) return json({ erro: "Núcleo não configurado." }, 503);
  const header = request.headers.get("authorization") ?? "";
  if (
    !tokenConfere(header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "", token)
  )
    return json({ erro: "Não autorizado." }, 401);
  const partes = new URL(request.url).pathname.split("/").filter(Boolean); // ["api","cerebro",...]
  try {
    if (request.method === "POST" && partes[2] === "eventos" && partes.length === 3) {
      const corpo: unknown = await request.json();
      const eventos = z
        .array(Evento)
        .max(100)
        .parse(Array.isArray(corpo) ? corpo : [corpo]);
      for (const e of eventos) await store.registrarEvento(e);
      return json({ ok: true, registrados: eventos.length });
    }
    if (request.method === "GET" && partes[2] === "fichas" && partes.length === 4) {
      const ficha = await store.lerFicha(decodeURIComponent(partes[3]!));
      return ficha ? json(ficha) : json({ erro: "Ficha não encontrada." }, 404);
    }
    if (request.method === "GET" && partes[2] === "fichas" && partes.length === 3) {
      return json(await store.listarFichas());
    }
    return json({ erro: "Rota não encontrada." }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          erro: "Dados inválidos.",
          detalhes: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        400,
      );
    if (e instanceof SyntaxError) return json({ erro: "JSON inválido." }, 400);
    return json({ erro: e instanceof Error ? e.message : "Erro desconhecido." }, 502);
  }
}
