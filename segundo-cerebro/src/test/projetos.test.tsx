import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjetosPanel } from "@/components/dash/ProjetosPanel";
import { comandoContinuar, haQuantoTempo, precisaTrocar } from "@/lib/cerebro/continuar";

const json = (corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status: 200 }));

function montar(opcoes: { logado?: boolean; limite5h?: number } = {}) {
  const { logado = true, limite5h = 90 } = opcoes;
  const fichas = [
    {
      projeto: "crm-x",
      titulo: "CRM do cliente X",
      etapa_atual: "Telas de login",
      proximo_passo: "",
      atualizado_por: "claude-code",
      atualizado_em: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/sessao")) return json({ configurado: true, logado });
      if (url.endsWith("/fichas")) return json(fichas);
      if (url.endsWith("/atividade"))
        return json({
          ativos: [],
          delegacoes: [],
          limites: { limite_5h_pct: limite5h, limite_7d_pct: null, em: "x" },
        });
      return json({});
    }),
  );
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProjetosPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("continuar", () => {
  it("monta o comando de retomada", () => {
    expect(comandoContinuar("codex", "crm-x")).toBe(
      'Use o MCP "cerebro": chame ler_ficha com o projeto "crm-x", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "codex") ao fim de cada etapa.',
    );
  });
  it("precisaTrocar com 85% ou mais", () => {
    expect(precisaTrocar({ limite_5h_pct: 86, limite_7d_pct: 10, em: "x" })).toBe(true);
    expect(precisaTrocar({ limite_5h_pct: 50, limite_7d_pct: 85, em: "x" })).toBe(true);
    expect(precisaTrocar({ limite_5h_pct: 50, limite_7d_pct: null, em: "x" })).toBe(false);
  });
  it("tempo relativo", () => {
    const agora = Date.parse("2026-11-24T12:00:00Z");
    const antes = (ms: number) => new Date(agora - ms).toISOString();
    expect(haQuantoTempo(antes(10_000), agora)).toBe("agora há pouco");
    expect(haQuantoTempo(antes(5 * 60_000), agora)).toBe("há 5 min");
    expect(haQuantoTempo(antes(2 * 3600_000), agora)).toBe("há 2 h");
    expect(haQuantoTempo(antes(3 * 86400_000), agora)).toBe("há 3 dias");
    expect(haQuantoTempo(antes(86400_000), agora)).toBe("há 1 dia");
    expect(haQuantoTempo("lixo", agora)).toBe("");
  });
});

describe("ProjetosPanel", () => {
  it("mostra o cartão, o aviso de limite e o comando da aba Codex", async () => {
    const { container } = montar();
    await waitFor(() => expect(container.querySelector('[data-projeto="crm-x"]')).not.toBeNull());
    expect(screen.getByText("Próximo passo: não informado")).toBeInTheDocument();
    expect(screen.getByText("Etapa: Telas de login")).toBeInTheDocument();
    expect(screen.getByText(/Salvo por claude-code há 5 min/)).toBeInTheDocument();
    expect(await screen.findByText(/Seu limite do Claude está em 90%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar em outra IA" }));
    fireEvent.click(screen.getByRole("tab", { name: "Codex" }));
    expect(screen.getByText(comandoContinuar("codex", "crm-x"))).toBeInTheDocument();
  });

  it("não aparece sem login", async () => {
    const { container } = montar({ logado: false });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
