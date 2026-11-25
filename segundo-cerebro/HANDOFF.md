# Passagem de bastão — AutoGTEC Segundo Cérebro

> Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele existe para que outra sessão, outra conta ou um
> modelo menor (ex.: Sonnet) continue o trabalho sem reler conversas. Atualizado em 24/11/2026 (sessão Opus 5.5).
> A mesma informação, resumida, está na ficha `segundo-cerebro` do próprio cérebro (MCP `cerebro` → `ler_ficha`).

## 1. O que é e para quem
Henrique Galvão (GD3 Marketing Digital — agência de marketing **e** empresa de software: CRM, sistemas, cibersegurança)
está construindo o **AutoGTEC Segundo Cérebro**: um painel visual (inspirado no orca.dev) onde:
- a **memória do trabalho mora fora do chat** (fichas de retomada), para trocar de IA/conta quando o token acaba e continuar de onde parou;
- um **orquestrador** escolhe os **subagentes** do catálogo (283 agentes do repositório `agency-agents`) e o fluxo
  (código → skills **superpowers**), e a ferramenta que chamou (Claude Code, Codex, Gemini) executa;
- o **cérebro na tela** mostra os agentes dentro dos lobos, quem está trabalhando, consumo de tokens e limites da assinatura.

Ele não é desenvolvedor. Fala português, quer ação (não perguntas demais), quer **ver** o resultado (prints), e mandou usar
o processo do **superpowers** para construir (brainstorming → spec → plano → subagent-driven-development com revisões).
Regra dele: mudança nos sistemas dele (Cloudflare, VPS, Supabase, n8n) se explica antes; prazo/prioridade quem decide é ele.

## 2. Onde está
- **Site (produção):** https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev
- **Código:** repositório GitHub `henriquegalvao5134/agency-agents`, pasta `segundo-cerebro/`. No PC dele: `C:\setap\agency-agents`.
- **Deploy:** Cloudflare Workers Builds ligado ao GitHub. **Todo push no `main` publica sozinho** (build `bun install && bun run build`,
  deploy `npx nitro deploy --prebuilt`, raiz `segundo-cerebro`). Trabalhe em branch e só faça merge no `main` quando estiver revisado.
- **Cloudflare:** conta `bef919733b2a1377be3f916da6e82614` (leandrotecnico02@gmail.com — é do Henrique). Worker
  `henriquegalvao5134-agency-agents-segundo-cerebro`. Banco **D1** `cerebro` (id `e340304d-bb9b-4dc5-95b4-45472b7370be`, binding `CEREBRO_DB`,
  configurado em `segundo-cerebro/wrangler.jsonc`; tabelas em `cerebro/migrations/0001_nucleo.sql`: `fichas`, `eventos`, `provedores`).
- **Segredos (só na Cloudflare, nunca no repositório):** `CEREBRO_TOKEN` (acesso das IAs: MCP e ganchos), `CEREBRO_SENHA_PAINEL`
  (login do site), `CEREBRO_CHAVE_MESTRA` (cifra as chaves de API do cofre e assina o login; trocar invalida as chaves cadastradas).
  Os valores foram passados ao Henrique no chat; se precisar, gere novos e atualize na Cloudflare (Settings → Variables and secrets).
- **VPS (para o executor futuro):** Hostinger `srv2040192.hstgr.cloud`, plano KVM 2 (2 CPU, 8 GB, 100 GB, Ubuntu 24.04), já roda n8n/OpenWA.

## 3. Como está construído (`segundo-cerebro/src`)
- `server.ts` — rotas próprias antes do TanStack: `/api/mcp` (MCP), `/api/cerebro/*` (ganchos, token), `/api/painel/*` (painel, login por cookie).
  Cabeçalhos de segurança em tudo. O env do Worker é lido de `globalThis.__env__` (nitro) em `lib/cerebro/ambiente.server.ts`.
- `lib/cerebro/` — núcleo:
  - `mcp.server.ts` — ferramentas `orquestrar`, `buscar_agente`, `listar_fichas`, `ler_ficha`, `salvar_ficha`, `registrar_evento`.
  - `orquestrador.server.ts` — escolhe área/agentes (IA do cofre com papel "orquestrador" ou pontuação) e devolve fluxo + divisão de modelos.
  - `painel.server.ts` — login, atividade, cofre (cadastrar/testar/remover IA), `fichas`, `perguntar` (caixa do cérebro).
  - `cofre.server.ts` (AES-GCM, sessão HMAC), `llm.server.ts` (Anthropic/OpenAI/xAI/Google direto, sem Lovable), `store.server.ts` (D1).
  - `agencia.ts` (departamentos, skills, estado aceso, rótulo do orquestrador), `continuar.ts` (comando para outra IA, limite velho),
    `agentes-cliente.ts` + `agentes.json`/`divisoes.json` (gerados por `scripts/gerar-catalogo.mjs`; o navegador **nunca** importa `catalogo.json`).
