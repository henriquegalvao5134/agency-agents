---
name: salvar-no-cerebro
description: Use ao terminar uma etapa importante, quando o contexto ou o limite de uso estiver alto, antes de trocar de ferramenta/conta, ou quando o usuário pedir para salvar o progresso — grava a ficha de retomada do projeto no Segundo Cérebro AutoGTEC.
---

# Salvar no Segundo Cérebro

A memória do trabalho mora no Segundo Cérebro (MCP `cerebro`), não nesta conversa.
Uma ficha bem feita deixa outra sessão, outra conta ou outra IA continuar **sem reler a conversa**.

## Quando salvar
- Ao concluir uma etapa do plano.
- Quando aparecer o alerta de contexto/limite alto.
- Antes de compactar, encerrar ou trocar de ferramenta/conta.
- Quando o usuário pedir ("salva", "guarda isso", "vou trocar de conta").

## Como salvar
1. Se não sabe o slug, chame `listar_fichas`. Se a ficha existe, chame `ler_ficha` antes, para não apagar o que já estava lá.
2. Chame `salvar_ficha` com o estado **completo e atual** (ela substitui a anterior):
   - `objetivo`: o que precisa ser entregue e por quê.
   - `decisoes`: lista do que foi decidido, com o motivo curto. Inclua decisões do usuário com as palavras dele.
   - `plano`: etapas em checklist (`- [x]` feito, `- [ ]` falta).
   - `etapa_atual`: o que estava sendo feito no momento.
   - `proximo_passo`: a próxima ação concreta (um comando, um arquivo, uma pergunta pendente).
   - `arquivos`: arquivos, branches, links e IDs relevantes.
   - `atualizado_por`: a ferramenta (ex.: `claude-code`, `claude-desktop`, `chatgpt`).
3. Confirme ao usuário em uma linha: "Ficha de <projeto> salva no cérebro."

## Regras
- Escreva em português do Brasil, curto e objetivo; nada de transcrever a conversa.
- Nunca coloque senhas, tokens ou chaves de API na ficha.
- Não invente: se algo não foi decidido, escreva "pendente".
