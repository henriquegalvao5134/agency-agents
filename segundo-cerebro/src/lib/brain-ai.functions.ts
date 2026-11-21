import { createServerFn } from "@tanstack/react-start";
import { generateChatCompletion, generateMessage, generateResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { SKILLS } from "@/components/dash/brain";
import { validateDelegation } from "./brain-routing";

/** Models any AI input on the brain can be wired to (all served by the built-in AI gateway). */
export const BRAIN_MODELS = [
  "openai/gpt-6-astra",
  "openai/gpt-6.1-terra",
  "openai/gpt-5.5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5-5",
  "anthropic/claude-haiku-4-5",
  "google/gemini-3.8-flash",
] as const;

/** One real tool call chooses the next executor; the UI records and dispatches it.
 * No recursive delegation: one routing inference + one execution inference per task.
 */
export const routeBrainAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    model: z.enum(BRAIN_MODELS),
    source: z.string().max(60),
    prompt: z.string().min(1).max(4000),
    context: z.string().max(6000),
    agents: z.array(z.object({
      id: z.string().max(100), name: z.string().max(60),
      vendor: z.string().max(60), c: z.string().max(30),
      model: z.enum(BRAIN_MODELS),
    })).min(1).max(24),
  }).parse(input))
  .handler(async ({ data }) => {
    const parameters = {
      type: "object" as const,
      properties: {
        agentId: { type: "string", enum: data.agents.map(a => a.id) },
        skillId: { type: "string", enum: SKILLS.map(s => s.id) },
        task: { type: "string", description: "Tarefa concreta, em português, para o executor." },
        reason: { type: "string", description: "Motivo curto da escolha, em português." },
      },
      required: ["agentId", "skillId", "task", "reason"],
      additionalProperties: false,
    };
    const system = `Você é a IA roteadora chamada por ${data.source}. Use delegar_tarefa exatamente uma vez para escolher um agente conectado e uma skill. Respeite pedidos explícitos do usuário sobre qual agente usar. Não execute a tarefa, não afirme ter lido arquivos reais do Obsidian. Agentes: ${JSON.stringify(data.agents.map(a => ({ id: a.id, name: a.name })))}. Skills: ${JSON.stringify(SKILLS.map(s => ({ id: s.id, label: s.label })))}. Índice compartilhado: ${data.context}`;
    try {
      let argumentsValue: unknown;
      let toolCallId: string;
      if (data.model === "anthropic/claude-sonnet-5" || data.model === "anthropic/claude-opus-5-5" || data.model === "anthropic/claude-haiku-4-5") {
        const result = await generateMessage({
          model: data.model, max_tokens: 600, system,
          messages: [{ role: "user", content: data.prompt }],
          tools: [{ name: "delegar_tarefa", description: "Encaminhar uma tarefa pelo orquestrador para um agente e uma skill.", input_schema: parameters }],
          tool_choice: { type: "auto" },
        });
        const call = result.content.find(b => b.type === "tool_use" && b.name === "delegar_tarefa");
        if (!call || call.type !== "tool_use") return { ok: false as const, text: "A IA não fez uma chamada de delegação. Nenhum agente foi acionado." };
        argumentsValue = call.input;
        toolCallId = call.id;
      } else if (data.model !== "google/gemini-3.8-flash") {
        // OpenAI tool calls use Responses: Terra rejects reasoning + tools on Chat.
        const payload = {
          instructions: system, input: data.prompt,
          tools: [{ type: "function" as const, name: "delegar_tarefa", parameters, strict: true }],
        };
        const result = data.model === "openai/gpt-6-astra"
          ? await generateResponse({ model: "openai/gpt-6-astra", ...payload })
          : data.model === "openai/gpt-6.1-terra"
            ? await generateResponse({ model: "openai/gpt-6.1-terra", ...payload })
            : await generateResponse({ model: "openai/gpt-5.5", ...payload });
        const call = result.output.find(c => c.type === "function_call" && c.name === "delegar_tarefa");
        if (!call || call.type !== "function_call") return { ok: false as const, text: "A IA não fez uma chamada de delegação. Nenhum agente foi acionado." };
        argumentsValue = JSON.parse(call.arguments);
        toolCallId = call.call_id;
      } else {
        const payload = {
          messages: [{ role: "system" as const, content: system }, { role: "user" as const, content: data.prompt }],
          tools: [{ type: "function" as const, function: { name: "delegar_tarefa", description: "Encaminhar uma tarefa pelo orquestrador para um agente e uma skill.", parameters } }],
        };
        const result = await generateChatCompletion({ model: "google/gemini-3.8-flash", ...payload });
        const call = result.choices[0]?.message?.tool_calls?.find(c => c.type === "function" && c.function.name === "delegar_tarefa");
        if (!call || call.type !== "function") return { ok: false as const, text: "A IA não fez uma chamada de delegação. Nenhum agente foi acionado." };
        argumentsValue = JSON.parse(call.function.arguments);
        toolCallId = call.id;
      }
      const { decision } = validateDelegation(argumentsValue, data.agents);
      return { ok: true as const, decision, toolCallId };
    } catch (error) {
      return { ok: false as const, text: error instanceof GatewayError && error.code === "payment_required"
        ? "Créditos de IA insuficientes. Recarregue para continuar."
        : "A delegação não pôde ser confirmada. Nenhum executor foi acionado." };
    }
  });

const Input = z.object({
  model: z.enum(BRAIN_MODELS),
  agent: z.string().max(60),
  skill: z.string().max(60),
  regions: z.array(z.string().max(40)).max(8),
  prompt: z.string().min(1).max(4000),
  context: z.string().max(6000).default(""),
});

export const askBrainAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const system = `You are "${data.agent}", one AI plugged into a unified second brain built on an Obsidian vault. You are running the skill "${data.skill}", which activates these brain regions: ${data.regions.join(" → ")}. Use this orchestrator index (brain.md) as your only vault context:\n${data.context}\nAlways answer in Brazilian Portuguese. Answer concisely (max ~120 words), in the user's language, as practical notes.`;
    try {
      if (data.model.startsWith("anthropic/")) {
        const r = await generateMessage({ model: data.model as "anthropic/claude-sonnet-5", max_tokens: 600, system, messages: [{ role: "user", content: data.prompt }] });
        const text = (r.content as { type: string; text?: string }[]).filter(b => b.type === "text").map(b => b.text ?? "").join("\n");
        return { ok: true as const, text };
      }
      const r = await generateChatCompletion({ model: data.model as "openai/gpt-5.5", messages: [{ role: "system", content: system }, { role: "user", content: data.prompt }] });
      const content = r.choices[0]?.message?.content;
      return { ok: true as const, text: typeof content === "string" ? content : JSON.stringify(content) };
    } catch (e) {
      if (e instanceof GatewayError) return { ok: false as const, text: e.code === "payment_required" ? "Out of AI credits — top up to keep the brain thinking." : `AI error (${e.code}): ${e.message}` };
      return { ok: false as const, text: "Unexpected error talking to the AI." };
    }
  });
