# Cérebro visual da agência — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cérebro da plataforma mostra o orquestrador real no centro, os departamentos da agência (agentes do catálogo) do lado direito e as skills de trabalho embaixo, acendendo com as delegações reais.

**Architecture:** Lógica pura em `src/lib/cerebro/agencia.ts` (departamentos, skills, estado aceso a partir de `Atividade.delegacoes`); camada SVG `AgenciaLayer.tsx` desenhada dentro do `<svg>` do `GraphPanel` (herda câmera/zoom); contagens por divisão geradas pelo script do catálogo.

**Tech Stack:** React 19, TypeScript estrito (`exactOptionalPropertyTypes`), TanStack Start, Vitest + Testing Library (jsdom), Tailwind; paleta via `fx()` de `src/components/dash/panel-utils.ts`.

**Spec:** `docs/superpowers/specs/2026-11-24-cerebro-visual-agencia-design.md`

Diretório do app: `segundo-cerebro/` (rodar comandos dentro dele).

## Global Constraints
- Textos da interface em português do Brasil.
- Não mandar `catalogo.json` (100 KB) ao navegador: o cliente só importa `src/lib/cerebro/divisoes.json` (contagem por divisão).
- Nada acende sem evento real; sem login/sem dados, tudo apagado com contagens reais.
- Cores só da paleta `fx()`: red, orange, yellow, green, cyan, blue, purple, magenta.
- Não mudar regiões do cérebro, câmera, entradas de IA existentes nem `SKILLS` de `brain.ts`.
- `npx tsc --noEmit -p tsconfig.json`, `npx vitest run` e `bun run build` precisam passar; rodar `npx prettier --write` nos arquivos novos/alterados.

## Review Focus
- Sem login (`atividade` indefinida): `estadoAgencia(undefined, ...)` devolve tudo apagado e contagens reais — teste na Task 1.
- Delegação com id de agente de divisão desconhecida (ex. `outra/x`): cai em "Especialistas", sem erro — teste na Task 1.
- Delegação antiga (> 2 min): não marca `orquestradorAtivo` — teste na Task 1.
- Evento antigo sem `meta.agentes` (lista vazia): nada acende, sem erro — teste na Task 1.
- Vários agentes no mesmo departamento: rótulo mostra o primeiro e "+N" — teste na Task 2.

---

### Task 1: Lógica da agência + contagem por divisão

**Files:**
- Create: `segundo-cerebro/src/lib/cerebro/agencia.ts`
- Create (gerado): `segundo-cerebro/src/lib/cerebro/divisoes.json`
- Modify: `segundo-cerebro/scripts/gerar-catalogo.mjs` (também grava `divisoes.json`: `Record<string, number>`, divisão → total)
- Test: `segundo-cerebro/src/test/agencia.test.ts`

**Interfaces:**
- Consumes: `Atividade` de `src/lib/cerebro/types.ts` (campos `delegacoes: { criado_em: string; ferramenta: string; area: string; agentes: string[] }[]`, `salvouAgora: boolean`).
- Produces:
  - `type DepartamentoId = "marketing" | "midia" | "vendas" | "design" | "dev" | "qualidade" | "produto" | "seguranca" | "estrategia" | "especialistas"`
  - `const DEPARTAMENTOS: { id: DepartamentoId; rotulo: string; divisoes: string[]; cor: string }[]` — nesta ordem e valores:
    marketing "Marketing" [marketing] magenta · midia "Mídia paga" [paid-media] red · vendas "Vendas e suporte" [sales, support] orange ·
    design "Design" [design] purple · dev "Desenvolvimento" [engineering] blue · qualidade "Qualidade" [testing] green ·
    produto "Produto e projetos" [product, project-management] cyan · seguranca "Segurança" [security] yellow ·
    estrategia "Estratégia" [specialized, strategy, finance] purple · especialistas "Especialistas" [] cyan (recebe as divisões não listadas)
  - `function departamentoDe(agenteId: string): DepartamentoId` — divisão = trecho antes da primeira `/`.
  - `function nomeAgente(agenteId: string): string` — último trecho do id, sem o prefixo `<divisão>-`, palavras com inicial maiúscula.
  - `type SkillTrabalho = { id: string; rotulo: string; grupo: "superpowers" | "gd3" }`
  - `const SKILLS_TRABALHO: SkillTrabalho[]` — ids e rótulos, nesta ordem: brainstorming "Brainstorming", writing-plans "Plano", subagent-driven-development "Subagentes", test-driven-development "TDD", systematic-debugging "Depuração", requesting-code-review "Revisão de código" (grupo superpowers); fluxo-marketing "Fluxo de marketing", salvar-no-cerebro "Salvar no cérebro" (grupo gd3).
  - `type EstadoAgencia = { departamentos: { id: DepartamentoId; rotulo: string; cor: string; total: number; aceso: boolean; agentes: string[] }[]; skillsAcesas: string[]; orquestradorAtivo: boolean }`
  - `function estadoAgencia(atividade: Pick<Atividade, "delegacoes" | "salvouAgora"> | undefined, divisoes: Record<string, number>, agora?: Date): EstadoAgencia`
    — `agentes` = nomes legíveis dos agentes das delegações recebidas (sem repetir, na ordem da mais nova); `aceso` = tem agente;
    skills: área da delegação mais nova `desenvolvimento` → todas do grupo superpowers; `marketing` → `fluxo-marketing`; `salvouAgora` → `salvar-no-cerebro`;
    `orquestradorAtivo` = delegação mais nova há menos de 2 minutos de `agora`.

