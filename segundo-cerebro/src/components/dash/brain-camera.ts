import { DEPARTAMENTOS, SKILLS_TRABALHO } from "@/lib/cerebro/agencia";

import { limitesAgencia, type Limites } from "./agencia-layout";
import { BRAIN_IMG, PORT_X, portY } from "./brain";

/** Folga em volta do conteúdo, em unidades de mundo (rótulos e brilho neon passam um pouco das caixas). */
const MARGEM_MUNDO = 12;
/** Espaço em pixels nas bordas do SVG; em cima reserva a barra de botões (girar, mover, restaurar). */
const BORDA_PX = 12;
const TOPO_PX = 56;
const ZOOM_MAX = 1.3;

/**
 * Tudo o que aparece na vista padrão: entradas de IA à esquerda (caixas de PORT_X − 40 a PORT_X + 70, rótulo
 * "ENTRADAS DE IA" acima e "+ Adicionar IA" abaixo), o cérebro (BRAIN_IMG), a coluna da agência e as skills.
 */
export function limitesConteudo(nAgentes: number): Limites {
  const n = Math.max(1, nAgentes);
  const portas: Limites = {
    x0: PORT_X - 40,
    x1: PORT_X + 70,
    y0: portY(0, n) - 26 - 8,
    y1: portY(n - 1, n) + 48,
  };
  const cerebro: Limites = {
    x0: BRAIN_IMG.x,
    x1: BRAIN_IMG.x + BRAIN_IMG.w,
    y0: BRAIN_IMG.y,
    y1: BRAIN_IMG.y + BRAIN_IMG.h,
  };
  const agencia = limitesAgencia(DEPARTAMENTOS.length, SKILLS_TRABALHO.length);
  const partes = [portas, cerebro, agencia];
  return {
    x0: Math.min(...partes.map((p) => p.x0)) - MARGEM_MUNDO,
    x1: Math.max(...partes.map((p) => p.x1)) + MARGEM_MUNDO,
    y0: Math.min(...partes.map((p) => p.y0)) - MARGEM_MUNDO,
    y1: Math.max(...partes.map((p) => p.y1)) + MARGEM_MUNDO,
  };
}

/**
 * Câmera que cabe os limites inteiros num SVG largura × altura (px) e os centraliza.
 * A cena é desenhada com translate(largura/2 + x, altura/2 + y) scale(k).
 */
export function enquadrar(
  largura: number,
  altura: number,
  limites: Limites,
): { x: number; y: number; k: number } {
  const lw = limites.x1 - limites.x0;
  const lh = limites.y1 - limites.y0;
  const k = Math.max(
    0.1,
    Math.min(ZOOM_MAX, (largura - 2 * BORDA_PX) / lw, (altura - TOPO_PX - BORDA_PX) / lh),
  );
  const cx = (limites.x0 + limites.x1) / 2;
  const cy = (limites.y0 + limites.y1) / 2;
  // O centro da área útil fica (TOPO_PX − BORDA_PX)/2 abaixo do centro do SVG.
  return { x: -k * cx, y: (TOPO_PX - BORDA_PX) / 2 - k * cy, k };
}

/** Vista padrão (primeira abertura e botão "Restaurar vista") para um SVG desse tamanho. */
export function vistaPadrao(
  largura: number,
  altura: number,
  nAgentes: number,
): { x: number; y: number; k: number } {
  return enquadrar(largura, altura, limitesConteudo(nAgentes));
}
