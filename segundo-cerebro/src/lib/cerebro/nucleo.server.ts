import { ambiente } from "./ambiente.server";
import { decifrar } from "./cofre.server";
import { d1Store, type CerebroStore } from "./store.server";
import type { Provedor } from "./types";

/** Tudo o que as rotas do núcleo precisam numa requisição. */
export type Nucleo = {
  store: CerebroStore;
  token: string;
  senhaPainel: string;
  chaveMestra: string;
  f: typeof fetch;
};

/** Monta o núcleo a partir do ambiente do Worker; null se faltar banco ou segredo (o painel mostra "não configurado"). */
export function nucleoDoAmbiente(): Nucleo | null {
  const env = ambiente();
  if (
    !env.CEREBRO_DB ||
    !env.CEREBRO_TOKEN ||
    !env.CEREBRO_CHAVE_MESTRA ||
    !env.CEREBRO_SENHA_PAINEL
  )
    return null;
  return {
    store: d1Store(env.CEREBRO_DB),
    token: env.CEREBRO_TOKEN,
    senhaPainel: env.CEREBRO_SENHA_PAINEL,
    chaveMestra: env.CEREBRO_CHAVE_MESTRA,
    f: fetch,
  };
}

/** A IA do cofre marcada com papel "orquestrador", já com a chave decifrada (só em memória, nunca devolvida). */
export async function roteadorDoCofre(
  n: Nucleo,
): Promise<{ provedor: Provedor; chave: string } | null> {
  const p = (await n.store.listarProvedores()).find((x) => x.papel === "orquestrador");
  if (!p) return null;
  const { chave_cifrada, iv, ...provedor } = p;
  return { provedor, chave: await decifrar(chave_cifrada, iv, n.chaveMestra) };
}
