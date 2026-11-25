/**
 * Segurança do núcleo: cifra das chaves de API (AES-256-GCM) e sessão do painel (cookie assinado com HMAC).
 * A chave mestra vem só do Secret CEREBRO_CHAVE_MESTRA da Cloudflare (base64 de 32 bytes).
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deB64 = (texto: string) => {
  const bin = atob(texto);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};
const b64url = (bytes: ArrayBuffer) =>
  b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function bytesMestra(chaveMestra: string): Uint8Array<ArrayBuffer> {
  const bytes = deB64(chaveMestra);
  if (bytes.length !== 32) throw new Error("CEREBRO_CHAVE_MESTRA precisa ser base64 de 32 bytes.");
  return bytes;
}

async function chaveAes(chaveMestra: string) {
  return crypto.subtle.importKey("raw", bytesMestra(chaveMestra), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function chaveHmac(chaveMestra: string) {
  // Deriva uma chave separada para assinar sessões, para não reusar a mesma chave da cifra.
  const base = await crypto.subtle.importKey("raw", bytesMestra(chaveMestra), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("autogtec-cerebro"),
      info: enc.encode("sessao-painel"),
    },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export async function cifrar(
  texto: string,
  chaveMestra: string,
): Promise<{ cifra: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifra = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await chaveAes(chaveMestra),
    enc.encode(texto),
  );
  return { cifra: b64(cifra), iv: b64(iv) };
}

export async function decifrar(cifra: string, iv: string, chaveMestra: string): Promise<string> {
  const texto = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deB64(iv) },
    await chaveAes(chaveMestra),
    deB64(cifra),
  );
  return dec.decode(texto);
}

/** Comparação em tempo constante (não vaza o tamanho do acerto por tempo de resposta). */
export function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const COOKIE_SESSAO = "__Host-cerebro";
const DURACAO_MS = 14 * 24 * 3600_000;

export async function criarSessao(chaveMestra: string, agora = Date.now()): Promise<string> {
  const expira = String(agora + DURACAO_MS);
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chaveHmac(chaveMestra),
    enc.encode(expira),
  );
  return `${expira}.${b64url(assinatura)}`;
}

export async function sessaoValida(
  valor: string | undefined,
  chaveMestra: string,
  agora = Date.now(),
): Promise<boolean> {
  if (!valor) return false;
  const [expira, assinatura] = valor.split(".");
  if (!expira || !assinatura || Number(expira) < agora) return false;
  const esperada = b64url(
    await crypto.subtle.sign("HMAC", await chaveHmac(chaveMestra), enc.encode(expira)),
  );
  return iguais(assinatura, esperada);
}

export function lerCookie(request: Request, nome: string): string | undefined {
  for (const parte of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return v.join("=");
  }
  return undefined;
}

export const cookieSessao = (valor: string) =>
  `${COOKIE_SESSAO}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACAO_MS / 1000}`;
export const cookieSaida = () =>
  `${COOKIE_SESSAO}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
