import type { D1Database } from "./ambiente.server";
import type { Atividade, ConsumoAgente, Evento, EventoSalvo, Ficha, Provedor } from "./types";

/** Provedor como guardado no banco: com a chave cifrada (nunca devolvida ao navegador). */
export type ProvedorCifrado = Provedor & { chave_cifrada: string; iv: string };

/** Onde o núcleo guarda memória, registro e cofre. Interface pequena para poder trocar de banco no futuro. */
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
  listarProvedores(): Promise<ProvedorCifrado[]>;
  salvarProvedor(p: ProvedorCifrado): Promise<void>;
  removerProvedor(id: string): Promise<void>;
}

const CAMPOS_FICHA = [
  "projeto",
  "titulo",
  "objetivo",
  "decisoes",
  "plano",
  "etapa_atual",
  "proximo_passo",
  "arquivos",
  "atualizado_por",
] as const;
const CAMPOS_EVENTO = [
  "ferramenta",
  "sessao",
  "projeto",
  "agente",
  "tipo",
  "descricao",
  "modelo",
  "tokens_entrada",
  "tokens_saida",
  "tokens_cache",
  "custo_usd",
  "limite_5h_pct",
  "limite_7d_pct",
  "meta",
] as const;
const CAMPOS_PROVEDOR = [
  "id",
  "nome",
  "fornecedor",
  "modelo",
  "papel",
  "cor",
  "chave_cifrada",
  "iv",
  "final_chave",
] as const;
const agoraIso = () => new Date().toISOString();
const lerMeta = (m: string) => {
  try {
    return JSON.parse(m) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** Implementação no D1 da Cloudflare (SQLite). */
export function d1Store(db: D1Database): CerebroStore {
  return {
    async lerFicha(projeto) {
      return db.prepare("SELECT * FROM fichas WHERE projeto = ?").bind(projeto).first<Ficha>();
    },
    async salvarFicha(ficha) {
      const atualizar = CAMPOS_FICHA.filter((c) => c !== "projeto")
        .map((c) => `${c} = excluded.${c}`)
        .join(", ");
      await db
        .prepare(
          `INSERT INTO fichas (${CAMPOS_FICHA.join(", ")}, atualizado_em) VALUES (${CAMPOS_FICHA.map(() => "?").join(", ")}, ?) ON CONFLICT(projeto) DO UPDATE SET ${atualizar}, atualizado_em = excluded.atualizado_em`,
        )
        .bind(...CAMPOS_FICHA.map((c) => ficha[c]), agoraIso())
        .run();
      return ficha;
    },
    async listarFichas() {
      const r = await db
        .prepare(
          "SELECT projeto, titulo, etapa_atual, proximo_passo, atualizado_por, atualizado_em FROM fichas ORDER BY atualizado_em DESC LIMIT 100",
        )
        .all<Ficha>();
      return r.results;
    },
    async registrarEvento(e) {
      const valores = CAMPOS_EVENTO.map((c) =>
        c === "meta" ? JSON.stringify(e.meta ?? {}) : e[c],
      );
      await db
        .prepare(
          `INSERT INTO eventos (${CAMPOS_EVENTO.join(", ")}, criado_em) VALUES (${CAMPOS_EVENTO.map(() => "?").join(", ")}, ?)`,
        )
        .bind(...valores, agoraIso())
        .run();
    },
    async eventosDesde(desdeIso, limite = 1000) {
      const r = await db
        .prepare(
          "SELECT * FROM eventos WHERE criado_em >= ? ORDER BY criado_em DESC, id DESC LIMIT ?",
        )
        .bind(desdeIso, limite)
        .all<Omit<EventoSalvo, "meta"> & { meta: string }>();
      return r.results.map((e) => ({ ...e, meta: lerMeta(e.meta) }));
    },
    async listarProvedores() {
      const r = await db
        .prepare("SELECT * FROM provedores ORDER BY criado_em")
        .all<ProvedorCifrado>();
      return r.results;
    },
    async salvarProvedor(p) {
      const atualizar = CAMPOS_PROVEDOR.filter((c) => c !== "id")
        .map((c) => `${c} = excluded.${c}`)
        .join(", ");
      await db
        .prepare(
          `INSERT INTO provedores (${CAMPOS_PROVEDOR.join(", ")}) VALUES (${CAMPOS_PROVEDOR.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${atualizar}`,
        )
        .bind(...CAMPOS_PROVEDOR.map((c) => p[c]))
        .run();
    },
    async removerProvedor(id) {
      await db.prepare("DELETE FROM provedores WHERE id = ?").bind(id).run();
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
  const hoje = { tokens: 0, custo_usd: 0 };
  const semana = { tokens: 0, custo_usd: 0 };
  let limites: Atividade["limites"] = { limite_5h_pct: null, limite_7d_pct: null, em: null };
  const ativos = new Set<string>();
  const vistas = new Set<string>();
  for (const e of eventos) {
    const t = totalTokens(e);
    const custo = Number(e.custo_usd) || 0;
    const quando = new Date(e.criado_em);
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
