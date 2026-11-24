#!/usr/bin/env node
// Ganchos do Claude Code -> Segundo Cérebro AutoGTEC.
// Funciona em Windows, Mac e Linux (só Node, sem dependências).
//
// Variáveis de ambiente (configure em ~/.claude/settings.json → "env"):
//   CEREBRO_URL      ex.: https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev
//   CEREBRO_TOKEN    o mesmo segredo configurado na plataforma
//   CEREBRO_PROJETO  (opcional) slug do projeto; se faltar, usa o nome da pasta aberta
//
// O que cada gancho faz:
//   SessionStart      → avisa o painel e injeta a ficha de retomada do projeto no contexto
//   UserPromptSubmit  → se o contexto ou o limite estiver alto, manda a IA salvar a ficha antes de seguir
//   Stop              → registra os tokens gastos desde a última vez
//   SubagentStop      → registra o subagente que trabalhou e os tokens dele
//   PreCompact        → registra o checkpoint antes de o Claude Code compactar a conversa
//   SessionEnd        → registra o fim da sessão
// Falhas de rede nunca travam o Claude Code: o gancho sai em silêncio.

import { readFileSync, writeFileSync, existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const URL_BASE = (process.env.CEREBRO_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.CEREBRO_TOKEN || "";
const LIMITE_CONTEXTO = Number(process.env.CEREBRO_ALERTA_CONTEXTO || 70); // % do contexto
const LIMITE_USO = Number(process.env.CEREBRO_ALERTA_LIMITE || 85); // % do limite 5h/semana

const lerStdin = () => { try { return JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { return {}; } };
const slug = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const estadoPath = (sessao) => join(tmpdir(), `cerebro-${slug(sessao) || "sessao"}.json`);
const lerEstado = (sessao) => { try { return JSON.parse(readFileSync(estadoPath(sessao), "utf8")); } catch { return {}; } };
const salvarEstado = (sessao, e) => { try { writeFileSync(estadoPath(sessao), JSON.stringify(e)); } catch { /* ignora */ } };

async function chamar(path, init = {}) {
  if (!URL_BASE || !TOKEN) return null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${URL_BASE}${path}`, { ...init, signal: ctrl.signal, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(init.headers || {}) } });
    return r.ok ? await r.json().catch(() => null) : null;
  } catch { return null; } finally { clearTimeout(t); }
}
const registrar = (eventos) => chamar("/api/cerebro/eventos", { method: "POST", body: JSON.stringify(eventos) });

/** Soma o uso de tokens do transcript a partir de onde parou da última vez (sem contar a mesma mensagem duas vezes). */
function usoNovo(transcript, chaveEstado, estado) {
  const r = { entrada: 0, saida: 0, cache: 0, modelo: "" };
  if (!transcript || !existsSync(transcript)) return r;
  const tamanho = statSync(transcript).size;
  let inicio = estado[chaveEstado]?.offset || 0;
  if (inicio > tamanho) inicio = 0; // transcript foi recriado
  const vistos = new Set(estado[chaveEstado]?.ids || []);
  const fd = openSync(transcript, "r"); const buf = Buffer.alloc(tamanho - inicio);
  readSync(fd, buf, 0, buf.length, inicio); closeSync(fd);
  const texto = buf.toString("utf8"); const fim = texto.lastIndexOf("\n");
  if (fim < 0) return r;
  for (const linha of texto.slice(0, fim).split("\n")) {
    let obj; try { obj = JSON.parse(linha); } catch { continue; }
    const msg = obj?.message; const u = msg?.usage;
    if (obj?.type !== "assistant" || !u) continue;
    const id = msg.id || obj.uuid; if (id && vistos.has(id)) continue; if (id) vistos.add(id);
    r.entrada += u.input_tokens || 0; r.saida += u.output_tokens || 0;
    r.cache += (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    if (msg.model) r.modelo = msg.model;
  }
  estado[chaveEstado] = { offset: inicio + Buffer.byteLength(texto.slice(0, fim + 1)), ids: [...vistos].slice(-300) };
  return r;
}

const entrada = lerStdin();
const evento = entrada.hook_event_name || process.argv[2] || "";
const sessao = entrada.session_id || "";
const projeto = slug(process.env.CEREBRO_PROJETO || basename(entrada.cwd || process.cwd()));
const base = { ferramenta: "claude-code", sessao, projeto };
const estado = lerEstado(sessao);

try {
  if (evento === "SessionStart") {
    await registrar([{ ...base, tipo: "inicio", descricao: `Sessão ${entrada.source || "iniciada"} em ${projeto}` }]);
    const ficha = await chamar(`/api/cerebro/fichas/${encodeURIComponent(projeto)}`);
    const contexto = ficha
      ? `## Ficha de retomada do Segundo Cérebro (${ficha.projeto})\nTítulo: ${ficha.titulo}\nObjetivo: ${ficha.objetivo}\nEtapa atual: ${ficha.etapa_atual}\nPróximo passo: ${ficha.proximo_passo}\n\n### Decisões\n${ficha.decisoes}\n\n### Plano\n${ficha.plano}\n\n### Arquivos\n${ficha.arquivos}\n\n(Atualizada por ${ficha.atualizado_por} em ${ficha.atualizado_em}.) Continue daqui e mantenha a ficha atualizada com a ferramenta salvar_ficha do MCP "cerebro".`
      : `O projeto "${projeto}" ainda não tem ficha no Segundo Cérebro. Quando houver objetivo e plano claros, crie com a ferramenta salvar_ficha do MCP "cerebro" (projeto: "${projeto}").`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: contexto } }));
  } else if (evento === "UserPromptSubmit") {
    const ctx = estado.contexto_pct ?? 0, l5 = estado.limite_5h_pct ?? 0, l7 = estado.limite_7d_pct ?? 0;
    const motivos = [];
    if (ctx >= LIMITE_CONTEXTO) motivos.push(`o contexto da conversa está em ${Math.round(ctx)}%`);
    if (l5 >= LIMITE_USO) motivos.push(`o limite de 5 horas está em ${Math.round(l5)}%`);
    if (l7 >= LIMITE_USO) motivos.push(`o limite semanal está em ${Math.round(l7)}%`);
    const avisadoEm = estado.avisado_em || 0;
    if (motivos.length && Date.now() - avisadoEm > 10 * 60_000) {
      estado.avisado_em = Date.now(); salvarEstado(sessao, estado);
      await registrar([{ ...base, tipo: "checkpoint", descricao: `Alerta: ${motivos.join(" e ")}` }]);
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `ATENÇÃO (Segundo Cérebro): ${motivos.join(" e ")}. Antes de responder ao pedido, chame salvar_ficha do MCP "cerebro" para o projeto "${projeto}" com o estado COMPLETO (objetivo, decisões, plano, etapa atual, próximo passo, arquivos), para que outra sessão ou outra IA continue sem perder nada. Depois siga com o pedido.` } }));
    }
  } else if (evento === "Stop" || evento === "PreCompact" || evento === "SessionEnd") {
    const u = usoNovo(entrada.transcript_path, "principal", estado);
    salvarEstado(sessao, estado);
    const tipo = evento === "Stop" ? "uso" : evento === "PreCompact" ? "checkpoint" : "fim";
    const descricao = evento === "Stop" ? "Resposta concluída" : evento === "PreCompact" ? `Conversa vai ser compactada (${entrada.trigger || "auto"})` : `Sessão encerrada (${entrada.reason || "fim"})`;
    await registrar([{ ...base, tipo, descricao, modelo: u.modelo, tokens_entrada: u.entrada, tokens_saida: u.saida, tokens_cache: u.cache }]);
  } else if (evento === "SubagentStop") {
    const transcript = entrada.agent_transcript_path || "";
    const u = usoNovo(transcript, `sub:${transcript}`, estado);
    salvarEstado(sessao, estado);
    await registrar([{ ...base, tipo: "etapa", agente: entrada.agent_type || "subagente", descricao: `Subagente ${entrada.agent_type || ""} concluiu`.trim(), modelo: u.modelo, tokens_entrada: u.entrada, tokens_saida: u.saida, tokens_cache: u.cache }]);
  }
} catch { /* nunca travar o Claude Code */ }
process.exit(0);
