#!/usr/bin/env node
// Linha de status do Claude Code ligada ao Segundo Cérebro.
// Mostra contexto e limites da assinatura na barra, guarda esses números para o gancho de alerta
// e manda ao painel (no máximo a cada 2 minutos) os limites de 5h/semana e o custo estimado da sessão.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const URL_BASE = (process.env.CEREBRO_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.CEREBRO_TOKEN || "";
const slug = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

let d = {};
try { d = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* ignora */ }
const sessao = d.session_id || "";
const caminho = join(tmpdir(), `cerebro-${slug(sessao) || "sessao"}.json`);
let estado = {};
try { estado = JSON.parse(readFileSync(caminho, "utf8")); } catch { /* primeira vez */ }

const ctx = d.context_window?.used_percentage ?? null;
const l5 = d.rate_limits?.five_hour?.used_percentage ?? null;
const l7 = d.rate_limits?.seven_day?.used_percentage ?? null;
const custo = d.cost?.total_cost_usd ?? 0;
Object.assign(estado, { contexto_pct: ctx ?? estado.contexto_pct, limite_5h_pct: l5 ?? estado.limite_5h_pct, limite_7d_pct: l7 ?? estado.limite_7d_pct });

const agora = Date.now();
if (URL_BASE && TOKEN && agora - (estado.status_enviado_em || 0) > 120_000 && (l5 !== null || l7 !== null || custo > (estado.custo_enviado || 0))) {
  const delta = Math.max(0, custo - (estado.custo_enviado || 0));
  estado.status_enviado_em = agora; estado.custo_enviado = custo;
  const projeto = slug(process.env.CEREBRO_PROJETO || basename(d.workspace?.current_dir || d.cwd || process.cwd()));
  try {
    await fetch(`${URL_BASE}/api/cerebro/eventos`, {
      method: "POST", signal: AbortSignal.timeout(3000),
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ ferramenta: "claude-code", sessao, projeto, tipo: "uso", descricao: "Leitura de limites e custo", modelo: d.model?.id || "", custo_usd: Number(delta.toFixed(6)), limite_5h_pct: l5, limite_7d_pct: l7 }),
    });
  } catch { /* sem rede: tenta de novo na próxima */ }
}
try { writeFileSync(caminho, JSON.stringify(estado)); } catch { /* ignora */ }

const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v)}%`);
process.stdout.write(`cérebro · ${d.model?.display_name || ""} · contexto ${pct(ctx)} · 5h ${pct(l5)} · semana ${pct(l7)}`);
