// Backend-delegation domain logic for the Jarvis live-voice relay. Extracted
// from live-relay.server.ts: this half answers "what should the backend say
// back", independent of the WebSocket session state machine that calls it.
import { buildBrainIndex, DEFAULT_AGENTS, SKILLS, REGIONS } from "../components/dash/brain";

import {
  streamResponse,
  type ResponsesInputItem,
  type ResponsesResponse,
} from "@lovable.dev/ai-gateway";

import type { LiveConfig } from "./live-relay-worker-adapter";

type StudyScheduleInput = { skill_id: string };
function studyScheduleArguments(value: unknown): StudyScheduleInput {
  if (!value || typeof value !== "object" || !("skill_id" in value) || typeof value.skill_id !== "string" || !SKILLS.some(s => s.id === value.skill_id)) throw new Error("Skill inválida");
  return { skill_id: value.skill_id };
}

export function planStudySchedule(args: StudyScheduleInput) {
  const skill = SKILLS.find(s => s.id === args.skill_id);
  if (!skill) throw new Error("Skill indisponível");
  return { skill: skill.label, regions: skill.path.map(r => REGIONS[r].name), index: buildBrainIndex(DEFAULT_AGENTS), source: "Índice demonstrativo do painel; não são arquivos reais do Obsidian." };
}

export function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh)[.,!]*$/.test(normalized);
}

export async function answerQuestion(
  messages: ResponsesInputItem[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
  onPlan: (plan: ReturnType<typeof planStudySchedule>) => void,
) {
  for (let step = 0; step < 50; step++) {
    signal.throwIfAborted();
    consumeInput();
    const stream = await streamResponse(
      {
        model: config.backendModel,
        input: messages,
        instructions: "Ajude Jarvis da AutoGTEC a responder em português brasileiro, em até 150 palavras. Considere toda a conversa e a correção mais recente. Consulte obter_contexto_cerebro para acessar o índice compacto e a skill pertinente. O índice é demonstrativo, não contém notas reais, clientes, métricas de campanhas ou notícias ao vivo. Não afirme salvar tarefas ou executar otimizações. Peça dados ausentes. " + buildBrainIndex(DEFAULT_AGENTS),
        ...(!["openai/chat-latest"].includes(config.backendModel)
          ? {
              reasoning: { effort: "medium", summary: "auto" },
              include: ["reasoning.encrypted_content"],
            }
          : {}),
        tools: [
          {
            type: "function",
            name: "obter_contexto_cerebro",
            description: "Consultar o índice compacto do cérebro e as regiões de uma skill.",
            parameters: {
              type: "object",
              properties: {
                skill_id: { type: "string", enum: SKILLS.map(s => s.id) },
              },
              required: ["skill_id"],
              additionalProperties: false,
            },
            strict: true,
          },
        ],
      },
      {
        signal,
        maxRetries: 0,
        runId: correlation.runID,
        metadata: { live_session_id: correlation.sessionID, delegation_id: correlation.delegationID },
      },
    );
    let completed: ResponsesResponse | undefined;
    let incomplete = false;
    // Drain through HTTP EOF so successful work is not recorded as cancelled by the Gateway.
    for await (const event of stream) {
      if (event.type === "response.completed") completed = event.response;
      if (event.type === "response.incomplete") incomplete = true;
    }
    signal.throwIfAborted();
    if (incomplete || !completed || completed.status !== "completed")
      throw new Error("The backend response did not complete");
    for (const item of completed.output) {
      if (item.type !== "message" && item.type !== "reasoning" && item.type !== "function_call")
        throw new Error("Unsupported backend output; adapt native history for the selected tools");
      messages.push(item);
    }
    const calls = completed.output.flatMap((item) => item.type === "function_call" ? [item] : []);
    if (!calls.length) {
      const answer = completed.output
        .flatMap((item) =>
          item.type === "message"
            ? item.content.flatMap((part) => (part.type === "output_text" ? [part.text] : []))
            : [],
        )
        .join("\n");
      if (!answer.trim()) throw new Error("The backend response had no answer");
      return answer;
    }
    for (const call of calls) {
      signal.throwIfAborted();
      if (call.name !== "obter_contexto_cerebro") throw new Error("Unsupported backend tool");
      const plan = planStudySchedule(studyScheduleArguments(JSON.parse(call.arguments)));
      onPlan(plan);
      messages.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(plan) });
    }
  }
  throw new Error("The backend task exceeded its step limit");
}

export function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    // Chunks stay well inside the provider's per-append size limit.
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}