- `components/dash/` — `GraphPanel.tsx` (cérebro; agentes nos lobos via `brain.ts`/`brain-graph-model.ts`), `AgenciaLayer.tsx`
  (coluna "Agência GD3" + skills), `NucleoPanel.tsx` (atividade/consumo/limites), `CofreIAs.tsx`, `ProjetosPanel.tsx` ("Onde eu parei").
- `integracoes/` — Claude Code (ganchos `cerebro-hook.mjs`, barra `cerebro-statusline.mjs`, skill `salvar-no-cerebro`), Codex, Gemini. Guia: `integracoes/README.md`.
- Desenhos e planos: `docs/superpowers/specs/` e `docs/superpowers/plans/` (na raiz do repositório).

**Cuidados:** `GraphPanel.tsx` e `routes/index.tsx` não são formatados pelo prettier (edite cirurgicamente, não rode prettier neles).
Verificação: `npx vitest run` (75 testes), `npx tsc --noEmit -p tsconfig.json`, `bun run build` ("You can deploy this build").
Ainda há a dependência de build `@lovable.dev/vite-tanstack-config` (só ferramenta de build, sem conexão com a Lovable).

## 4. O que já está pronto (no ar)
1. Núcleo: memória (fichas), registro de atividade/consumo, MCP, ganchos do Claude Code (ficha entra ao abrir; alerta com contexto ≥ 70% ou limite ≥ 85%).
2. Cofre de IAs com chave cifrada; login do painel; orquestrador; caixa do cérebro usa as chaves do cofre; saída total da Lovable (gateway, Supabase, Jarvis desligado).
3. Cérebro: orquestrador no centro (pulsa ao delegar), 10 departamentos e 283 agentes reais **dentro dos lobos** (acendem quando delegados),
   coluna "Agência GD3", skills (superpowers + GD3), vista padrão enquadrada, animação pausa fora da tela.
4. "Onde eu parei": cartões por projeto + "Continuar em outra IA" (Claude Code / Codex / Gemini) + aviso de limite com hora da leitura.

## 5. Próximos passos (em ordem; prioridade final é do Henrique)
1. **Henrique usar de verdade:** entrar no painel; cadastrar no cofre uma IA Anthropic `claude-haiku-5-5` com papel **Orquestrador** e testar;
   ligar o Claude Code (`claude mcp add --scope user --transport http cerebro <site>/api/mcp --header "Authorization: Bearer <CEREBRO_TOKEN>"`)
   e os ganchos (`integracoes/claude-code/settings.exemplo.json` → `C:\Users\<ele>\.claude\settings.json`).
   **Sem isso nada acende** — tudo no cérebro só reage a eventos reais.
2. **Coluna "Agência GD3" e departamentos clicáveis** (pedido do Henrique em 24/11): hoje a camada tem `pointerEvents="none"` e só mostra.
   Ao clicar num departamento (coluna ou hub no lobo): destacar seus agentes no lobo e listar nomes/descrições num painel; clicar num agente
   mostra as instruções (`buscar_agente`). Mostrar também "sem delegação recente" para deixar claro por que está apagado.
3. Cérebro no celular: texto ~3,7 px a 390 px de largura — precisa de layout próprio para telas estreitas.
4. Rótulo do orquestrador no centro sobrepõe o rótulo "Claude Code".
5. **Executor na VPS** (próximo projeto grande, estilo Orca): programa sempre ligado na VPS que recebe tarefas do cérebro e roda Claude Code/Codex
   com as assinaturas dele, coordenador + trabalhadores, troca automática de IA quando o limite acaba. Custo extra ≈ zero (VPS já paga;
   2–3 agentes em paralelo com o n8n). **Aguardando o ok do Henrique para começar** (começar por brainstorming/spec).
6. Jarvis por voz com chave própria do cofre; domínio próprio; trocar `@lovable.dev/vite-tanstack-config` por configuração própria.

## 6. Como continuar com um modelo menor
- Comece lendo este arquivo e a ficha (`ler_ficha` projeto `segundo-cerebro`).
- Para qualquer mudança: branch → testes → revisão → merge no `main` (publica). Mostre prints ao Henrique.
- Ao fim de cada etapa, atualize a ficha (`salvar_ficha`) e este arquivo (seção 4 e 5).
