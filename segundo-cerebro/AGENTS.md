<!-- LOVABLE:BEGIN -->
# AutoGTEC Segundo Cérebro — regras do projeto

O projeto saiu da Lovable (24/11/2026): não há gateway de IA, banco nem segredos da Lovable.
Hospedagem: Cloudflare Worker `henriquegalvao5134-agency-agents-segundo-cerebro` (deploy automático pelo `main`).

- Núcleo (src/lib/cerebro): banco D1 `cerebro` (binding CEREBRO_DB, tabelas em cerebro/migrations), MCP em /api/mcp,
  ganchos em /api/cerebro (token CEREBRO_TOKEN), painel em /api/painel (login CEREBRO_SENHA_PAINEL, cookie assinado).
- Chaves de API só no cofre (tabela provedores), cifradas com CEREBRO_CHAVE_MESTRA. Nunca devolver a chave ao navegador,
  nunca colocar segredo no repositório.
- Catálogo de agentes: rode `node scripts/gerar-catalogo.mjs` quando agentes do repositório mudarem.
- Integração do Claude Code: integracoes/ (ganchos, barra de status, skill salvar-no-cerebro).

- Brain regions, note-group→region mapping and skill→region paths live in src/components/dash/brain.ts; panels read from it so the map stays documented in one place.
- Brain delegation uses one validated native tool call followed by one executor call; task-scoped lifecycle events drive visual activity so concurrent tasks cannot clear each other's status.
- Graph layout uses independent world-space offsets for AI ports and the brain; camera pan and rotation remain separate so rearranging cards never changes neural geometry or task state.
- News uses fixed public RSS sources and the official daily exchange-rate source through a read-only server function; expose source failures and reference dates rather than inventing headlines or real-time prices.
- Canvas connections are created on destination pointer-down, before drag capture; export notes and directed edges as JSON Canvas, without implying vault synchronization or agent execution.
- Campaign panels must show unavailable values until a real account integration is verified; catalog and plugin-lab examples must be labelled as demonstrations, never installations.
- The agent registry uses an external store with a stable server snapshot so adding agents and restoring browser storage share the same state without hydration races.
- Router dehydrate/hydrate hooks transfer completed public query snapshots to the browser; loaders await initial public reads and the existing root QueryClientProvider remains the single provider.
- Use root MANUAL.md as the shared documentation source for the repository and /manual page via a raw Markdown import, with README as its entry point; this prevents divergent copies. Its implementation examples describe the current state, not mandatory architecture: assess applicability and feasibility before changing code, while preserving security and truthful capability reporting.
