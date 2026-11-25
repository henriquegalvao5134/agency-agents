# Agentes nos lobos + troca de IA — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os lobos do cérebro passam a ser ocupados pelos departamentos e agentes reais da agência (acendendo quando delegados), e o painel mostra "onde eu parei" por projeto com o comando pronto para continuar em outra IA.

**Architecture:** O script do catálogo gera `agentes.json` (id + nome por divisão, pequeno); `brain.ts` troca as pastas falsas (`GROUPS`) pelos departamentos mapeados a regiões; `build()` cria um neurônio por agente real; `agencia.ts` ganha `agentesAcesos`; o painel ganha rota `GET /api/painel/fichas`, `ProjetosPanel` e `comandoContinuar`.

**Tech Stack:** React 19, TypeScript estrito, TanStack Start, Vitest + Testing Library, Cloudflare Worker (D1).

**Spec:** `docs/superpowers/specs/2026-11-24-agentes-nos-lobos-e-troca-de-ia-design.md`

Diretório do app: `segundo-cerebro/` (comandos rodam nele).

## Global Constraints
- Textos da interface em português do Brasil.
- Nada acende sem evento real; sem login, nada de dados privados (fichas, atividade) aparece.
- Cores só da paleta `fx()`: red, orange, yellow, green, cyan, blue, purple, magenta.
- O navegador nunca importa `src/lib/cerebro/catalogo.json`; só `divisoes.json` e `agentes.json`.
- Não mudar câmera, regiões (`REGIONS`), entradas de IA, `SKILLS` (5 itens) de `brain.ts`, nem a coluna "Agência GD3"/skills.
- `GraphPanel.tsx` não é formatado pelo prettier: editar cirurgicamente, sem rodar prettier nele. Rodar prettier nos demais arquivos tocados.
- `npx tsc --noEmit -p tsconfig.json`, `npx vitest run` e `bun run build` passam.

## Review Focus
- Departamentos que dividem a mesma região (ex.: Frontal com Estratégia e Produto): hubs não podem cair no mesmo ponto — teste na Task 1 (hubs distintos por região).
- Agente de divisão desconhecida no catálogo: vai para Especialistas, sem sumir — teste na Task 1 (total de neurônios de agente = soma de `divisoes.json`).
- Delegação sem `agentes` (evento antigo): nenhum neurônio acende, sem erro — teste na Task 2.
- Projeto com ficha incompleta (sem etapa/próximo passo): cartão mostra "não informado" em vez de vazio — teste na Task 3.
- Slug com caracteres especiais no comando copiado: o comando usa o slug como está, entre aspas — teste na Task 3.

---

### Task 1: Departamentos e agentes reais ocupam os lobos

**Files:**
- Modify: `segundo-cerebro/scripts/gerar-catalogo.mjs` (também grava `src/lib/cerebro/agentes.json`: `Record<string, { id: string; nome: string }[]>`, divisão → agentes em ordem do catálogo) e rodar o script
- Create: `segundo-cerebro/src/lib/cerebro/agentes.json` (gerado)
- Modify: `segundo-cerebro/src/components/dash/brain.ts` (`GROUPS`, `buildBrainIndex`)
- Modify: `segundo-cerebro/src/components/dash/brain-graph-model.ts` (`N`, `build()`)
- Test: `segundo-cerebro/src/test/agentes-nos-lobos.test.ts`

**Interfaces:**
- Consumes: `DEPARTAMENTOS`, `departamentoDe`, `type DepartamentoId`, `type CorFx` de `src/lib/cerebro/agencia.ts`; `divisoes.json`.
- Produces:
  - `export const REGIAO_DO_DEPARTAMENTO: Record<DepartamentoId, RegionId>` em `brain.ts`, valores exatos:
    estrategia→frontal, produto→frontal, dev→parietal, design→occipital, midia→occipital, marketing→temporal, vendas→temporal, qualidade→cerebellum, especialistas→cerebellum, seguranca→brainstem.
  - `GROUPS: { id: string; dep: DepartamentoId; c: CorFx; n: number; region: RegionId }[]` — um por departamento, na ordem de `DEPARTAMENTOS`; `id` = rótulo do departamento; `c` = cor do departamento; `n` = total real de agentes (de `divisoes.json`, mesmas regras de `estadoAgencia`).
  - `N` ganha `agenteId?: string`; em `build()` o hub de cada grupo tem `label` = rótulo do departamento e cada agente real do departamento vira um neurônio com `label` = nome real e `agenteId` = id. Hubs de departamentos na mesma região ficam em posições distintas dentro da região.
  - `export function agentesDoDepartamento(dep: DepartamentoId): { id: string; nome: string }[]` em `src/lib/cerebro/agentes-cliente.ts` (lê `agentes.json`; divisões fora de `DEPARTAMENTOS` vão para `especialistas`).
  - `buildBrainIndex`: seção `## Departamentos → regiões` com linhas `- <Rótulo> → <Nome da região> (<role>), <n> agentes`; a regra `Grave os resultados em notas/...` vira `- Registre decisões e progresso na ficha do projeto (salvar_ficha).`

