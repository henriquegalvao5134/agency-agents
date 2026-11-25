import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjetosPanel } from "@/components/dash/ProjetosPanel";
import {
  comandoContinuar,
  haQuantoTempo,
  ligarFerramenta,
  maiorLimite,
  precisaTrocar,
  quandoLido,
} from "@/lib/cerebro/continuar";

const json = (corpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status }));

const HORA = 3600_000;

function montar(
  opcoes: { logado?: boolean; limite5h?: number; lidoHa?: number; fichasFalham?: boolean } = {},
) {
  const { logado = true, limite5h = 90, lidoHa = 10 * 60_000, fichasFalham = false } = opcoes;
  const em = new Date(Date.now() - lidoHa).toISOString();
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
      if (url.endsWith("/fichas"))
        return fichasFalham ? json({ erro: "Erro 500" }, 500) : json(fichas);
      if (url.endsWith("/atividade"))
        return json({
          ativos: [],
          delegacoes: [],
          limites: { limite_5h_pct: limite5h, limite_7d_pct: null, em },
        });
      return json({});
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    em,
    ...render(
      <QueryClientProvider client={client}>
        <ProjetosPanel />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("continuar", () => {
  it("monta o comando de retomada", () => {
    expect(comandoContinuar("codex", "crm-x")).toBe(
      'Use o MCP "cerebro": chame ler_ficha com o projeto "crm-x", continue a partir do próximo passo e salve a ficha com salvar_ficha (atualizado_por: "codex") ao fim de cada etapa.',
    );
  });
  it("cada ferramenta tem o seu jeito de ligar ao cérebro (sem expor o token)", () => {
    const site = "https://cerebro.exemplo";
    expect(ligarFerramenta("claude-code", site).comando).toBe(
      'claude mcp add --scope user --transport http cerebro https://cerebro.exemplo/api/mcp --header "Authorization: Bearer SEU_TOKEN"',
    );
    expect(ligarFerramenta("claude-app", site).comando).toBe(
      "https://cerebro.exemplo/api/mcp/SEU_TOKEN",
    );
    expect(ligarFerramenta("codex", site).comando).toBe(
      'setx CEREBRO_TOKEN "SEU_TOKEN"\ncodex mcp add cerebro --url https://cerebro.exemplo/api/mcp --bearer-token-env-var CEREBRO_TOKEN',
    );
    expect(ligarFerramenta("gemini", site).comando).toBe(
      'gemini mcp add -s user --transport http --header "Authorization: Bearer SEU_TOKEN" cerebro https://cerebro.exemplo/api/mcp',
    );
    const comandos = (["claude-code", "claude-app", "codex", "gemini"] as const).map(
      (f) => ligarFerramenta(f, site).comando,
    );
    expect(new Set(comandos).size).toBe(4);
    for (const f of ["claude-code", "claude-app", "codex", "gemini"] as const)
      expect(ligarFerramenta(f, site).como.length).toBeGreaterThan(20);
  });
  it("precisaTrocar com 85% ou mais", () => {
    const agora = Date.parse("2026-11-24T12:00:00Z");
    const em = new Date(agora - 10 * 60_000).toISOString();
    expect(precisaTrocar({ limite_5h_pct: 86, limite_7d_pct: 10, em }, agora)).toBe(true);
    expect(precisaTrocar({ limite_5h_pct: 50, limite_7d_pct: 85, em }, agora)).toBe(true);
    expect(precisaTrocar({ limite_5h_pct: 50, limite_7d_pct: null, em }, agora)).toBe(false);
  });
  it("ignora leitura velha: 5h depois de 5 h, semanal depois de 7 dias, e leitura sem data", () => {
    const agora = Date.parse("2026-11-24T12:00:00Z");
    const ha = (ms: number) => new Date(agora - ms).toISOString();
    // 5h lido há 6 h: a janela já virou, não avisa
    expect(precisaTrocar({ limite_5h_pct: 95, limite_7d_pct: null, em: ha(6 * HORA) }, agora)).toBe(
      false,
    );
    // ainda dentro das 5 h: avisa
    expect(
      precisaTrocar({ limite_5h_pct: 95, limite_7d_pct: null, em: ha(4.9 * HORA) }, agora),
    ).toBe(true);
    // semanal lido há 6 h ainda vale; o de 5h da mesma leitura não
    expect(maiorLimite({ limite_5h_pct: 99, limite_7d_pct: 88, em: ha(6 * HORA) }, agora)).toBe(88);
    // semanal lido há 8 dias: não vale mais
    expect(
      precisaTrocar({ limite_5h_pct: null, limite_7d_pct: 95, em: ha(8 * 24 * HORA) }, agora),
    ).toBe(false);
    expect(precisaTrocar({ limite_5h_pct: 95, limite_7d_pct: 95, em: null }, agora)).toBe(false);
    expect(precisaTrocar({ limite_5h_pct: 95, limite_7d_pct: 95, em: "x" }, agora)).toBe(false);
  });
  it("quandoLido: hora de hoje ou dia e hora", () => {
    const agora = new Date(2026, 10, 24, 18, 0).getTime();
    expect(quandoLido(new Date(2026, 10, 24, 9, 5).toISOString(), agora)).toBe("às 09:05");
    expect(quandoLido(new Date(2026, 10, 22, 14, 30).toISOString(), agora)).toBe(
      "em 22/11 às 14:30",
    );
    expect(quandoLido(null, agora)).toBe("");
    expect(quandoLido("lixo", agora)).toBe("");
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
  it("mostra o cartão, o aviso de limite com a hora da leitura e já abre na aba Codex", async () => {
    const { container, em } = montar();
    await waitFor(() => expect(container.querySelector('[data-projeto="crm-x"]')).not.toBeNull());
    expect(screen.getByText("Próximo passo: não informado")).toBeInTheDocument();
    expect(screen.getByText("Etapa: Telas de login")).toBeInTheDocument();
    expect(screen.getByText(/Salvo por claude-code há 5 min/)).toBeInTheDocument();
    const aviso = await screen.findByText(/Seu limite do Claude está em 90%/);
    expect(aviso.textContent).toBe(
      `Seu limite do Claude está em 90% — salve e continue no Codex ou no Gemini. (lido ${quandoLido(em)})`,
    );
    // logo depois da meia-noite a leitura de 10 min atrás é de ontem: aí vem com o dia
    expect(aviso.textContent).toMatch(/\(lido (em \d{2}\/\d{2} )?às \d{2}:\d{2}\)$/);
    fireEvent.click(screen.getByRole("button", { name: "Continuar em outra IA" }));
    // limite alto: a troca já abre no Codex
    expect(screen.getByRole("tab", { name: "Codex" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(comandoContinuar("codex", "crm-x"))).toBeInTheDocument();
    expect(screen.getByText(/codex mcp add cerebro/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Gemini" }));
    expect(screen.getByText(comandoContinuar("gemini", "crm-x"))).toBeInTheDocument();
    // trocar de aba troca o passo de ligar: não é o mesmo texto em todas
    expect(screen.getByText(/gemini mcp add/)).toBeInTheDocument();
    expect(screen.queryByText(/codex mcp add cerebro/)).toBeNull();
    // outro Claude (site, app ou outra conta) entra por conector com o endereço do cérebro
    fireEvent.click(screen.getByRole("tab", { name: "Claude (site/app)" }));
    expect(screen.getByText(/\/api\/mcp\/SEU_TOKEN$/)).toBeInTheDocument();
    expect(screen.getByText(/Conectores/)).toBeInTheDocument();
  });

  it("limite lido há mais de 5 h não avisa e a troca abre no Claude Code", async () => {
    const { container, client } = montar({ limite5h: 95, lidoHa: 6 * HORA });
    await waitFor(() => expect(container.querySelector('[data-projeto="crm-x"]')).not.toBeNull());
    // a leitura de 95% já chegou ao painel; só é velha demais para contar
    await waitFor(() => expect(client.getQueryData(["painel", "atividade"])).toBeDefined());
    expect(screen.queryByText(/Seu limite do Claude/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continuar em outra IA" }));
    expect(screen.getByRole("tab", { name: "Claude Code" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(comandoContinuar("claude-code", "crm-x"))).toBeInTheDocument();
  });

  it("erro ao carregar as fichas mostra o aviso de erro, não 'nenhum projeto'", async () => {
    montar({ fichasFalham: true });
    expect(
      await screen.findByText(
        "Não foi possível carregar os projetos. Recarregue a página ou entre de novo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum projeto com ficha ainda/)).toBeNull();
  });

  it("não aparece sem login", async () => {
    const { container, client } = montar({ logado: false });
    // espera a sessão responder (logado: false) antes de olhar a tela
    await waitFor(() =>
      expect(client.getQueryData(["painel", "sessao"])).toEqual({
        configurado: true,
        logado: false,
      }),
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalledWith("/api/painel/fichas", expect.anything());
  });
});
