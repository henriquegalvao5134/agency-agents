#!/usr/bin/env node
// Gera src/lib/cerebro/catalogo.json (e divisoes.json: divisão → total de agentes) a partir dos agentes do repositório agency-agents.
// Só o índice (nome, descrição, divisão) vai para o Worker; o texto completo é lido do GitHub sob demanda.
// Rode de novo sempre que agentes forem adicionados, traduzidos ou reorganizados:  node scripts/gerar-catalogo.mjs
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..", "..");
const { divisions } = JSON.parse(readFileSync(join(raiz, "divisions.json"), "utf8"));

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : n.endsWith(".md") ? [p] : [];
  });
}
function frontmatter(texto) {
  const m = texto.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const campos = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i > 0)
      campos[linha.slice(0, i).trim()] = linha
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return campos;
}

const catalogo = [];
for (const [divisao, info] of Object.entries(divisions)) {
  for (const arq of arquivos(join(raiz, divisao)).sort()) {
    const fm = frontmatter(readFileSync(arq, "utf8"));
    if (!fm?.name) continue;
    catalogo.push({
      id: relative(raiz, arq).replace(/\\/g, "/").replace(/\.md$/, ""),
      nome: fm.name,
      descricao: (fm.description || "").slice(0, 300),
      divisao,
      rotulo: info.label,
    });
  }
}
writeFileSync(
  join(aqui, "..", "src", "lib", "cerebro", "catalogo.json"),
  JSON.stringify(catalogo) + "\n",
);
const porDivisao = {};
for (const a of catalogo) porDivisao[a.divisao] = (porDivisao[a.divisao] ?? 0) + 1;
writeFileSync(
  join(aqui, "..", "src", "lib", "cerebro", "divisoes.json"),
  JSON.stringify(porDivisao) + "\n",
);
console.log(
  `${catalogo.length} agentes no catálogo em ${Object.keys(porDivisao).length} divisões.`,
);
