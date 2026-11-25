import { z } from "zod";
import {
  COOKIE_SESSAO,
  cifrar,
  cookieSaida,
  cookieSessao,
  criarSessao,
  decifrar,
  iguais,
  lerCookie,
  sessaoValida,
} from "./cofre.server";
import { chamarModelo } from "./llm.server";
import type { Nucleo } from "./nucleo.server";
import { roteadorDoCofre } from "./nucleo.server";
import { decidir, montarInstrucoes } from "./orquestrador.server";
import { resumirAtividade } from "./store.server";
import { NovoProvedor, PAPEIS, type Provedor } from "./types";

/**
 * Rotas do painel (navegador). Exigem login: cookie de sessão assinado, HttpOnly, SameSite=Strict.
 *   POST   /api/painel/entrar               { senha }
 *   POST   /api/painel/sair
 *   GET    /api/painel/sessao
 *   GET    /api/painel/atividade
 *   GET    /api/painel/fichas               (projetos e onde pararam)
 *   GET    /api/painel/provedores           (nunca devolve a chave)
 *   POST   /api/painel/provedores           { nome, fornecedor, modelo, papel, cor, chave }
 *   PATCH  /api/painel/provedores/<id>      { papel }
 *   DELETE /api/painel/provedores/<id>
 *   POST   /api/painel/provedores/<id>/testar
 *   POST   /api/painel/perguntar            { provedorId, pedido, skill, delegar } — a caixa do cérebro
 */
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const semChave = ({
  chave_cifrada: _c,
  iv: _i,
  ...p
}: Provedor & { chave_cifrada: string; iv: string }): Provedor => p;

/** Bloqueia pedidos de escrita vindos de outro site (CSRF), além do SameSite=Strict do cookie. */
function mesmaOrigem(request: Request) {
  const origem = request.headers.get("origin");
  return !origem || origem === new URL(request.url).origin;
}

