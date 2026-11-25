import { z } from "zod";

/** Ficha de retomada: o "onde paramos" de um projeto, lido por qualquer IA antes de continuar. */
export const Ficha = z.object({
  projeto: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "use um slug: letras minúsculas, números e hífen"),
  titulo: z.string().min(1).max(200),
  objetivo: z.string().max(4000).default(""),
  decisoes: z.string().max(20000).default(""),
  plano: z.string().max(20000).default(""),
  etapa_atual: z.string().max(2000).default(""),
  proximo_passo: z.string().max(2000).default(""),
  arquivos: z.string().max(8000).default(""),
  atualizado_por: z.string().max(80).default(""),
});
export type Ficha = z.infer<typeof Ficha> & { atualizado_em?: string };

export const TIPOS_EVENTO = ["inicio", "etapa", "delegacao", "checkpoint", "fim", "uso"] as const;

/** Um registro de atividade: o que uma IA conectada fez e quanto gastou. */
export const Evento = z.object({
  ferramenta: z.string().min(1).max(60),
  sessao: z.string().max(120).default(""),
  projeto: z.string().max(80).default(""),
  agente: z.string().max(120).default(""),
  tipo: z.enum(TIPOS_EVENTO),
  descricao: z.string().max(2000).default(""),
  modelo: z.string().max(80).default(""),
  tokens_entrada: z.number().int().min(0).default(0),
  tokens_saida: z.number().int().min(0).default(0),
  tokens_cache: z.number().int().min(0).default(0),
  custo_usd: z.number().min(0).default(0),
  limite_5h_pct: z.number().min(0).max(100).nullable().default(null),
  limite_7d_pct: z.number().min(0).max(100).nullable().default(null),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type Evento = z.infer<typeof Evento>;
export type EventoSalvo = Evento & { id: number; criado_em: string };

export type ConsumoAgente = {
  agente: string;
  ferramenta: string;
  eventos: number;
  tokens: number;
  custo_usd: number;
  ultimo: string;
};
export type Atividade = {
  configurado: boolean;
  eventos: Omit<EventoSalvo, "meta">[];
  consumo: ConsumoAgente[];
  hoje: { tokens: number; custo_usd: number };
  semana: { tokens: number; custo_usd: number };
  limites: { limite_5h_pct: number | null; limite_7d_pct: number | null; em: string | null };
  ativos: string[];
};

export const FORNECEDORES = ["anthropic", "openai", "xai", "google"] as const;
export const PAPEIS = ["orquestrador", "planejador", "executor", ""] as const;

/** Cadastro de uma IA no cofre. A chave só entra; nunca sai do servidor. */
export const NovoProvedor = z.object({
  nome: z.string().trim().min(1).max(60),
  fornecedor: z.enum(FORNECEDORES),
  modelo: z.string().trim().min(1).max(80),
  papel: z.enum(PAPEIS).default(""),
  cor: z.string().max(20).default("cyan"),
  chave: z.string().trim().min(10).max(400),
});
export type NovoProvedor = z.infer<typeof NovoProvedor>;
/** O que o painel enxerga de uma IA cadastrada: sem a chave. */
export type Provedor = Omit<NovoProvedor, "chave"> & {
  id: string;
  final_chave: string;
  criado_em: string;
};
