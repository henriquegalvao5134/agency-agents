// Agentes reais (id + nome) para o navegador. Lê agentes.json, gerado por scripts/gerar-catalogo.mjs;
// o catalogo.json completo fica só no servidor.
import { DEPARTAMENTOS, type DepartamentoId } from "./agencia";
import agentesPorDivisao from "./agentes.json";

export type AgenteCliente = { id: string; nome: string };

const AGENTES: Record<string, AgenteCliente[]> = agentesPorDivisao;
const LISTADAS = new Set(DEPARTAMENTOS.flatMap((d) => d.divisoes));

/** Agentes do departamento, na ordem do catálogo. Divisões fora de DEPARTAMENTOS vão para "especialistas". */
export function agentesDoDepartamento(dep: DepartamentoId): AgenteCliente[] {
  const divisoes =
    dep === "especialistas"
      ? Object.keys(AGENTES).filter((div) => !LISTADAS.has(div))
      : (DEPARTAMENTOS.find((d) => d.id === dep)?.divisoes ?? []);
  return divisoes.flatMap((div) => AGENTES[div] ?? []);
}