export async function handlePainel(request: Request, n: Nucleo | null): Promise<Response> {
  const partes = new URL(request.url).pathname.split("/").filter(Boolean); // ["api","painel",...]
  const rota = partes.slice(2);
  const metodo = request.method;
  if (!n)
    return rota[0] === "sessao"
      ? json({ configurado: false, logado: false })
      : json({ erro: "Núcleo não configurado." }, 503);
  if (metodo !== "GET" && !mesmaOrigem(request))
    return json({ erro: "Origem não permitida." }, 403);

  if (rota[0] === "entrar" && metodo === "POST") {
    const { senha } = z
      .object({ senha: z.string().max(200) })
      .parse(await request.json().catch(() => ({ senha: "" })));
    if (!iguais(senha, n.senhaPainel)) {
      await new Promise((r) => setTimeout(r, 800)); // freia tentativa e erro
      return json({ erro: "Senha incorreta." }, 401);
    }
    return json({ ok: true }, 200, {
      "set-cookie": cookieSessao(await criarSessao(n.chaveMestra)),
    });
  }
  if (rota[0] === "sair" && metodo === "POST")
    return json({ ok: true }, 200, { "set-cookie": cookieSaida() });

  const logado = await sessaoValida(lerCookie(request, COOKIE_SESSAO), n.chaveMestra);
  if (rota[0] === "sessao") return json({ configurado: true, logado });
  if (!logado) return json({ erro: "Entre no painel." }, 401);

  try {
    if (rota[0] === "atividade" && metodo === "GET") {
      const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      return json(resumirAtividade(await n.store.eventosDesde(desde, 2000)));
    }
    if (rota[0] === "fichas" && metodo === "GET") return json(await n.store.listarFichas());
    if (rota[0] === "perguntar" && metodo === "POST") {
      const { provedorId, pedido, skill, delegar } = z
        .object({
          provedorId: z.string().min(1),
          pedido: z.string().trim().min(1).max(4000),
          skill: z.string().max(60).default(""),
          delegar: z.boolean().default(true),
        })
        .parse(await request.json());
      const executor = (await n.store.listarProvedores()).find((p) => p.id === provedorId);
      if (!executor)
        return json(
          { erro: "Essa IA não está no cofre. Cadastre a chave dela no Cofre de IAs." },
          404,
        );
      const decisao = delegar ? await decidir(pedido, await roteadorDoCofre(n), n.f) : null;
      if (decisao) {
        await n.store.registrarEvento({
          ferramenta: "plataforma",
          sessao: "",
          projeto: "",
          agente: "orquestrador",
          tipo: "delegacao",
          descricao:
            `${decisao.area}: ${decisao.agentes.map((a) => a.nome).join(", ") || "sem agente"} → ${executor.nome}`.slice(
              0,
              2000,
            ),
          modelo: decisao.modelo,
          tokens_entrada: decisao.uso?.tokens_entrada ?? 0,
          tokens_saida: decisao.uso?.tokens_saida ?? 0,
          tokens_cache: decisao.uso?.tokens_cache ?? 0,
          meta: {
            area: decisao.area,
            agentes: decisao.agentes.map((a) => a.id),
            nomes: decisao.agentes.map((a) => a.nome),
          },
          custo_usd: 0,
          limite_5h_pct: null,
          limite_7d_pct: null,
        });
      }
      const sistema = [
        `Você é "${executor.nome}", uma IA ligada ao Segundo Cérebro da AutoGTEC/GD3 (agência de marketing e desenvolvimento de software).`,
        skill ? `Skill em uso: ${skill}.` : "",
        decisao
          ? `O orquestrador preparou isto para você seguir:\n${montarInstrucoes(pedido, decisao, null, "")}`
          : "",
        "Responda em português do Brasil, prático e direto. Não invente dados de clientes.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const chave = await decifrar(executor.chave_cifrada, executor.iv, n.chaveMestra);
      const r = await chamarModelo(executor, chave, sistema, pedido, 1500, n.f);
      await n.store.registrarEvento({
        ferramenta: "plataforma",
        sessao: "",
        projeto: "",
        agente: executor.nome,
        tipo: "etapa",
        descricao: pedido.slice(0, 300),
        modelo: executor.modelo,
        tokens_entrada: r.tokens_entrada,
        tokens_saida: r.tokens_saida,
        tokens_cache: r.tokens_cache,
        custo_usd: 0,
        limite_5h_pct: null,
        limite_7d_pct: null,
        meta: {},
      });
      return json({
        ok: true,
        texto: r.texto,
        area: decisao?.area ?? null,
        agentes: decisao?.agentes.map((a) => a.nome) ?? [],
        viaIa: decisao?.viaIa ?? false,
      });
    }
    if (rota[0] === "provedores") {
      const id = rota[1] ? decodeURIComponent(rota[1]) : "";
      if (!id && metodo === "GET") return json((await n.store.listarProvedores()).map(semChave));
      if (!id && metodo === "POST") {
        const novo = NovoProvedor.parse(await request.json());
        const { cifra, iv } = await cifrar(novo.chave, n.chaveMestra);
        const { chave, ...resto } = novo;
        // Só uma IA pode ser o orquestrador: quem entra com esse papel assume o lugar.
        if (resto.papel === "orquestrador") {
          for (const p of await n.store.listarProvedores())
            if (p.papel === "orquestrador") await n.store.salvarProvedor({ ...p, papel: "" });
        }
        const provedor = {
          ...resto,
          id: crypto.randomUUID(),
          final_chave: chave.slice(-4),
          criado_em: new Date().toISOString(),
          chave_cifrada: cifra,
          iv,
        };
        await n.store.salvarProvedor(provedor);
        return json(semChave(provedor), 201);
      }
      const atual = (await n.store.listarProvedores()).find((p) => p.id === id);
      if (!atual) return json({ erro: "IA não encontrada." }, 404);
      if (rota[2] === undefined && metodo === "DELETE") {
        await n.store.removerProvedor(id);
        return json({ ok: true });
      }
      if (rota[2] === undefined && metodo === "PATCH") {
        const { papel } = z.object({ papel: z.enum(PAPEIS) }).parse(await request.json());
        if (papel === "orquestrador") {
          for (const p of await n.store.listarProvedores())
            if (p.papel === "orquestrador" && p.id !== id)
              await n.store.salvarProvedor({ ...p, papel: "" });
        }
        await n.store.salvarProvedor({ ...atual, papel });
        return json(semChave({ ...atual, papel }));
      }
      if (rota[2] === "testar" && metodo === "POST") {
        const chave = await decifrar(atual.chave_cifrada, atual.iv, n.chaveMestra);
        try {
          const r = await chamarModelo(
            atual,
            chave,
            "Responda apenas: ok",
            "teste de conexão",
            20,
            n.f,
          );
          await n.store.registrarEvento({
            ferramenta: "plataforma",
            sessao: "",
            projeto: "",
            agente: atual.nome,
            tipo: "etapa",
            descricao: "Teste de conexão da chave",
            modelo: atual.modelo,
            tokens_entrada: r.tokens_entrada,
            tokens_saida: r.tokens_saida,
            tokens_cache: r.tokens_cache,
            custo_usd: 0,
            limite_5h_pct: null,
            limite_7d_pct: null,
            meta: {},
          });
          return json({ ok: true, resposta: r.texto.slice(0, 100) });
        } catch (e) {
          return json({ ok: false, erro: e instanceof Error ? e.message : "Falha no teste." });
        }
      }
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
    return json({ erro: e instanceof Error ? e.message : "Erro desconhecido." }, 500);
  }
}