- [ ] **Step 1: Teste que falha** (`src/test/agentes-nos-lobos.test.ts`)

```ts
const { nodes } = build();
const hubs = nodes.filter(n => n.hub && n.g >= 0);
const agentes = nodes.filter(n => n.agenteId);
expect(hubs.map(h => h.label)).toEqual(DEPARTAMENTOS.map(d => d.rotulo));
expect(agentes.length).toBe(Object.values(divisoes).reduce((a, b) => a + b, 0));
expect(agentes.find(n => n.agenteId === "engineering/engineering-backend-architect")!.label).toBe("Backend Architect");
for (const n of agentes) expect(inRegion(GROUPS[n.g]!.region, n.tx, n.ty)).toBe(true);
// hubs de departamentos na mesma região não coincidem
const frontal = hubs.filter(h => GROUPS[h.g]!.region === "frontal");
expect(Math.hypot(frontal[0]!.tx - frontal[1]!.tx, frontal[0]!.ty - frontal[1]!.ty)).toBeGreaterThan(20);
expect(GROUPS.find(g => g.dep === "dev")).toMatchObject({ region: "parietal", n: 66, id: "Desenvolvimento" });
expect(buildBrainIndex([])).toContain("- Desenvolvimento → Lobo parietal");
expect(buildBrainIndex([])).not.toContain("notas/");
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/agentes-nos-lobos.test.ts` → FAIL.
- [ ] **Step 3: Implementar** conforme a Interface (gerar `agentes.json` rodando `node scripts/gerar-catalogo.mjs`). Agentes posicionados dentro da região com a mesma técnica de sorteio de `build()` (rejeição por `inRegion`).
- [ ] **Step 4: Verificar** — teste PASS; `npx vitest run` todo PASS (ajustar testes existentes que dependam das pastas antigas, sem enfraquecê-los); `npx tsc --noEmit -p tsconfig.json` limpo.
- [ ] **Step 5: Commit** — `feat(segundo-cerebro): departamentos e agentes reais ocupam os lobos`.

### Task 2: Agentes delegados acendem dentro do cérebro

