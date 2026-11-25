# Cérebro visual da agência — desenho

## Intenção (palavras do Henrique)
O cérebro da plataforma tem que **mostrar** o trabalho: o agente orquestrador, os agentes da agência nos lados
do cérebro e as skills — não só um motor invisível. "Não me parece funcional: o cérebro não mostra o agente
orquestrador, não mostra nos lados do cérebro os agentes e as skills."

## Estado atual
- `src/components/dash/GraphPanel.tsx` desenha o cérebro (SVG): entradas de IA à esquerda (`PORT_X = -320`),
  núcleo "IA" no centro com o rótulo fixo `ORQUESTRADOR · brain.md`, 5 skills fixas (`SKILLS` em `brain.ts`).
- O núcleo real já está no ar: `/api/painel/atividade` devolve `Atividade` (eventos, consumo, ativos) e agora também
  `delegacoes` (últimos 15 min, com `area` e `agentes` = ids do catálogo) e `salvouAgora`.
- Catálogo: `src/lib/cerebro/catalogo.json` (283 agentes, campo `divisao`), gerado por `scripts/gerar-catalogo.mjs`.
- IAs do cofre: `useProvedores()` (só logado); a de `papel === "orquestrador"` é o orquestrador.

## Objetivo
1. **Orquestrador no centro**: o rótulo do núcleo mostra a IA orquestradora do cofre (nome · modelo) ou
   "sem IA no cofre"; quando houve delegação nos últimos 2 min, mostra "delegando" e pulsa.
2. **Agência GD3 no lado direito** (espelho das entradas de IA): 10 departamentos com a contagem de agentes do
   catálogo, cada um ligado ao núcleo por um fio. Quando uma delegação recente escolheu agentes de um
   departamento, ele acende e mostra o nome do agente escolhido.
3. **Skills embaixo do cérebro**: fileira com as skills de trabalho — superpowers (brainstorming, writing-plans,
   subagent-driven-development, test-driven-development, systematic-debugging, requesting-code-review) e da GD3
   (fluxo de marketing, salvar-no-cerebro). Acendem conforme a área da última delegação
   (desenvolvimento → superpowers; marketing → fluxo de marketing) e `salvouAgora` (salvar-no-cerebro).

Departamentos (divisões do catálogo → rótulo):
marketing→Marketing · paid-media→Mídia paga · sales+support→Vendas e suporte · design→Design ·
engineering→Desenvolvimento · testing→Qualidade · product+project-management→Produto e projetos ·
security→Segurança · specialized+strategy+finance→Estratégia · demais→Especialistas.

## Não-objetivos
- Não redesenhar o cérebro, as regiões, a câmera nem as entradas de IA existentes.
- Não mandar o catálogo inteiro (100 KB) para o navegador: só a contagem por departamento.
- Nada inventado: sem login/sem dados, os departamentos aparecem apagados com a contagem real; nada "acende" sem evento real.

## Abordagens consideradas
- **Camada SVG nova dentro do mesmo `<svg>` do GraphPanel (escolhida)**: herda câmera, zoom e arraste; fica "ao lado
  do cérebro" de verdade.
- Painel HTML separado ao lado: mais simples, mas não fica no cérebro (o que o Henrique pediu).
- Trocar as 5 skills fixas por skills reais na região do cérebro: mexe na geometria e na animação; fica para depois.

## Peças
- `src/lib/cerebro/agencia.ts` (funções puras, testáveis): `DEPARTAMENTOS`, `departamentoDe(id)`,
  `SKILLS_TRABALHO`, `estadoAgencia(atividade, contagens)` → quais departamentos/skills estão acesos e com que rótulo.
- `src/lib/cerebro/departamentos.json`: contagem por departamento, gerada pelo `scripts/gerar-catalogo.mjs`.
- `src/components/dash/AgenciaLayer.tsx`: `<g>` SVG com departamentos (direita), skills (embaixo) e fios ao núcleo.
- `GraphPanel.tsx`: renderiza `<AgenciaLayer>` e troca o rótulo fixo do núcleo pelo orquestrador real.

## Deixado ao construtor
Coordenadas exatas, espaçamento e cores (usar a paleta `fx()` existente e as classes `wire-flow`).
