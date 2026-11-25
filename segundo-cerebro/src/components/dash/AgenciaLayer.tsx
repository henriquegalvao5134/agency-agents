import type { JSX } from "react";

import { SKILLS_TRABALHO, type EstadoAgencia } from "@/lib/cerebro/agencia";
import {
  CAIXA_A,
  CAIXA_L,
  COLUNA_ROTULO_ESPACO,
  COLUNA_X,
  FICHA_A,
  FICHA_L,
  SKILLS_ROTULO_ESPACO,
  SKILLS_Y,
  caixaY as caixaYDe,
  fichaPos,
  linhaAgentes,
} from "./agencia-layout";
import { fx } from "./panel-utils";

/** Orquestrador → departamentos da agência (à direita) e skills de trabalho (embaixo), em coordenadas de mundo. */
export function AgenciaLayer({
  estado,
  core,
}: {
  estado: EstadoAgencia;
  core: { x: number; y: number };
}): JSX.Element {
  const n = estado.departamentos.length;
  const caixaY = (i: number) => caixaYDe(i, n);
  const acesas = new Set(estado.skillsAcesas);

  return (
    <g data-agencia pointerEvents="none">
      <text
        x={COLUNA_X + CAIXA_L / 2}
        y={caixaY(0) - CAIXA_A / 2 - COLUNA_ROTULO_ESPACO}
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
        y={SKILLS_Y - FICHA_A / 2 - SKILLS_ROTULO_ESPACO}
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
        const { x, y } = fichaPos(i, SKILLS_TRABALHO.length);
        return (
          <g key={s.id} data-skill={s.id} data-aceso={String(acesa)}>
            <rect
              x={x}
              y={y}
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
              y={y + FICHA_A / 2 + 3}
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
