-- Núcleo do Segundo Cérebro AutoGTEC
-- Base própria (Postgres/Supabase), sem dependência da Lovable.
-- Rode este arquivo no SQL Editor do projeto Supabase do núcleo.

-- 1) Fichas de retomada: o "onde paramos" de cada projeto/cliente.
--    Qualquer IA lê isto antes de continuar o trabalho, em vez de reler a conversa.
create table if not exists public.cerebro_fichas (
  projeto        text primary key,              -- slug: "crm-cliente-x", "fort-popular"
  titulo         text not null,
  objetivo       text not null default '',
  decisoes       text not null default '',      -- decisões tomadas (markdown)
  plano          text not null default '',      -- plano/etapas (markdown)
  etapa_atual    text not null default '',
  proximo_passo  text not null default '',
  arquivos       text not null default '',      -- arquivos/links mexidos
  atualizado_por text not null default '',      -- ferramenta/IA que salvou por último
  atualizado_em  timestamptz not null default now()
);

-- 2) Registro: tudo que qualquer IA conectada fez, com consumo.
create table if not exists public.cerebro_eventos (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  ferramenta     text not null,                 -- claude-code, claude-desktop, chatgpt, cursor, plataforma...
  sessao         text not null default '',
  projeto        text not null default '',
  agente         text not null default '',      -- agente/subagente que trabalhou
  tipo           text not null,                 -- inicio | etapa | delegacao | checkpoint | fim | uso
  descricao      text not null default '',
  modelo         text not null default '',
  tokens_entrada integer not null default 0,
  tokens_saida   integer not null default 0,
  tokens_cache   integer not null default 0,
  custo_usd      numeric(12,6) not null default 0,
  limite_5h_pct  numeric(5,2),                  -- % usado do limite de 5h da assinatura
  limite_7d_pct  numeric(5,2),                  -- % usado do limite semanal da assinatura
  meta           jsonb not null default '{}'::jsonb
);

create index if not exists cerebro_eventos_criado_em_idx on public.cerebro_eventos (criado_em desc);
create index if not exists cerebro_eventos_projeto_idx   on public.cerebro_eventos (projeto, criado_em desc);

-- Acesso só pelo servidor do núcleo (chave service_role). Nada público.
alter table public.cerebro_fichas  enable row level security;
alter table public.cerebro_eventos enable row level security;
