// Pure graph/geometry data model for the brain visualization. Extracted
// from GraphPanel.tsx: nothing here touches React, the DOM, or a canvas
// context -- it only computes the node graph, the cortex point cloud, and
// the 3D-to-2D projection that GraphPanel.tsx then draws.
import { agentesDoDepartamento } from "@/lib/cerebro/agentes-cliente";
import { CORE, GROUPS, REGIONS, inRegion, type RegionId } from "./brain";
import { rng } from "./panel-utils";

export type N = {
  id: number;
  g: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  bz?: number;
  d?: number;
  hub?: boolean;
  label: string;
  /** Id do agente real do catálogo (ex.: "engineering/engineering-backend-architect"); só nos neurônios de agente. */
  agenteId?: string;
};

/** Half-thickness of the brain (left↔right) at a lateral point: the profile is extruded into a 3D volume. */
export function halfW(x: number, y: number) {
  if (inRegion("brainstem", x, y)) return 16;
  if (inRegion("cerebellum", x, y))
    return 62 * Math.sqrt(Math.max(0.05, 1 - ((x - 113) / 66) ** 2 - ((y - 113) / 48) ** 2));
  return 8 + 86 * Math.sqrt(Math.max(0.04, 1 - (x / 210) ** 2 - ((y + 24) / 140) ** 2));
}

const LOBES: RegionId[] = ["frontal", "parietal", "occipital", "temporal"];
export const regionAt = (x: number, y: number): RegionId | null => {
  if (inRegion("brainstem", x, y)) return "brainstem";
  if (inRegion("cerebellum", x, y)) return "cerebellum";
  if (!LOBES.some((id) => inRegion(id, x, y))) return null;
  return LOBES.reduce((a, b) =>
    Math.hypot(x - REGIONS[a].cx, y - REGIONS[a].cy) <
    Math.hypot(x - REGIONS[b].cx, y - REGIONS[b].cy)
      ? a
      : b,
  );
};

/** Cortex: thousands of dim neurons on the brain surface. Gyri emerge where a fold field is near zero. */
export type P = { x: number; y: number; z: number; c: string; b: number };
export function buildCortex() {
  const r = rng(11);
  const pts: P[] = [];
  for (let t = 0; pts.length < 5200 && t < 120000; t++) {
    const x = -215 + r() * 430,
      y = -165 + r() * 380;
    const reg = regionAt(x, y);
    if (!reg) continue;
    const side = r() < 0.5 ? -1 : 1,
      shell = reg === "brainstem" ? r() : 0.82 + r() * 0.18;
    const z =
      side * halfW(x, y) * shell + (reg === "cerebellum" || reg === "brainstem" ? 0 : side * 4);
    const fold =
      Math.sin(x * 0.085 + Math.sin(y * 0.06 + z * 0.03) * 2.4) *
      Math.cos(y * 0.075 - z * 0.04 + Math.sin(x * 0.05));
    const ridge =
      reg === "cerebellum" ? Math.abs(Math.sin(y * 0.45 + x * 0.08)) : 1 - Math.abs(fold);
    if (ridge < 0.45 && r() < 0.8) continue;
    pts.push({ x, y, z, c: REGIONS[reg].c, b: 0.25 + ridge * 0.55 });
  }
  return pts;
}

export type Rot = { yaw: number; pitch: number };
/** Rotate around the orchestrator core, then apply a soft perspective. */
export const project = (x: number, y: number, z: number, o: Rot) => {
  const X = x - CORE.x,
    Y = y - CORE.y,
    cy = Math.cos(o.yaw),
    sy = Math.sin(o.yaw),
    cp = Math.cos(o.pitch),
    sp = Math.sin(o.pitch);
  const x1 = X * cy + z * sy,
    z1 = -X * sy + z * cy;
  const y1 = Y * cp - z1 * sp,
    z2 = Y * sp + z1 * cp;
  const s = 700 / (700 + z2);
  return { x: CORE.x + x1 * s, y: CORE.y + y1 * s, s };
};

/**
 * Hub de um departamento. Departamentos que dividem a região se espalham em volta do centro dela (o primeiro
 * acima, os outros girando), puxados para o centro até o ponto cair dentro da região.
 */
function posicaoDoHub(gi: number) {
  const g = GROUPS[gi]!;
  const R = REGIONS[g.region];
  const mesmaRegiao = GROUPS.filter((o) => o.region === g.region);
  if (mesmaRegiao.length < 2) return { x: R.cx, y: R.cy };
  const a = -Math.PI / 2 + (mesmaRegiao.indexOf(g) * 2 * Math.PI) / mesmaRegiao.length;
  for (let d = R.r * 0.4; d > 0; d -= 2) {
    const x = R.cx + Math.cos(a) * d,
      y = R.cy + Math.sin(a) * d;
    if (inRegion(g.region, x, y)) return { x, y };
  }
  return { x: R.cx, y: R.cy };
}

export function build() {
  const r = rng(7);
  const nodes: N[] = [];
  const links: [number, number][] = [];
  // Root sits at the thalamus: the relay station every signal passes through.
  nodes.push({
    id: 0,
    g: -1,
    x: 10,
    y: -30,
    vx: 0,
    vy: 0,
    tx: 10,
    ty: -30,
    bz: 0,
    hub: true,
    label: "kepano-obsidian",
  });
  GROUPS.forEach((g, gi) => {
    const R = REGIONS[g.region];
    const hub = nodes.length;
    const { x: hx, y: hy } = posicaoDoHub(gi);
    nodes.push({
      id: hub,
      g: gi,
      x: hx,
      y: hy,
      vx: 0,
      vy: 0,
      tx: hx,
      ty: hy,
      bz: (gi % 2 ? -1 : 1) * halfW(hx, hy) * 0.35,
      hub: true,
      label: g.id,
    });
    links.push([0, hub]);
    const kids: number[] = [];
    // Um neurônio por agente real do departamento, sorteado dentro da região (rejeição por inRegion).
    for (const agente of agentesDoDepartamento(g.dep)) {
      let x = 0,
        y = 0,
        t = 0;
      do {
        const a = r() * Math.PI * 2,
          d = Math.sqrt(r()) * R.r;
        x = R.cx + Math.cos(a) * d;
        y = R.cy + Math.sin(a) * d;
        t++;
      } while (!inRegion(g.region, x, y) && t < 400);
      // Sorteio sem sucesso não pode deixar o agente fora do lobo: cai no hub, que está dentro.
      if (!inRegion(g.region, x, y)) {
        x = hx;
        y = hy;
      }
      const id = nodes.length;
      nodes.push({
        id,
        g: gi,
        x,
        y,
        vx: 0,
        vy: 0,
        tx: x,
        ty: y,
        bz: (r() * 2 - 1) * halfW(x, y) * 0.8,
        label: agente.nome,
        agenteId: agente.id,
      });
      links.push([kids.length && r() < 0.6 ? kids[Math.floor(r() * kids.length)]! : hub, id]);
      kids.push(id);
    }
  });
  // Synapses: nearby neurons connect, which also wires neighbouring lobes together.
  for (let i = 1; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!,
        b = nodes[j]!;
      if (Math.hypot(a.tx - b.tx, a.ty - b.ty) < 30 && r() < 0.3) links.push([i, j]);
    }
  return { nodes, links };
}

export type Pulse = { l: number; t: number; rev: boolean; hops: number; c?: string; speed: number };