**Files:**
- Modify: `segundo-cerebro/src/lib/cerebro/agencia.ts` (nova função)
- Modify: `segundo-cerebro/src/components/dash/GraphPanel.tsx` (acender neurônios; painel do neurônio selecionado; legenda de pastas → departamentos)
- Test: `segundo-cerebro/src/test/agencia.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `Atividade["delegacoes"]` (`{ criado_em; ferramenta; area; agentes: string[]; nomes: string[] }[]`); `N.agenteId` e `GROUPS` (Task 1).
- Produces: `export function agentesAcesos(delegacoes: Atividade["delegacoes"] | undefined): Set<string>` — ids de todos os agentes das delegações recebidas (a janela de 15 min já vem do servidor).
- GraphPanel: neurônio com `agenteId` em `agentesAcesos(useAtividade().data?.delegacoes)` desenha um anel pulsando na cor do departamento (mesmo padrão `<animate attributeName="r">` já usado nas entradas de IA) e mostra o nome; ao clicar num neurônio de agente, o painel de detalhe mostra o nome do agente, o departamento e a região (substitui o texto de nota/`[[...]] · 2026-11-20`); a legenda "Pastas do vault" passa a se chamar "Departamentos" e lista `GROUPS` com `n` agentes.

- [ ] **Step 1: Teste que falha** (em `src/test/agencia.test.ts`)

```ts
it("agentesAcesos junta os agentes das delegações e ignora delegação sem agentes", () => {
  const d = (agentes: string[]) => ({ criado_em: new Date().toISOString(), ferramenta: "claude-code", area: "desenvolvimento", agentes, nomes: [] });
  expect([...agentesAcesos([d(["engineering/engineering-backend-architect"]), d([]), d(["design/design-ui-designer", "engineering/engineering-backend-architect"])])].sort())
    .toEqual(["design/design-ui-designer", "engineering/engineering-backend-architect"]);
  expect(agentesAcesos(undefined).size).toBe(0);
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `agentesAcesos` e a ligação no GraphPanel.
- [ ] **Step 4: Verificar** — `npx vitest run` PASS; `tsc` limpo; `bun run build` termina com "You can deploy this build".
- [ ] **Step 5: Commit** — `feat(segundo-cerebro): agentes delegados acendem nos lobos`.

### Task 3: "Onde eu parei" e continuar em outra IA

**Files:**
- Modify: `segundo-cerebro/src/lib/cerebro/painel.server.ts` (rota `GET /api/painel/fichas`, exige login, devolve `listarFichas()`)
- Modify: `segundo-cerebro/src/lib/cerebro/use-atividade.ts` (`useFichas()`)
- Create: `segundo-cerebro/src/lib/cerebro/continuar.ts`
- Create: `segundo-cerebro/src/components/dash/ProjetosPanel.tsx`
- Modify: `segundo-cerebro/src/routes/index.tsx` (seção "Onde eu parei" logo após "Núcleo ao vivo", dentro do mesmo `#cerebro`; só aparece logado — reutilizar `useSessao`)
- Modify: `segundo-cerebro/integracoes/README.md` e `segundo-cerebro/integracoes/claude-code/cerebro-hook.mjs` (o alerta de limite diz que dá para continuar no Codex ou no Gemini pela seção "Onde eu parei")
- Create: `segundo-cerebro/integracoes/codex/README.md`, `segundo-cerebro/integracoes/gemini/settings.exemplo.json`
- Test: `segundo-cerebro/src/test/projetos.test.tsx` e acréscimo em `src/test/cerebro.test.ts` (rota)

**Interfaces:**
- Consumes: `listarFichas()` do store (`projeto, titulo, etapa_atual, proximo_passo, atualizado_por, atualizado_em`); `Atividade.limites`; `useSessao`, `useAtividade`.
- Produces:
  - `export type FerramentaIA = "claude-code" | "codex" | "gemini"`
  - `export function comandoContinuar(ferramenta: FerramentaIA, projeto: string): string` — texto exato:
    `Use o MCP "cerebro": chame ler_ficha com o projeto "<projeto>", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "<ferramenta>") ao fim de cada etapa.`
  - `export function precisaTrocar(limites: Atividade["limites"]): boolean` — true quando 5h ou semana ≥ 85.
  - `ProjetosPanel` (sem props): lista cartões (`data-projeto={slug}`) com título, "Etapa: …", "Próximo passo: …" (vazio → "não informado"), "Salvo por <atualizado_por> há <tempo>"; botão "Continuar em outra IA" abre, no próprio cartão, abas Claude Code / Codex / Gemini com o `comandoContinuar` e um botão "Copiar"; quando `precisaTrocar` → aviso no topo: "Seu limite do Claude está em <maior>% — salve e continue no Codex ou no Gemini." Sem fichas: "Nenhum projeto com ficha ainda. Peça para a IA salvar a ficha (salvar_ficha) ao trabalhar num projeto."
  - Guias: Codex `codex mcp add cerebro --url https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/api/mcp --bearer-token-env-var CEREBRO_TOKEN` (com a variável de ambiente `CEREBRO_TOKEN` definida no Windows); Gemini `~/.gemini/settings.json`: `{ "mcpServers": { "cerebro": { "httpUrl": "<URL>/api/mcp", "headers": { "Authorization": "Bearer ${CEREBRO_TOKEN}" } } } }`. Nenhum token real nos arquivos.

- [ ] **Step 1: Testes que falham**

```tsx
// src/test/projetos.test.tsx
expect(comandoContinuar("codex", "crm-x")).toBe('Use o MCP "cerebro": chame ler_ficha com o projeto "crm-x", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "codex") ao fim de cada etapa.');
expect(precisaTrocar({ limite_5h_pct: 86, limite_7d_pct: 10, em: "x" })).toBe(true);
expect(precisaTrocar({ limite_5h_pct: 50, limite_7d_pct: null, em: "x" })).toBe(false);
// renderizando ProjetosPanel com fetch simulado devolvendo sessão logada, 1 ficha sem proximo_passo e limites 5h=90:
//   aparece o cartão data-projeto="crm-x", "Próximo passo: não informado", o aviso "Seu limite do Claude está em 90%",
//   e ao clicar "Continuar em outra IA" e na aba "Codex" aparece o comandoContinuar("codex", "crm-x").
```
```ts
// src/test/cerebro.test.ts — rota
// GET /api/painel/fichas sem login → 401; com login → 200 e lista com a ficha salva.
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** conforme a Interface.
- [ ] **Step 4: Verificar** — `npx vitest run` PASS; `tsc` limpo; eslint limpo nos arquivos novos; `bun run build` termina com "You can deploy this build".
- [ ] **Step 5: Commit** — `feat(segundo-cerebro): onde eu parei e continuar em outra IA`.
