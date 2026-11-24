# Ligar suas IAs ao Segundo Cérebro

O núcleo mora na própria plataforma (`/api/mcp`). Toda IA conectada lê e grava a mesma memória,
e tudo o que ela faz aparece no painel **Núcleo ao vivo**.

## 1. Configurar o núcleo (uma vez)
1. Crie o banco do núcleo (projeto Supabase próprio) e rode `cerebro/sql/001_nucleo.sql` no SQL Editor.
2. Na Cloudflare, no Worker `henriquegalvao5134-agency-agents-segundo-cerebro` → Settings → Variables and secrets, adicione como **Secret**:
   - `CEREBRO_SUPABASE_URL` — URL do projeto Supabase do núcleo
   - `CEREBRO_SUPABASE_SERVICE_KEY` — chave `service_role` desse projeto
   - `CEREBRO_TOKEN` — um segredo longo e aleatório (é a senha de acesso ao cérebro)

## 2. Claude Code (desktop e VS Code)
Conexão MCP (memória e registro):
```bash
claude mcp add --scope user --transport http cerebro https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/api/mcp --header "Authorization: Bearer SEU_TOKEN"
```
Salvamento automático + barra de consumo: copie o conteúdo de `claude-code/settings.exemplo.json` para
`~/.claude/settings.json` (no Windows: `C:\Users\<você>\.claude\settings.json`), ajustando o caminho da pasta
e o token. A skill `claude-code/skills/salvar-no-cerebro` vai em `~/.claude/skills/salvar-no-cerebro/`.

O que passa a acontecer sozinho:
- Ao abrir uma sessão, a ficha de retomada do projeto (nome da pasta ou `CEREBRO_PROJETO`) entra no contexto.
- Contexto ≥ 70% ou limite de 5h/semana ≥ 85% → a IA é mandada salvar a ficha antes de continuar.
- Tokens de cada resposta e de cada subagente, limites da assinatura e custo estimado vão para o painel.
- Antes de compactar e ao encerrar, fica registrado um checkpoint.

## 3. Outras ferramentas (ChatGPT, Cursor, Codex, Claude desktop)
Adicione um conector/servidor MCP remoto com a URL:
`https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/api/mcp`
e o cabeçalho `Authorization: Bearer SEU_TOKEN`. Se o app só aceitar URL, use
`.../api/mcp/SEU_TOKEN` (trate essa URL como senha).
Nessas ferramentas não há ganchos automáticos: o servidor já instrui a IA a ler e salvar a ficha,
e você pode pedir "salva no cérebro" a qualquer momento.

## Limites conhecidos
- O percentual de 5h/semana só existe para assinaturas Pro/Max e é lido pela barra de status do Claude Code.
- Custo é estimado pelo Claude Code a preço de tabela; pode diferir da fatura.
