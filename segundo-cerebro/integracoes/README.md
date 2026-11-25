# Ligar suas IAs ao Segundo Cérebro

O núcleo mora na própria plataforma (`/api/mcp`). Toda IA conectada lê e grava a mesma memória,
e tudo o que ela faz aparece no painel **Núcleo ao vivo**.

## 1. Configurar o núcleo (uma vez)
1. Banco: D1 da Cloudflare chamado `cerebro`, ligado ao Worker como `CEREBRO_DB` (ver `wrangler.jsonc`).
   Tabelas: `cerebro/migrations/0001_nucleo.sql`.
2. No Worker `henriquegalvao5134-agency-agents-segundo-cerebro` → Settings → Variables and secrets, como **Secret**:
   - `CEREBRO_TOKEN` — segredo longo e aleatório: é o acesso das IAs (MCP e ganchos)
   - `CEREBRO_SENHA_PAINEL` — senha para entrar no painel do site
   - `CEREBRO_CHAVE_MESTRA` — base64 de 32 bytes aleatórios: cifra as chaves de API do cofre e assina o login.
     Se for trocada, as chaves já cadastradas deixam de abrir (cadastre de novo).
3. Entre no painel (seção "Núcleo ao vivo"), abra o **Cofre de IAs** e cadastre as IAs com as chaves.
   Marque uma (modelo barato, ex. Haiku) com o papel **Orquestrador**.

### Como o trabalho flui
Você trabalha no Claude Code → ele chama a ferramenta `orquestrar` do cérebro → o orquestrador (IA do cofre)
escolhe área, subagentes do catálogo e fluxo (código → skills superpowers) e devolve as instruções →
o Claude Code executa com a sua assinatura (planeja com modelo alto, executa com menor) → tudo é registrado
e aparece no cérebro e no painel.

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

## 4. Acabou o limite do Claude? Continue em outra IA
No painel, seção **Onde eu parei** (entre com a senha do painel): cada projeto com ficha mostra a etapa, o próximo passo
e o botão **Continuar em outra IA**, que dá o texto pronto para colar no Claude Code, no Codex ou no Gemini.
Quando o limite do Claude passa de 85%, a seção avisa. Para o Codex e o Gemini enxergarem a mesma memória, ligue o MCP neles:
- Codex: ver `codex/README.md`.
- Gemini CLI (escolha um dos dois jeitos):
  - Pelo terminal (PowerShell, Mac ou Linux). As aspas simples fazem o token ficar fora do arquivo: o Gemini lê
    `CEREBRO_TOKEN` na hora de usar.
    ```bash
    gemini mcp add -s user --transport http --header 'Authorization: Bearer $CEREBRO_TOKEN' cerebro https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/api/mcp
    ```
    O comando acrescenta o cérebro ao `~/.gemini/settings.json` sem apagar o que já está lá.
  - À mão: **não substitua** um `~/.gemini/settings.json` que já existe (no Windows:
    `C:\Users\<você>\.gemini\settings.json`), porque você perderia as suas configurações.
    Abra o arquivo e junte só o bloco `"cerebro"` de `gemini/settings.exemplo.json` dentro de `"mcpServers"`
    (se ainda não houver `"mcpServers"`, acrescente ele inteiro, com vírgula depois do item anterior).
    Só copie o exemplo inteiro se o arquivo ainda não existir.
Defina a variável de ambiente `CEREBRO_TOKEN` (o mesmo segredo do Worker) no seu computador; nenhum token vai para arquivos.

## Limites conhecidos
- O percentual de 5h/semana só existe para assinaturas Pro/Max e é lido pela barra de status do Claude Code.
- Custo é estimado pelo Claude Code a preço de tabela; pode diferir da fatura.
