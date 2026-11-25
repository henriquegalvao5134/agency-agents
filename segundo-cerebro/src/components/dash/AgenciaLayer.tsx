import type { JSX } from "react";

import { SKILLS_TRABALHO, type EstadoAgencia } from "@/lib/cerebro/agencia";
import { fx } from "./panel-utils";

// Coluna da agência à direita do cérebro (que vai até x ≈ 220) e fileira de skills abaixo dele (y ≈ 215).
const COLUNA_X = 300;
const CAIXA_L = 130;
const CAIXA_A = 28;
const CAIXA_PASSO = 34;
const COLUNA_CENTRO_Y = -30;
const SKILLS_Y = 265;
const FICHA_L = 100;
const FICHA_A = 22;
const FICHA_ESPACO = 8;
const NOME_MAX = 22;

function encurtar(nome: string): string {
  return nome.length > NOME_MAX ? `${nome.slice(0, NOME_MAX - 1)}…` : nome;
}

function linhaAgentes(agentes: string[], total: number): string {
  const [primeiro] = agentes;
  if (primeiro === undefined) return `${total} agentes`;
  const mais = agentes.length - 1;
  return `◉ ${encurtar(primeiro)}${mais > 0 ? ` +${mais}` : ""}`;
}

/** Orquestrador → departamentos da agência (à direita) e skills de trabalho (embaixo), em coordenadas de mundo. */
export function AgenciaLayer({
  estado,
  core,
}: {
  estado: EstadoAgencia;
  core: { x: number; y: number };
}): JSX.Element {
  const n = estado.departamentos.length;
  const caixaY = (i: number) => COLUNA_CENTRO_Y + (i - (n - 1) / 2) * CAIXA_PASSO;
  const larguraSkills =
    SKILLS_TRABALHO.length * FICHA_L + (SKILLS_TRABALHO.length - 1) * FICHA_ESPACO;
  const skillsX0 = -larguraSkills / 2;
  const acesas = new Set(estado.skillsAcesas);

  return (
    <g data-agencia pointerEvents="none">
      <text
        x={COLUNA_X + CAIXA_L / 2}
        y={caixaY(0) - CAIXA_A / 2 - 10}
        fontSize={8}
        fontWeight={600}
        letterSpacing={1.5}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fill={fx("500")}
      >
        AGÊNCIA GD3
      </text>
      {estado.departamentos.map((d, i) => {
        const cy = caixaY(i);
        const cor = d.aceso ? fx(d.cor) : fx("700");
        const fio = `M${core.x},${core.y} C${core.x + 120},${core.y} ${COLUNA_X - 80},${cy} ${COLUNA_X},${cy}`;
        return (
          <g key={d.id} data-departamento={d.id} data-aceso={String(d.aceso)}>
            <path
              d={fio}
              fill="none"
              stroke={cor}
              strokeWidth={d.aceso ? 1.6 : 0.8}
              strokeOpacity={d.aceso ? 1 : 0.4}
              strokeDasharray={d.aceso ? "2 3" : undefined}
              className={d.aceso ? "wire-flow" : undefined}
            />
            <rect
              x={COLUNA_X}
              y={cy - CAIXA_A / 2}
              width={CAIXA_L}
              height={CAIXA_A}
              rx={6}
              fill={fx("950")}
              stroke={cor}
              strokeWidth={d.aceso ? 1.6 : 1}
              filter={d.aceso ? "url(#neon)" : undefined}
            />
            <circle cx={COLUNA_X + 12} cy={cy} r={3.5} fill={d.aceso ? fx(d.cor) : fx("600")} />
            <text
              x={COLUNA_X + 22}
              y={cy - 2}
              fontSize={9}
              fontWeight={600}
              fontFamily="var(--font-sans)"
              fill={fx(d.aceso ? "paper" : "300")}
            >
              {d.rotulo}
            </text>
            <text
              x={COLUNA_X + 22}
              y={cy + 8}
              fontSize={7}
              fontFamily="var(--font-mono)"
              fill={fx(d.aceso ? d.cor : "500")}
            >
              {linhaAgentes(d.agentes, d.total)}
            </text>
          </g>
        );
      })}
      <text
        x={0}
        y={SKILLS_Y - FICHA_A / 2 - 8}
        fontSize={8}
        fontWeight={600}
        letterSpacing={1.5}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fill={fx("500")}
      >
        SKILLS
      </text>
      {SKILLS_TRABALHO.map((s, i) => {
        const acesa = acesas.has(s.id);
        const x = skillsX0 + i * (FICHA_L + FICHA_ESPACO);
        return (
          <g key={s.id} data-skill={s.id} data-aceso={String(acesa)}>
            <rect
              x={x}
              y={SKILLS_Y - FICHA_A / 2}
              width={FICHA_L}
              height={FICHA_A}
              rx={FICHA_A / 2}
              fill={fx("950")}
              stroke={fx(acesa ? "cyan" : "700")}
              strokeWidth={acesa ? 1.4 : 1}
              filter={acesa ? "url(#neon)" : undefined}
            />
            <text
              x={x + FICHA_L / 2}
              y={SKILLS_Y + 3}
              fontSize={8}
              fontWeight={600}
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fill={fx(acesa ? "paper" : "500")}
            >
              {s.rotulo}
            </text>
          </g>
        );
      })}
    </g>
  );
}
