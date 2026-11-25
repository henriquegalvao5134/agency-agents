import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Atividade } from "@/lib/cerebro/types";

// O cérebro lê o registro do núcleo por useAtividade; aqui ele devolve delegações fixas.
let delegacoes: Atividade["delegacoes"] | undefined;
vi.mock("@/lib/cerebro/use-atividade", () => ({
  useSessao: () => ({ isLoading: false, data: { configurado: true, logado: true } }),
  useProvedores: () => ({ isLoading: false, data: [] }),
  useAtividade: () => ({
    data: delegacoes ? { ativos: [], delegacoes, salvouAgora: false } : undefined,
  }),
}));

const { GraphPanel } = await import("@/components/dash/GraphPanel");

beforeAll(() => {
  // jsdom não tem ResizeObserver nem canvas 2D: o cérebro só precisa que existam.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const ctx = new Proxy({}, { get: () => () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => {
  delegacoes = undefined;
});

const deleg = (agentes: string[]) => ({
  criado_em: new Date().toISOString(),
  ferramenta: "claude-code",
  area: "desenvolvimento",
  agentes,
  nomes: [],
});

describe("GraphPanel: agentes delegados acendem dentro do lobo", () => {
  it("o agente delegado ganha anel pulsando na cor do departamento e o nome; os outros não", () => {
    delegacoes = [deleg(["engineering/engineering-backend-architect"]), deleg([])];
    const { container } = render(<GraphPanel />);
    const acesos = container.querySelectorAll("[data-agente-aceso]");
    expect(acesos).toHaveLength(1);
    const aceso = acesos[0]!;
    expect(aceso.getAttribute("data-agente-aceso")).toBe(
      "engineering/engineering-backend-architect",
    );
    expect(aceso.querySelector('animate[attributeName="r"]')).not.toBeNull();
    expect(aceso.querySelector("circle")!.getAttribute("stroke")).toBe("var(--fx-blue)");
    expect(aceso.textContent).toBe("Backend Architect");
    // o nome fica abaixo do anel (raio até 9), longe do rótulo do hub do departamento (acima, y -11)
    const nome = Number(aceso.querySelector("text")!.getAttribute("y"));
    expect(nome).toBeGreaterThan(9);
    // rótulo do hub: texto sem x, dentro do neurônio (a coluna da agência também escreve "Desenvolvimento", com x)
    const rotulosHub = [...container.querySelectorAll("text")].filter(
      (t) =>
        t.textContent === "Desenvolvimento" &&
        !t.hasAttribute("x") &&
        t.closest("[data-agente-aceso]") === null,
    );
    expect(rotulosHub).toHaveLength(1);
    expect(Number(rotulosHub[0]!.getAttribute("y"))).toBeLessThan(0);
  });

  it("sem delegação (ou sem login) nenhum neurônio acende", () => {
    const { container } = render(<GraphPanel />);
    expect(container.querySelectorAll("[data-agente-aceso]")).toHaveLength(0);
  });

  it("clicar no neurônio do agente mostra nome, departamento e região, sem texto de nota", () => {
    delegacoes = [deleg(["engineering/engineering-backend-architect"])];
    const { container } = render(<GraphPanel />);
    const aceso = container.querySelector("[data-agente-aceso]")!;
    const neuronio = [
      ...container.querySelectorAll(`g[transform="${aceso.getAttribute("transform")}"]`),
    ].find((g) => !g.hasAttribute("data-agente-aceso"))!;
    fireEvent.pointerDown(neuronio);
    const detalhe = container.querySelector("[data-detalhe-no]") as HTMLElement;
    expect(within(detalhe).getByText("Backend Architect")).toBeInTheDocument();
    expect(within(detalhe).getByText("Departamento: Desenvolvimento")).toBeInTheDocument();
    expect(within(detalhe).getByText("Região: Lobo parietal")).toBeInTheDocument();
    expect(detalhe.textContent).not.toMatch(/\.md|Backlinks|\[\[|2026-11-20/);
  });

  it("a legenda lista os departamentos com região e número de agentes", () => {
    const { getByText, queryByText, container } = render(<GraphPanel />);
    expect(getByText("Departamentos → lobos")).toBeInTheDocument();
    expect(queryByText(/Pastas do vault/)).toBeNull();
    expect(getByText("● Desenvolvimento")).toBeInTheDocument();
    expect(getByText("Parietal · 66 agentes")).toBeInTheDocument();
    expect(getByText("Tronco cerebral · 12 agentes")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/desenvolvimento\//);
  });

  it("o cartão do orquestrador fala da agência, não do vault", () => {
    const { getByText, container } = render(<GraphPanel />);
    expect(
      getByText(
        "Toda IA lê primeiro este arquivo central, assim entende a agência sem gastar milhões de tokens.",
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/vault/i);
  });
});
