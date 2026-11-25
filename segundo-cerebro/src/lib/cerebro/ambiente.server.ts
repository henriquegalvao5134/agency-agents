/** Tipos mínimos do D1 da Cloudflare (evita depender de @cloudflare/workers-types). */
export interface D1Result<T = unknown> {
  results: T[];
}
export interface D1PreparedStatement {
  bind(...valores: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

/** Ligações e segredos do Worker usados pelo núcleo. Todos ficam na Cloudflare, nunca no repositório. */
export type CerebroAmbiente = {
  CEREBRO_DB?: D1Database;
  CEREBRO_TOKEN?: string; // acesso das IAs (MCP e ganchos)
  CEREBRO_SENHA_PAINEL?: string; // login do painel
  CEREBRO_CHAVE_MESTRA?: string; // base64 de 32 bytes: cifra as chaves de API e assina a sessão
};

let atual: CerebroAmbiente = {};
/** Chamado pelo src/server.ts a cada requisição com o `env` do Worker. */
export function definirAmbiente(env: unknown) {
  if (env && typeof env === "object") atual = env as CerebroAmbiente;
}
export function ambiente(): CerebroAmbiente {
  return atual;
}
