import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  departamentoDe,
  estadoAgencia,
  FLUXO_DESENVOLVIMENTO,
  rotuloOrquestrador,
  SKILLS_TRABALHO,
} from "@/lib/cerebro/agencia";
import catalogo from "@/lib/cerebro/catalogo.json";
import divisoesReais from "@/lib/cerebro/divisoes.json";

const agora = new Date("2026-11-25T12:00:00Z");
const deleg = (min: number, area: string, agentes: string[], nomes: string[] = []) => ({
  criado_em: new Date(agora.getTime() - min * 60_000).toISOString(),
  ferramenta: "claude-code",
  area,
  agentes,
  nomes,
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
      "requesting-code-review",
      "finishing-a-development-branch",
    ]);
    expect(e.skillsAcesas).not.toContain("systematic-debugging");
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
  it("usa o nome real gravado pelo servidor e cai no nome derivado do id quando falta", () => {
    const e = estadoAgencia(
      {
        delegacoes: [
          deleg(
            1,
            "desenvolvimento",
            ["engineering/engineering-backend-architect", "engineering/engineering-sre"],
            ["Arquiteto de Back-end", ""],
          ),
        ],
        salvouAgora: false,
      },
      divisoes,
      agora,
    );
    expect(e.departamentos.find((d) => d.id === "dev")!.agentes).toEqual([
      "Arquiteto de Back-end",
      "Sre",
    ]);
  });
  it("idade negativa (relógio do navegador atrás do servidor) não deixa o orquestrador delegando", () => {
    const futura = { ...deleg(0, "marketing", []), criado_em: "2026-11-25T12:05:00Z" };
    expect(
      estadoAgencia({ delegacoes: [futura], salvouAgora: false }, divisoes, agora)
        .orquestradorAtivo,
    ).toBe(false);
    expect(
      estadoAgencia(
        { delegacoes: [deleg(0, "marketing", [])], salvouAgora: false },
        divisoes,
        agora,
      ).orquestradorAtivo,
    ).toBe(true);
  });
});

describe("rotuloOrquestrador", () => {
  const base = { carregando: false, logado: true, nome: undefined, ativo: false };
  it("diz a verdade em cada estado", () => {
    expect(rotuloOrquestrador({ ...base, logado: false })).toBe("ORQUESTRADOR · entre para ver");
    expect(rotuloOrquestrador({ ...base, carregando: true })).toBe("ORQUESTRADOR · …");
    expect(rotuloOrquestrador(base)).toBe("ORQUESTRADOR · sem IA no cofre");
    expect(rotuloOrquestrador({ ...base, nome: "Haiku" })).toBe("ORQUESTRADOR · Haiku");
    expect(rotuloOrquestrador({ ...base, nome: "Haiku", ativo: true })).toBe(
      "ORQUESTRADOR · Haiku · delegando",
    );
  });
  it("encurta nome comprido para 24 caracteres com reticências", () => {
    const r = rotuloOrquestrador({ ...base, nome: "Um nome de IA muito comprido demais mesmo" });
    expect(r).toBe("ORQUESTRADOR · Um nome de IA muito com…");
    expect(r.slice("ORQUESTRADOR · ".length)).toHaveLength(24);
  });
});

describe("dados da agência sem deriva", () => {
  it("divisoes.json é a contagem por divisão do catalogo.json", () => {
    const contagem: Record<string, number> = {};
    for (const a of catalogo as { divisao: string }[])
      contagem[a.divisao] = (contagem[a.divisao] ?? 0) + 1;
    expect(divisoesReais).toEqual(contagem);
  });
  it("as fichas superpowers são exatamente o FLUXO de desenvolvimento do orquestrador", () => {
    const fonte = readFileSync("src/lib/cerebro/orquestrador.server.ts", "utf8");
    const inicio = fonte.indexOf("desenvolvimento: [", fonte.indexOf("const FLUXO"));
    const bloco = fonte.slice(inicio, fonte.indexOf("marketing: [", inicio));
    const doFluxo = [...bloco.matchAll(/superpowers:([a-z-]+)/g)].map((m) => m[1]);
    expect(doFluxo).toEqual([...FLUXO_DESENVOLVIMENTO]);
    expect(SKILLS_TRABALHO.filter((s) => s.grupo === "superpowers").map((s) => s.id)).toEqual([
      ...FLUXO_DESENVOLVIMENTO,
    ]);
  });
});
