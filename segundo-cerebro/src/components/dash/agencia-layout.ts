// Medidas, em coordenadas de mundo do cérebro, da coluna da agência (à direita do cérebro, que vai
// até x ≈ 219) e das duas fileiras de skills (embaixo do cérebro, que vai até y ≈ 231).
// Ficam fora do componente para a câmera (brain-camera.ts) enquadrar exatamente o que é desenhado.

export const COLUNA_X = 300;
export const CAIXA_L = 130;
export const CAIXA_A = 28;
export const CAIXA_PASSO = 34;
export const COLUNA_CENTRO_Y = -30;
/** Distância do rótulo "AGÊNCIA GD3" (linha de base) até o topo da primeira caixa. */
export const COLUNA_ROTULO_ESPACO = 10;

/** Centro da primeira fileira de skills; a segunda fica SKILLS_LINHA_PASSO abaixo. */
export const SKILLS_Y = 258;
export const SKILLS_LINHA_PASSO = 28;
export const SKILLS_POR_LINHA = 4;
export const FICHA_L = 100;
export const FICHA_A = 22;
export const FICHA_ESPACO = 8;
/** Distância do rótulo "SKILLS" (linha de base) até o topo da primeira fileira. */
export const SKILLS_ROTULO_ESPACO = 8;

/** Altura aproximada (acima da linha de base) dos rótulos de 8px. */
const ROTULO_ALTURA = 8;

export function caixaY(i: number, n: number): number {
  return COLUNA_CENTRO_Y + (i - (n - 1) / 2) * CAIXA_PASSO;
}

/** Canto superior esquerdo da ficha i: 4 por fileira, cada fileira centrada em x = 0 (largura 424 ≈ cérebro). */
export function fichaPos(i: number, total: number): { x: number; y: number } {
  const linha = Math.floor(i / SKILLS_POR_LINHA);
  const naLinha = Math.min(SKILLS_POR_LINHA, total - linha * SKILLS_POR_LINHA);
  const largura = naLinha * FICHA_L + (naLinha - 1) * FICHA_ESPACO;
  const coluna = i % SKILLS_POR_LINHA;
  return {
    x: -largura / 2 + coluna * (FICHA_L + FICHA_ESPACO),
    y: SKILLS_Y + linha * SKILLS_LINHA_PASSO - FICHA_A / 2,
  };
}

// A linha do agente tem 130 de largura útil a 7px mono (≈ 4,2 por caractere a partir de x + 22):
// cabem ~24 caracteres, então o nome encolhe para deixar lugar ao "◉ " e ao " +N".
const NOME_MAX = 22;
const NOME_MAX_COM_MAIS = 18;

function encurtar(nome: string, max: number): string {
  return nome.length > max ? `${nome.slice(0, max - 1)}…` : nome;
}

/** Linha de baixo da caixa: total de agentes, ou o agente delegado (+N outros) cortado para caber. */
export function linhaAgentes(agentes: string[], total: number): string {
  const [primeiro] = agentes;
  if (primeiro === undefined) return `${total} agentes`;
  const mais = agentes.length - 1;
  return mais > 0
    ? `◉ ${encurtar(primeiro, NOME_MAX_COM_MAIS)} +${mais}`
    : `◉ ${encurtar(primeiro, NOME_MAX)}`;
}

export type Limites = { x0: number; x1: number; y0: number; y1: number };

/** Retângulo ocupado pela coluna da agência e pelas fileiras de skills. */
export function limitesAgencia(nDepartamentos: number, nSkills: number): Limites {
  const linhas = Math.max(1, Math.ceil(nSkills / SKILLS_POR_LINHA));
  const larguraSkills =
    Math.min(SKILLS_POR_LINHA, nSkills) * FICHA_L +
    (Math.min(SKILLS_POR_LINHA, nSkills) - 1) * FICHA_ESPACO;
  return {
    x0: Math.min(COLUNA_X, -larguraSkills / 2),
    x1: Math.max(COLUNA_X + CAIXA_L, larguraSkills / 2),
    y0: caixaY(0, nDepartamentos) - CAIXA_A / 2 - COLUNA_ROTULO_ESPACO - ROTULO_ALTURA,
    y1: SKILLS_Y + (linhas - 1) * SKILLS_LINHA_PASSO + FICHA_A / 2,
  };
}