- [ ] **Step 1: Escrever os testes que falham** (`src/test/agencia.test.ts`)

```ts
const agora = new Date("2026-11-25T12:00:00Z");
const deleg = (min: number, area: string, agentes: string[]) => ({ criado_em: new Date(agora.getTime() - min * 60_000).toISOString(), ferramenta: "claude-code", area, agentes });
const divisoes = { engineering: 66, marketing: 37, "paid-media": 7, sales: 9, support: 6, academic: 6 };

it("sem login tudo apagado com contagens reais", () => {
  const e = estadoAgencia(undefined, divisoes, agora);
  expect(e.departamentos.find(d => d.id === "dev")).toMatchObject({ total: 66, aceso: false, agentes: [] });
  expect(e.departamentos.find(d => d.id === "vendas")!.total).toBe(15);
  expect(e.departamentos.find(d => d.id === "especialistas")!.total).toBe(6);
  expect(e.skillsAcesas).toEqual([]); expect(e.orquestradorAtivo).toBe(false);
});
it("delegação de desenvolvimento acende o departamento, o orquestrador e as skills superpowers", () => {
  const e = estadoAgencia({ delegacoes: [deleg(1, "desenvolvimento", ["engineering/engineering-backend-architect"])], salvouAgora: false }, divisoes, agora);
  expect(e.departamentos.find(d => d.id === "dev")).toMatchObject({ aceso: true, agentes: ["Backend Architect"] });
  expect(e.orquestradorAtivo).toBe(true);
  expect(e.skillsAcesas).toEqual(["brainstorming", "writing-plans", "subagent-driven-development", "test-driven-development", "systematic-debugging", "requesting-code-review"]);
});
it("marketing acende o fluxo de marketing; ficha salva acende salvar-no-cerebro", () => {
  const e = estadoAgencia({ delegacoes: [deleg(1, "marketing", ["paid-media/paid-media-ppc-strategist"])], salvouAgora: true }, divisoes, agora);
  expect(e.skillsAcesas).toEqual(["fluxo-marketing", "salvar-no-cerebro"]);
  expect(e.departamentos.find(d => d.id === "midia")!.agentes).toEqual(["Ppc Strategist"]);
});
it("divisão desconhecida vai para Especialistas; delegação antiga não ativa o orquestrador; meta vazia não acende nada", () => {
  expect(departamentoDe("outra/x")).toBe("especialistas");
  const e = estadoAgencia({ delegacoes: [deleg(5, "estrategia", ["outra/outra-coisa"]), deleg(6, "desenvolvimento", [])], salvouAgora: false }, divisoes, agora);
  expect(e.orquestradorAtivo).toBe(false);
  expect(e.departamentos.find(d => d.id === "especialistas")!.agentes).toEqual(["Coisa"]);
  expect(e.departamentos.filter(d => d.aceso).map(d => d.id)).toEqual(["especialistas"]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/agencia.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `agencia.ts`** com as assinaturas acima; atualizar o script para gravar `divisoes.json` e rodar `node scripts/gerar-catalogo.mjs`.
- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/test/agencia.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.json` sem erros.
- [ ] **Step 5: Commit** — `git add` dos arquivos da task; `git commit -m "feat(segundo-cerebro): lógica de departamentos e skills da agência"`.

