import { describe, expect, it } from "vitest";
import { departamentoDe, estadoAgencia } from "@/lib/cerebro/agencia";

const agora = new Date("2026-11-25T12:00:00Z");
const deleg = (min: number, area: string, agentes: string[]) => ({
  criado_em: new Date(agora.getTime() - min * 60_000).toISOString(),
  ferramenta: "claude-code",
  area,
  agentes,
});
const divisoes = {
  engineering: 66,
  marketing: 37,
  "paid-media": 7,
  sales: 9,
  support: 6,
  academic: 6,
};

describe("estadoAgencia", () => {
  it("sem login tudo apagado com contagens reais", () => {
    const e = estadoAgencia(undefined, divisoes, agora);
    expect(e.departamentos.find((d) => d.id === "dev")).toMatchObject({
      total: 66,
      aceso: false,
      agentes: [],
    });
    expect(e.departamentos.find((d) => d.id === "vendas")!.total).toBe(15);
    expect(e.departamentos.find((d) => d.id === "especialistas")!.total).toBe(6);
    expect(e.skillsAcesas).toEqual([]);
    expect(e.orquestradorAtivo).toBe(false);
  });
  it("delegação de desenvolvimento acende o departamento, o orquestrador e as skills superpowers", () => {
    const e = estadoAgencia(
      {
        delegacoes: [deleg(1, "desenvolvimento", ["engineering/engineering-backend-architect"])],
        salvouAgora: false,
      },
      divisoes,
      agora,
    );
    expect(e.departamentos.find((d) => d.id === "dev")).toMatchObject({
      aceso: true,
      agentes: ["Backend Architect"],
    });
    expect(e.orquestradorAtivo).toBe(true);
    expect(e.skillsAcesas).toEqual([
      "brainstorming",
      "writing-plans",
      "subagent-driven-development",
      "test-driven-development",
      "systematic-debugging",
      "requesting-code-review",
    ]);
  });
  it("marketing acende o fluxo de marketing; ficha salva acende salvar-no-cerebro", () => {
    const e = estadoAgencia(
      {
        delegacoes: [deleg(1, "marketing", ["paid-media/paid-media-ppc-strategist"])],
        salvouAgora: true,
      },
      divisoes,
      agora,
    );
    expect(e.skillsAcesas).toEqual(["fluxo-marketing", "salvar-no-cerebro"]);
    expect(e.departamentos.find((d) => d.id === "midia")!.agentes).toEqual(["Ppc Strategist"]);
  });
  it("divisão desconhecida vai para Especialistas; delegação antiga não ativa o orquestrador; meta vazia não acende nada", () => {
    expect(departamentoDe("outra/x")).toBe("especialistas");
    const e = estadoAgencia(
      {
        delegacoes: [
          deleg(5, "estrategia", ["outra/outra-coisa"]),
          deleg(6, "desenvolvimento", []),
        ],
        salvouAgora: false,
      },
      divisoes,
      agora,
    );
    expect(e.orquestradorAtivo).toBe(false);
    expect(e.departamentos.find((d) => d.id === "especialistas")!.agentes).toEqual(["Coisa"]);
    expect(e.departamentos.filter((d) => d.aceso).map((d) => d.id)).toEqual(["especialistas"]);
  });
});
