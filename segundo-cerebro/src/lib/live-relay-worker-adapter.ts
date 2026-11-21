// Worker/Request adapter for the Jarvis live-voice relay. Extracted from
// live-relay.server.ts: this half only translates platform primitives (the
// incoming Request, the raw WebSocket) into the protocol-agnostic LiveSocket
// interface that live-relay.server.ts's connection logic consumes. It has no
// knowledge of sessions, delegations or transcripts.
export type LiveConfig = {
  liveModel: "openai/gpt-live-1";
  backendModel: "openai/gpt-6-astra";
  openingInstructions?: string;
};

// Fill the literal model slugs from co-loaded knowledge before typechecking.
const liveSettings = { liveModel: "openai/gpt-live-1", backendModel: "openai/gpt-6-astra" } as const;

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };

export type WorkerSocket = WebSocket & { accept(): void };

export const conversationInstructions = `Você é Jarvis, assistente de voz da AutoGTEC. Fale em português brasileiro com respostas naturais, curtas e claras. Ajude a organizar ideias e raciocinar sobre tarefas, clientes e campanhas a partir do que a pessoa fornece. Não há integração com campanhas, notícias, tarefas salvas nem arquivos reais do Obsidian. Nunca invente acesso, métricas, memória de dias anteriores ou ações concluídas.
Backchannel policy: Use sinais moderados de escuta sem dominar a conversa.
Interruption policy: Pare de falar e escute quando a pessoa interromper.
Delegation policy:
Backend tools: Consultar o índice compacto do segundo cérebro e o caminho de uma skill, e raciocinar sobre o contexto da conversa.
Delegate to the backend when: A pessoa pedir análise técnica, planejamento detalhado ou consultar o mapa do cérebro; ou corrigir uma tarefa em andamento.
Do not delegate to the backend when: Cumprimentar, esclarecer uma dúvida ou repetir uma resposta ainda válida. Aguarde o resultado antes de responder.`;

export function getLiveConfig(): LiveConfig {
  const config: LiveConfig = {
    ...liveSettings,
    openingInstructions: "Apresente-se em português brasileiro: Olá, sou Jarvis, assistente da AutoGTEC. Qual assunto vamos trabalhar no segundo cérebro hoje? Depois escute.",
  };
  return config;
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

export function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}
