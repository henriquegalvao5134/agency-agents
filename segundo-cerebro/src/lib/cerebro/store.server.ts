import type { Atividade, ConsumoAgente, Evento, EventoSalvo, Ficha } from "./types";

/** Onde o núcleo guarda memória e registro. Interface pequena para poder trocar de banco (Supabase hoje, VPS depois). */
export interface CerebroStore {
  lerFicha(projeto: string): Promise<Ficha | null>;
  salvarFicha(ficha: Ficha): Promise<Ficha>;
  listarFichas(): Promise<
    Pick<
      Ficha,
      "projeto" | "titulo" | "etapa_atual" | "proximo_passo" | "atualizado_por" | "atualizado_em"
    >[]
  >;
  registrarEvento(evento: Evento): Promise<void>;
  eventosDesde(desdeIso: string, limite?: number): Promise<EventoSalvo[]>;
}

export type CerebroEnv = { url: string; chave: string; token: string };

/** Lê a configuração do núcleo. Nada aqui vem da Lovable. */
export function cerebroEnv(): CerebroEnv | null {
  const url = process.env["CEREBRO_SUPABASE_URL"]?.replace(/\/+$/, "");
  const chave = process.env["CEREBRO_SUPABASE_SERVICE_KEY"];
  const token = process.env["CEREBRO_TOKEN"];
  if (!url || !chave || !token) return null;
  return { url, chave, token };
}

/** Implementação via API REST do Supabase (PostgREST), sem SDK, para rodar igual na Cloudflare e na VPS. */
export function supabaseStore(
  env: Pick<CerebroEnv, "url" | "chave">,
  f: typeof fetch = fetch,
): CerebroStore {
  const base = `${env.url}/rest/v1`;
  const headers = {
    apikey: env.chave,
    Authorization: `Bearer ${env.chave}`,
    "Content-Type": "application/json",
  };
  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await f(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok)
      throw new Error(
        `Banco do núcleo respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    async lerFicha(projeto) {
      const rows = await req<Ficha[]>(
        `/cerebro_fichas?projeto=eq.${encodeURIComponent(projeto)}&limit=1`,
      );
      return rows[0] ?? null;
    },
    async salvarFicha(ficha) {
      const rows = await req<Ficha[]>(`/cerebro_fichas?on_conflict=projeto`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ ...ficha, atualizado_em: new Date().toISOString() }),
      });
      return rows[0] ?? ficha;
    },
    async listarFichas() {
      return req(
        `/cerebro_fichas?select=projeto,titulo,etapa_atual,proximo_passo,atualizado_por,atualizado_em&order=atualizado_em.desc&limit=100`,
      );
    },
    async registrarEvento(evento) {
      await req(`/cerebro_eventos`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(evento),
      });
    },
    async eventosDesde(desdeIso, limite = 1000) {
      return req<EventoSalvo[]>(
        `/cerebro_eventos?criado_em=gte.${encodeURIComponent(desdeIso)}&order=criado_em.desc&limit=${limite}`,
      );
    },
  };
}

const totalTokens = (e: Evento) => e.tokens_entrada + e.tokens_saida + e.tokens_cache;

/** Resume o registro para o painel: consumo por agente, hoje, semana, limites da assinatura e quem está ativo. */
export function resumirAtividade(eventos: EventoSalvo[], agora = new Date()): Atividade {
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const ativosDesde = agora.getTime() - 3 * 60_000;
  const porAgente = new Map<string, ConsumoAgente>();
  const hoje = { tokens: 0, custo_usd: 0 },
    semana = { tokens: 0, custo_usd: 0 };
  let limites: Atividade["limites"] = { limite_5h_pct: null, limite_7d_pct: null, em: null };
  const ativos = new Set<string>();
  const vistas = new Set<string>();
  for (const e of eventos) {
    const t = totalTokens(e),
      custo = Number(e.custo_usd) || 0,
      quando = new Date(e.criado_em);
    semana.tokens += t;
    semana.custo_usd += custo;
    if (quando >= inicioHoje) {
      hoje.tokens += t;
      hoje.custo_usd += custo;
    }
    const nome = e.agente || e.ferramenta;
    const chave = `${e.ferramenta}::${nome}`;
    const atual = porAgente.get(chave) ?? {
      agente: nome,
      ferramenta: e.ferramenta,
      eventos: 0,
      tokens: 0,
      custo_usd: 0,
      ultimo: e.criado_em,
    };
    atual.eventos += 1;
    atual.tokens += t;
    atual.custo_usd += custo;
    if (e.criado_em > atual.ultimo) atual.ultimo = e.criado_em;
    porAgente.set(chave, atual);
    if (limites.em === null && (e.limite_5h_pct !== null || e.limite_7d_pct !== null)) {
      limites = {
        limite_5h_pct: e.limite_5h_pct === null ? null : Number(e.limite_5h_pct),
        limite_7d_pct: e.limite_7d_pct === null ? null : Number(e.limite_7d_pct),
        em: e.criado_em,
      };
    }
    // Eventos vêm do mais novo para o mais antigo: o primeiro de cada ferramenta decide se ela está ativa agora.
    if (!vistas.has(e.ferramenta)) {
      vistas.add(e.ferramenta);
      if (quando.getTime() >= ativosDesde && e.tipo !== "fim") ativos.add(e.ferramenta);
    }
  }
  return {
    configurado: true,
    eventos: eventos.slice(0, 50).map(({ meta: _meta, ...resto }) => resto),
    consumo: [...porAgente.values()].sort((a, b) => b.tokens - a.tokens),
    hoje,
    semana,
    limites,
    ativos: [...ativos],
  };
}
