import { createServerFn } from "@tanstack/react-start";
import { cerebroEnv, resumirAtividade, supabaseStore } from "./store.server";
import type { Atividade } from "./types";

const VAZIO: Atividade = {
  configurado: false,
  eventos: [],
  consumo: [],
  hoje: { tokens: 0, custo_usd: 0 },
  semana: { tokens: 0, custo_usd: 0 },
  limites: { limite_5h_pct: null, limite_7d_pct: null, em: null },
  ativos: [],
};

/** Leitura do registro para o painel (últimos 7 dias). Só o servidor fala com o banco. */
export const lerAtividade = createServerFn({ method: "GET" }).handler(
  async (): Promise<Atividade & { erro?: string }> => {
    const env = cerebroEnv();
    if (!env) return VAZIO;
    try {
      const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const eventos = await supabaseStore(env).eventosDesde(desde, 2000);
      return resumirAtividade(eventos);
    } catch (e) {
      return {
        ...VAZIO,
        configurado: true,
        erro: e instanceof Error ? e.message : "Falha ao ler o núcleo.",
      };
    }
  },
);
