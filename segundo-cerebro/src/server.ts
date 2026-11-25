import "./lib/error-capture";

import { consumeLastCapturedError, logError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleLiveRequest } from "./lib/live-relay.server";
import { definirAmbiente } from "./lib/cerebro/ambiente.server";
import { handleCerebroHttp } from "./lib/cerebro/http.server";
import { handleMcpRequest } from "./lib/cerebro/mcp.server";
import { nucleoDoAmbiente } from "./lib/cerebro/nucleo.server";
import { handlePainel } from "./lib/cerebro/painel.server";

/** Cabeçalhos de segurança em todas as respostas normais (não no WebSocket do Jarvis). */
function protegido(response: Response): Response {
  if (response.status === 101) return response;
  const r = new Response(response.body, response);
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("x-frame-options", "DENY");
  r.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  r.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  r.headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(self)");
  return r;
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  logError(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      definirAmbiente(env);
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/live") return handleLiveRequest(request);
      if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/"))
        return protegido(await handleMcpRequest(request, nucleoDoAmbiente()));
      if (pathname.startsWith("/api/cerebro/"))
        return protegido(await handleCerebroHttp(request, nucleoDoAmbiente()));
      if (pathname.startsWith("/api/painel/"))
        return protegido(await handlePainel(request, nucleoDoAmbiente()));
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return protegido(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      logError(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
