-- Núcleo do Segundo Cérebro AutoGTEC — banco D1 da Cloudflare (SQLite).
-- Aplicar: wrangler d1 migrations apply cerebro --remote  (ou pela API/painel da Cloudflare)

-- Fichas de retomada: o "onde paramos" de cada projeto/cliente, lido por qualquer IA.
CREATE TABLE IF NOT EXISTS fichas (
  projeto        TEXT PRIMARY KEY,
  titulo         TEXT NOT NULL,
  objetivo       TEXT NOT NULL DEFAULT '',
  decisoes       TEXT NOT NULL DEFAULT '',
  plano          TEXT NOT NULL DEFAULT '',
  etapa_atual    TEXT NOT NULL DEFAULT '',
  proximo_passo  TEXT NOT NULL DEFAULT '',
  arquivos       TEXT NOT NULL DEFAULT '',
  atualizado_por TEXT NOT NULL DEFAULT '',
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Registro: o que cada IA/agente fez e quanto gastou.
CREATE TABLE IF NOT EXISTS eventos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ferramenta     TEXT NOT NULL,
  sessao         TEXT NOT NULL DEFAULT '',
  projeto        TEXT NOT NULL DEFAULT '',
  agente         TEXT NOT NULL DEFAULT '',
  tipo           TEXT NOT NULL,
  descricao      TEXT NOT NULL DEFAULT '',
  modelo         TEXT NOT NULL DEFAULT '',
  tokens_entrada INTEGER NOT NULL DEFAULT 0,
  tokens_saida   INTEGER NOT NULL DEFAULT 0,
  tokens_cache   INTEGER NOT NULL DEFAULT 0,
  custo_usd      REAL NOT NULL DEFAULT 0,
  limite_5h_pct  REAL,
  limite_7d_pct  REAL,
  meta           TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS eventos_criado_em ON eventos (criado_em DESC);
CREATE INDEX IF NOT EXISTS eventos_projeto ON eventos (projeto, criado_em DESC);

-- Cofre de IAs: chaves de API cifradas (AES-GCM, chave mestra só em Secret da Cloudflare).
-- A chave nunca volta para o navegador; o painel só vê os 4 últimos caracteres.
CREATE TABLE IF NOT EXISTS provedores (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  fornecedor    TEXT NOT NULL,            -- anthropic | openai | xai | google
  modelo        TEXT NOT NULL,
  papel         TEXT NOT NULL DEFAULT '', -- orquestrador | planejador | executor | ''
  cor           TEXT NOT NULL DEFAULT 'cyan',
  chave_cifrada TEXT NOT NULL,
  iv            TEXT NOT NULL,
  final_chave   TEXT NOT NULL,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