### Task 2: Camada visual no cérebro

**Files:**
- Create: `segundo-cerebro/src/components/dash/AgenciaLayer.tsx`
- Modify: `segundo-cerebro/src/components/dash/GraphPanel.tsx` (renderizar a camada logo após o texto `ENTRADAS DE IA`; trocar o rótulo fixo `ORQUESTRADOR · brain.md` da linha ~225)
- Test: `segundo-cerebro/src/test/agencia-layer.test.tsx`

**Interfaces:**
- Consumes: `estadoAgencia`, `EstadoAgencia`, `SKILLS_TRABALHO` (Task 1); `divisoes.json`; `useAtividade()` e `useProvedores()` de `src/lib/cerebro/use-atividade.ts`; `CORE` e `brainOffset` do GraphPanel; `fx()`.
- Produces: `function AgenciaLayer(props: { estado: EstadoAgencia; core: { x: number; y: number } }): JSX.Element` — um `<g data-agencia>` SVG (coordenadas de mundo do GraphPanel):
  - coluna "AGÊNCIA GD3" em x = 300 (caixas 130×28, espaçadas 34, centradas verticalmente em y = -30), cada caixa com `data-departamento={id}` e `data-aceso`;
    fio curvo do `core` até a borda esquerda da caixa (classe `wire-flow` quando acesa, cor `fx(cor)`; apagada `fx("700")`);
    texto: rótulo + segunda linha `"◉ <primeiro agente>"` (com ` +N` quando houver mais) se acesa, senão `"<total> agentes"`.
  - fileira "SKILLS" em y = 265, 8 fichas 100×22 com 8 de espaço, centradas em x = 0, cada uma com `data-skill={id}` e `data-aceso`; acesa com contorno `fx("cyan")` e `filter="url(#neon)"`.
- No GraphPanel: `const estado = estadoAgencia(useAtividade().data, divisoes)`; rótulo do núcleo = `ORQUESTRADOR · ${orquestrador ? orquestrador.nome : "sem IA no cofre"}` + `" · delegando"` quando `estado.orquestradorAtivo`, onde `orquestrador = useProvedores().data?.find(p => p.papel === "orquestrador")`.

- [ ] **Step 1: Escrever o teste que falha** (`src/test/agencia-layer.test.tsx`)

```tsx
it("desenha departamentos, agente delegado com +N e skills acesas", () => {
  const estado = estadoAgencia({ delegacoes: [{ criado_em: new Date().toISOString(), ferramenta: "claude-code", area: "desenvolvimento",
    agentes: ["engineering/engineering-backend-architect", "engineering/engineering-frontend-developer"] }], salvouAgora: false }, { engineering: 66 });
  const { container, getByText } = render(<svg><AgenciaLayer estado={estado} core={{ x: 10, y: -30 }} /></svg>);
  expect(getByText("AGÊNCIA GD3")).toBeInTheDocument();
  expect(container.querySelector('[data-departamento="dev"]')!.getAttribute("data-aceso")).toBe("true");
  expect(getByText("◉ Backend Architect +1")).toBeInTheDocument();
  expect(container.querySelector('[data-skill="brainstorming"]')!.getAttribute("data-aceso")).toBe("true");
  expect(container.querySelector('[data-skill="fluxo-marketing"]')!.getAttribute("data-aceso")).toBe("false");
  expect(container.querySelectorAll("[data-departamento]")).toHaveLength(10);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/agencia-layer.test.tsx` → FAIL.
- [ ] **Step 3: Implementar `AgenciaLayer.tsx` e ligar no `GraphPanel.tsx`** conforme a Interface.
- [ ] **Step 4: Verificar** — teste PASS; `npx vitest run` todo PASS; `npx tsc --noEmit -p tsconfig.json` sem erros; `bun run build` termina com "You can deploy this build".
- [ ] **Step 5: Commit** — `git commit -m "feat(segundo-cerebro): orquestrador, agência e skills visíveis no cérebro"`.
