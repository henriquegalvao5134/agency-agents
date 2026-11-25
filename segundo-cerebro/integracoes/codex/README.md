# Codex + Segundo Cérebro

Quando o limite do Claude acabar, abra a seção **Onde eu parei** do painel, escolha o projeto, clique em
**Continuar em outra IA**, aba **Codex**, copie o texto e cole no Codex.

## Ligar o Codex ao cérebro (uma vez)
1. Defina a variável de ambiente `CEREBRO_TOKEN` com o mesmo segredo do Worker.
   No Windows (PowerShell): `setx CEREBRO_TOKEN "cole-o-token-aqui"` e abra um terminal novo.
2. Adicione o servidor MCP:
```bash
codex mcp add cerebro --url https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/api/mcp --bearer-token-env-var CEREBRO_TOKEN
```
O Codex passa a ter as ferramentas `ler_ficha` e `salvar_ficha`, a mesma memória do Claude Code.
