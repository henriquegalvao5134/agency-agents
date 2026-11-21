export type CanvasEdge = [string, string];

export function connectCards(edges: CanvasEdge[], source: string, target: string): CanvasEdge[] {
  if (source === target || edges.some(([a, b]) => a === source && b === target)) return edges;
  return [...edges, [source, target]];
}