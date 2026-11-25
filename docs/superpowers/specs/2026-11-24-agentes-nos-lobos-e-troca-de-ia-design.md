# Agentes nos lobos + "onde eu parei" e troca de IA — desenho

## Intenção (palavras do Henrique)
"Os agentes na lateral ficou bom para saber visualmente, mas eles tinham que estar ocupando o cérebro mesmo,
o lobo frontal, as imagens, os textos do cérebro." Referência de produto: orca.dev (agentes rodando, coordenador +
trabalhadores, limites por assinatura, troca de conta). Necessidade central: "usar os agentes e conseguir mudar de
LLM quando meus tokens acabarem, e continuar o trabalho de onde eu parei."

## Estado atual
- Os lobos do cérebro mostram pastas de exemplo do Obsidian (`GROUPS` em `src/components/dash/brain.ts`: Notas,
  Recortes, Referências, Modelos, Categorias, Diário, Anexos) com ~370 "notas" falsas geradas por
  `build()` em `src/components/dash/brain-graph-model.ts`.
- Já existe: catálogo (283 agentes, `catalogo.json` só no servidor), `divisoes.json` (contagens),
  `agencia.ts` (`DEPARTAMENTOS`, `estadoAgencia`, delegações com `agentes`/`nomes`), coluna "Agência GD3" e skills.
- Memória: fichas de retomada no D1 (`listarFichas` no store); MCP com `ler_ficha`/`salvar_ficha`; limites 5h/semana
  chegam pelo Claude Code (statusline) e aparecem no painel "Núcleo ao vivo".

## Objetivo
1. **Agentes ocupam os lobos.** As pastas falsas saem. Cada lobo recebe os departamentos da agência e os agentes
   reais (nome do catálogo) como neurônios:
   - Frontal (decisão): Estratégia, Produto e projetos
   - Parietal (estrutura): Desenvolvimento
   - Occipital (visão): Design, Mídia paga
   - Temporal (linguagem/memória): Marketing, Vendas e suporte
   - Cerebelo (execução/rotina): Qualidade, Especialistas
   - Tronco (manter vivo): Segurança
   O hub de cada departamento leva o nome do departamento; cada agente é um neurônio com o nome real.
   Um agente escolhido numa delegação recente acende (anel pulsando) dentro do lobo.
   O texto `brain.md` (índice do orquestrador) e a legenda de pastas passam a listar os departamentos.
   A coluna "Agência GD3" à direita e a fileira de skills continuam.
2. **"Onde eu parei" na tela.** Nova seção no painel (logado): cartões dos projetos com ficha — título, etapa atual,
   próximo passo, quem salvou por último e há quanto tempo.
3. **"Continuar em outra IA".** Em cada cartão, um botão abre o comando pronto para copiar, por ferramenta
   (Claude Code, Codex, Gemini): a outra IA lê a ficha pelo MCP `cerebro` e segue do próximo passo.
   Quando o limite de 5h ou da semana estiver em 85% ou mais, aparece um aviso no topo da seção sugerindo a troca.
4. **Codex e Gemini ligados ao cérebro**: guia de instalação em `integracoes/` com os comandos verificados:
   Codex `codex mcp add cerebro --url <URL>/api/mcp --bearer-token-env-var CEREBRO_TOKEN`;
   Gemini `~/.gemini/settings.json` com `mcpServers.cerebro.httpUrl` e `headers.Authorization = "Bearer ${CEREBRO_TOKEN}"`.

## Não-objetivos
- Executor na VPS que inicia agentes sozinho (estilo Orca): fica para depois.
- Mexer em câmera, regiões, entradas de IA, `SKILLS` de 5 itens e animações existentes além de trocar os dados dos lobos.
- Mandar o `catalogo.json` completo ao navegador: só id + nome dos agentes (arquivo pequeno gerado pelo script).

## Abordagens consideradas
- **Trocar os dados de `GROUPS`/`build()` pelos departamentos e agentes (escolhida):** reaproveita o desenho, as
  animações e o clique em neurônio que já existem; o cérebro passa a significar a agência.
- Desenhar os agentes por cima dos lobos numa camada nova: duplica neurônios e confunde (falsos + reais).
- Só a coluna lateral: já existe e o Henrique pediu os agentes dentro do cérebro.

## Restrições
- Textos em português do Brasil; nada acende sem evento real; cores só da paleta `fx()`.
- `tsc`, `vitest` e `bun run build` passam.
