import type { Provedor } from "./types";

/** Chamada direta aos fornecedores com a chave do cofre. Nada passa pela Lovable. */
export type RespostaModelo = {
  texto: string;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_cache: number;
};

const COMPATIVEIS_OPENAI: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

export async function chamarModelo(
  p: Pick<Provedor, "fornecedor" | "modelo">,
  chave: string,
  sistema: string,
  pedido: string,
  maxTokens = 1500,
  f: typeof fetch = fetch,
): Promise<RespostaModelo> {
  const sinal = AbortSignal.timeout(60_000);
  if (p.fornecedor === "anthropic") {
    const r = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: sinal,
      headers: {
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: p.modelo,
        max_tokens: maxTokens,
        system: sistema,
        messages: [{ role: "user", content: pedido }],
      }),
    });
    if (!r.ok)
      throw new Error(`Anthropic respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = (await r.json()) as {
      content: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    return {
      texto: d.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n"),
      tokens_entrada: d.usage?.input_tokens ?? 0,
      tokens_saida: d.usage?.output_tokens ?? 0,
      tokens_cache:
        (d.usage?.cache_read_input_tokens ?? 0) + (d.usage?.cache_creation_input_tokens ?? 0),
    };
  }
  const url = COMPATIVEIS_OPENAI[p.fornecedor];
  if (!url) throw new Error(`Fornecedor não suportado: ${p.fornecedor}`);
  const r = await f(url, {
    method: "POST",
    signal: sinal,
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: p.modelo,
      ...(p.fornecedor === "openai"
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }),
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: pedido },
      ],
    }),
  });
  if (!r.ok)
    throw new Error(`${p.fornecedor} respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()) as {
    choices: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  return {
    texto: d.choices[0]?.message?.content ?? "",
    tokens_entrada: d.usage?.prompt_tokens ?? 0,
    tokens_saida: d.usage?.completion_tokens ?? 0,
    tokens_cache: d.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  };
}
