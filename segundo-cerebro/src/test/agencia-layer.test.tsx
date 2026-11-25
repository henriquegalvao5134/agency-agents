import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgenciaLayer } from "@/components/dash/AgenciaLayer";
import {
  COLUNA_X,
  CAIXA_L,
  FICHA_A,
  FICHA_L,
  fichaPos,
  limitesAgencia,
  linhaAgentes,
} from "@/components/dash/agencia-layout";
import { enquadrar, limitesConteudo, vistaPadrao } from "@/components/dash/brain-camera";
import { DEPARTAMENTOS, estadoAgencia, SKILLS_TRABALHO } from "@/lib/cerebro/agencia";

describe("AgenciaLayer", () => {
  it("desenha departamentos, agente delegado com +N e skills acesas", () => {
    const estado = estadoAgencia(
      {
        delegacoes: [
          {
            criado_em: new Date().toISOString(),
            ferramenta: "claude-code",
            area: "desenvolvimento",
            agentes: [
              "engineering/engineering-backend-architect",
              "engineering/engineering-frontend-developer",
            ],
          },
        ],
        salvouAgora: false,
      },
      { engineering: 66 },
    );
    const { container, getByText } = render(
      <svg>
        <AgenciaLayer estado={estado} core={{ x: 10, y: -30 }} />
      </svg>,
    );
    expect(getByText("AGÊNCIA GD3")).toBeInTheDocument();
    expect(container.querySelector('[data-departamento="dev"]')!.getAttribute("data-aceso")).toBe(
      "true",
    );
    expect(getByText("◉ Backend Architect +1")).toBeInTheDocument();
    expect(
      container.querySelector('[data-skill="brainstorming"]')!.getAttribute("data-aceso"),
    ).toBe("true");
    expect(
      container.querySelector('[data-skill="fluxo-marketing"]')!.getAttribute("data-aceso"),
    ).toBe("false");
    expect(container.querySelectorAll("[data-departamento]")).toHaveLength(10);
  });
  it("sem delegação tudo apagado: caixas com '<total> agentes' e nenhuma skill acesa", () => {
    const estado = estadoAgencia(undefined, { engineering: 66, marketing: 37 });
    const { container, getByText } = render(
      <svg>
        <AgenciaLayer estado={estado} core={{ x: 10, y: -30 }} />
      </svg>,
    );
    const acesos = [...container.querySelectorAll("[data-aceso]")].map((el) =>
      el.getAttribute("data-aceso"),
    );
    expect(acesos).toHaveLength(DEPARTAMENTOS.length + SKILLS_TRABALHO.length);
    expect(acesos.every((a) => a === "false")).toBe(true);
    expect(getByText("66 agentes")).toBeInTheDocument();
    expect(getByText("37 agentes")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-skill]")).toHaveLength(8);
  });
});

describe("medidas da agência", () => {
  it("nome do agente encolhe para caber na caixa, menos quando há +N", () => {
    const longo = "Engenheiro De Confiabilidade Total";
    expect(linhaAgentes([longo], 9)).toBe("◉ Engenheiro De Confiab…");
    expect(linhaAgentes([longo, "B", "C"], 9)).toBe("◉ Engenheiro De Con… +2");
    expect(linhaAgentes(["Curto", "B"], 9)).toBe("◉ Curto +1");
    expect(linhaAgentes([], 9)).toBe("9 agentes");
    // 7px mono ≈ 4,2 por caractere, a partir de x + 22: tudo dentro da caixa de 130.
    for (const linha of [linhaAgentes([longo], 9), linhaAgentes([longo, "B", "C"], 9)])
      expect(22 + linha.length * 4.2).toBeLessThanOrEqual(CAIXA_L);
  });
  it("skills em 2 fileiras de 4, dentro da largura do cérebro (±216)", () => {
    const pos = SKILLS_TRABALHO.map((_, i) => fichaPos(i, SKILLS_TRABALHO.length));
    expect(new Set(pos.map((p) => p.y)).size).toBe(2);
    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(-216);
      expect(p.x + FICHA_L).toBeLessThanOrEqual(216);
    }
    const [a, b] = [pos[0]!, pos[4]!];
    expect(b.y - a.y).toBeGreaterThan(FICHA_A);
  });
  it("vista padrão enquadra entradas de IA, cérebro, agência e skills inteiros", () => {
    const lim = limitesConteudo(2);
    const agencia = limitesAgencia(DEPARTAMENTOS.length, SKILLS_TRABALHO.length);
    expect(lim.x1).toBeGreaterThanOrEqual(COLUNA_X + CAIXA_L);
    expect(lim.y1).toBeGreaterThanOrEqual(agencia.y1);
    expect(lim.y0).toBeLessThanOrEqual(agencia.y0);
    // Tamanhos do SVG medidos no navegador: celular 390, desktop 1280 e 1440.
    for (const [w, h] of [
      [356, 640],
      [830, 744],
      [990, 744],
    ] as const) {
      const v = vistaPadrao(w, h, 2);
      const tela = (x: number, y: number) => ({
        x: w / 2 + v.x + v.k * x,
        y: h / 2 + v.y + v.k * y,
      });
      const a = tela(lim.x0, lim.y0);
      const b = tela(lim.x1, lim.y1);
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(w);
      expect(a.y).toBeGreaterThanOrEqual(44); // abaixo da barra de botões
      expect(b.y).toBeLessThanOrEqual(h);
    }
    expect(enquadrar(2000, 2000, lim).k).toBe(1.3);
  });
});
