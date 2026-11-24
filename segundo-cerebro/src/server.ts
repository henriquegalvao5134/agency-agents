import "./lib/error-capture";

import { consumeLastCapturedError, logError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleLiveRequest } from "./lib/live-relay.server";
import { handleMcpRequest } from "./lib/cerebro/mcp.server";
import { handleCerebroHttp } from "./lib/cerebro/http.server";
import { cerebroEnv, supabaseStore } from "./lib/cerebro/store.server";

function nucleo() {
  const env = cerebroEnv();
  return { store: env ? supabaseStore(env) : null, token: env?.token ?? null };
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
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/live") return handleLiveRequest(request);
      if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) { const n = nucleo(); return await handleMcpRequest(request, n.store, n.token); }
      if (pathname.startsWith("/api/cerebro/")) { const n = nucleo(); return await handleCerebroHttp(request, n.store, n.token); }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      logError(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
