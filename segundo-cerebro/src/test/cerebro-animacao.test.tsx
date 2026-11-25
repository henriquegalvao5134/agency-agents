import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O cérebro lê o núcleo por estes ganchos; aqui sem login e sem atividade.
vi.mock("@/lib/cerebro/use-atividade", () => ({
  useSessao: () => ({ isLoading: false, data: { configurado: true, logado: false } }),
  useProvedores: () => ({ isLoading: false, data: [] }),
  useAtividade: () => ({ data: undefined }),
}));

const { GraphPanel } = await import("@/components/dash/GraphPanel");

// requestAnimationFrame controlado: guarda o quadro pendente e conta quantos foram pedidos.
let pendente: FrameRequestCallback | null = null;
let proximoId = 0;
const raf = vi.fn((cb: FrameRequestCallback) => {
  pendente = cb;
  return ++proximoId;
});
const caf = vi.fn((id: number) => {
  if (id === proximoId) pendente = null;
});
const quadro = () => {
  const cb = pendente;
  pendente = null;
  act(() => cb?.(performance.now()));
};

beforeEach(() => {
  pendente = null;
  proximoId = 0;
  raf.mockClear();
  caf.mockClear();
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GraphPanel: animação só enquanto o cérebro está na tela", () => {
  it("fora da tela para de pedir quadros e volta ao reaparecer", () => {
    let avisar: IntersectionObserverCallback = () => {};
    const observados: Element[] = [];
    const desligar = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          avisar = cb;
        }
        observe(el: Element) {
          observados.push(el);
        }
        disconnect() {
          desligar();
        }
      },
    );
    const entrada = (visivel: boolean) =>
      act(() =>
        avisar(
          [{ isIntersecting: visivel } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );

    const { container, unmount } = render(<GraphPanel />);
    expect(observados).toEqual([
      container.querySelector('svg[aria-label="Cérebro e entradas de IA"]'),
    ]);
    quadro();
    quadro();
    expect(raf).toHaveBeenCalledTimes(3); // o primeiro e um a cada quadro

    entrada(false);
    expect(caf).toHaveBeenCalledWith(3);
    expect(pendente).toBeNull();
    quadro(); // nada pendente: nenhum quadro novo
    expect(raf).toHaveBeenCalledTimes(3);

    entrada(true);
    expect(raf).toHaveBeenCalledTimes(4);
    entrada(true); // já animando: não dobra o laço
    expect(raf).toHaveBeenCalledTimes(4);
    quadro();
    expect(raf).toHaveBeenCalledTimes(5);

    unmount();
    expect(desligar).toHaveBeenCalled();
  });

  it("sem IntersectionObserver (navegador antigo, jsdom) segue animando", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<GraphPanel />);
    quadro();
    quadro();
    quadro();
    expect(raf).toHaveBeenCalledTimes(4);
    expect(caf).not.toHaveBeenCalled();
  });
});
