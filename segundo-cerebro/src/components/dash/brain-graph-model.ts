// Pure graph/geometry data model for the brain visualization. Extracted
// from GraphPanel.tsx: nothing here touches React, the DOM, or a canvas
// context -- it only computes the node graph, the cortex point cloud, and
// the 3D-to-2D projection that GraphPanel.tsx then draws.
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
};

/** Half-thickness of the brain (left↔right) at a lateral point: the profile is extruded into a 3D volume. */
export function halfW(x: number, y: number) {
  if (inRegion("brainstem", x, y)) return 16;
  if (inRegion("cerebellum", x, y)) return 62 * Math.sqrt(Math.max(0.05, 1 - ((x - 113) / 66) ** 2 - ((y - 113) / 48) ** 2));
  return 8 + 86 * Math.sqrt(Math.max(0.04, 1 - (x / 210) ** 2 - ((y + 24) / 140) ** 2));
}

const LOBES: RegionId[] = ["frontal", "parietal", "occipital", "temporal"];
export const regionAt = (x: number, y: number): RegionId | null => {
  if (inRegion("brainstem", x, y)) return "brainstem"; if (inRegion("cerebellum", x, y)) return "cerebellum";
  if (!LOBES.some(id => inRegion(id, x, y))) return null;
  return LOBES.reduce((a, b) => Math.hypot(x - REGIONS[a].cx, y - REGIONS[a].cy) < Math.hypot(x - REGIONS[b].cx, y - REGIONS[b].cy) ? a : b);
};

/** Cortex: thousands of dim neurons on the brain surface. Gyri emerge where a fold field is near zero. */
export type P = { x: number; y: number; z: number; c: string; b: number };
export function buildCortex() {
  const r = rng(11); const pts: P[] = [];
  for (let t = 0; pts.length < 5200 && t < 120000; t++) {
    const x = -215 + r() * 430, y = -165 + r() * 380; const reg = regionAt(x, y); if (!reg) continue;
    const side = r() < .5 ? -1 : 1, shell = reg === "brainstem" ? r() : .82 + r() * .18;
    const z = side * halfW(x, y) * shell + (reg === "cerebellum" || reg === "brainstem" ? 0 : side * 4);
    const fold = Math.sin(x * .085 + Math.sin(y * .06 + z * .03) * 2.4) * Math.cos(y * .075 - z * .04 + Math.sin(x * .05));
    const ridge = reg === "cerebellum" ? Math.abs(Math.sin(y * .45 + x * .08)) : 1 - Math.abs(fold);
    if (ridge < .45 && r() < .8) continue;
    pts.push({ x, y, z, c: REGIONS[reg].c, b: .25 + ridge * .55 });
  }
  return pts;
}

export type Rot = { yaw: number; pitch: number };
/** Rotate around the orchestrator core, then apply a soft perspective. */
export const project = (x: number, y: number, z: number, o: Rot) => {
  const X = x - CORE.x, Y = y - CORE.y, cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const x1 = X * cy + z * sy, z1 = -X * sy + z * cy; const y1 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp;
  const s = 700 / (700 + z2); return { x: CORE.x + x1 * s, y: CORE.y + y1 * s, s };
};

export function build() {
  const r = rng(7); const nodes: N[] = []; const links: [number, number][] = [];
  // Root sits at the thalamus: the relay station every signal passes through.
  nodes.push({ id: 0, g: -1, x: 10, y: -30, vx: 0, vy: 0, tx: 10, ty: -30, bz: 0, hub: true, label: "kepano-obsidian" });
  GROUPS.forEach((g, gi) => {
    const R = REGIONS[g.region]; const offs = gi === 6 ? 18 : gi === 1 ? -14 : 0;
    const hub = nodes.length; const hx = R.cx + offs * 0.6, hy = R.cy + offs;
    nodes.push({ id: hub, g: gi, x: hx, y: hy, vx: 0, vy: 0, tx: hx, ty: hy, bz: (gi % 2 ? -1 : 1) * halfW(hx, hy) * .35, hub: true, label: g.id });
    links.push([0, hub]); const kids: number[] = [];
    const count = g.region === "brainstem" ? 14 : g.region === "occipital" ? 18 : 34;
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, t = 0;
      do { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R.r; x = R.cx + Math.cos(a) * d; y = R.cy + Math.sin(a) * d; t++; } while (!inRegion(g.region, x, y) && t < 400);
      const id = nodes.length; nodes.push({ id, g: gi, x, y, vx: 0, vy: 0, tx: x, ty: y, bz: (r() * 2 - 1) * halfW(x, y) * .8, label: `${g.id.toLowerCase()}/nota-${i + 1}` });
      links.push([kids.length && r() < .6 ? kids[Math.floor(r() * kids.length)]! : hub, id]); kids.push(id);
    }
  });
  // Synapses: nearby neurons connect, which also wires neighbouring lobes together.
  for (let i = 1; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i]!, b = nodes[j]!; if (Math.hypot(a.tx - b.tx, a.ty - b.ty) < 30 && r() < .3) links.push([i, j]);
  }
  return { nodes, links };
}

export type Pulse = { l: number; t: number; rev: boolean; hops: number; c?: string; speed: number };
