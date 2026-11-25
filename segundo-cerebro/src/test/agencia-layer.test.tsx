import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgenciaLayer } from "@/components/dash/AgenciaLayer";
import { estadoAgencia } from "@/lib/cerebro/agencia";

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
});
