import { useRef, useState } from "react";
import { Plus, Download, Link2, X, Pencil, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { connectCards, type CanvasEdge } from "@/lib/canvas-links";
import { Panel } from "./Panel";
import { fx } from "./panel-utils";

type Card = { id: string; text: string; body: string; x: number; y: number; w: number; h: number; c: string };
const INIT: Card[] = [
  { id: "ideas", text: "Ideias", body: "Pontos de partida", x: 24, y: 100, w: 170, h: 108, c: "red" },
  { id: "reading", text: "Leitura", body: "Referências e anotações", x: 24, y: 260, w: 170, h: 108, c: "cyan" },
  { id: "writing", text: "Escrita", body: "Rascunhos em andamento", x: 240, y: 175, w: 170, h: 108, c: "cyan" },
  { id: "review", text: "Revisão", body: "O que precisa de atenção", x: 465, y: 70, w: 170, h: 108, c: "yellow" },
  { id: "projects", text: "Projetos", body: "Próximas entregas", x: 465, y: 260, w: 170, h: 108, c: "orange" },
];
const INIT_EDGES: CanvasEdge[] = [["ideas", "writing"], ["reading", "writing"], ["writing", "review"], ["writing", "projects"]];
const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"];
const CANVAS_COLORS: Record<string, string> = { red: "1", orange: "2", yellow: "3", green: "4", cyan: "6", blue: "6", purple: "5", magenta: "5" };

export function CanvasPanel() {
  const [cards, setCards] = useState(INIT);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [edges, setEdges] = useState(INIT_EDGES);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [help, setHelp] = useState(false);
  const drag = useRef<{ id?: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const json = JSON.stringify({ nodes: cards.map(c => ({ id: c.id, type: "text", text: `# ${c.text}\n\n${c.body}`, x: Math.round(c.x), y: Math.round(c.y), width: c.w, height: c.h, color: CANVAS_COLORS[c.c] ?? "6" })), edges: edges.map(([a, b], i) => ({ id: `e${i}`, fromNode: a, fromSide: "right", toNode: b, toSide: "left" })) }, null, 2);
  const remove = (id: string) => { setCards(cs => cs.filter(c => c.id !== id)); setEdges(es => es.filter(([a, b]) => a !== id && b !== id)); if (linkFrom === id) setLinkFrom(null); };
  const download = () => { const url = URL.createObjectURL(new Blob([json], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "autogtec.canvas"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <Panel n="02" title="Canvas de conhecimento" sub="notas e relações" color="cyan" right="JSON Canvas">
    <div className="grid h-full grid-rows-[auto_1fr_8rem] lg:grid-cols-[1fr_320px] lg:grid-rows-[auto_1fr]">
      <div className="flex flex-wrap items-center gap-2 border-b border-fx-800 p-3 text-xs lg:col-span-2">
        <Button size="sm" variant="outline" className="border-fx-cyan bg-fx-900 text-fx-cyan" onClick={() => setCards(cs => [...cs, { id: crypto.randomUUID(), text: "Nova nota", body: "", x: 240 - pan.x, y: 24 - pan.y, w: 170, h: 108, c: COLORS[cs.length % COLORS.length] ?? "cyan" }])}><Plus />Cartão</Button>
        <span className="text-fx-200" role="status">{linkFrom ? `Destino para ${cards.find(c => c.id === linkFrom)?.text}:` : `${cards.length} notas · ${edges.length} conexões`}</span>
        {linkFrom && <><select aria-label="Cartão de destino" defaultValue="" className="max-w-40 border border-fx-cyan bg-fx-900 p-1 text-fx-paper" onChange={e => { setEdges(es => connectCards(es, linkFrom, e.target.value)); setLinkFrom(null); }}><option value="" disabled>Escolher destino</option>{cards.filter(c => c.id !== linkFrom).map(c => <option key={c.id} value={c.id}>{c.text}</option>)}</select><Button size="icon" variant="ghost" aria-label="Cancelar conexão" onClick={() => setLinkFrom(null)}><X /></Button></>}
        <div className="ml-auto flex gap-1"><Button size="icon" variant="ghost" aria-label="Sobre os cartões" title="Sobre os cartões" onClick={() => setHelp(true)} className="text-fx-300"><CircleHelp /></Button><Button size="sm" variant="ghost" className="text-fx-cyan" onClick={download}><Download />.canvas</Button></div>
      </div>
      <div className="relative min-h-0 overflow-hidden cursor-grab touch-none canvas-grid" style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }; }}
        onPointerMove={e => { const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (d.id) setCards(cs => cs.map(c => c.id === d.id ? { ...c, x: d.ox + dx, y: d.oy + dy } : c)); else setPan({ x: d.ox + dx, y: d.oy + dy }); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="absolute" style={{ transform: `translate(${pan.x}px,${pan.y}px)` }}>
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>{edges.map(([a, b]) => { const A = cards.find(c => c.id === a), B = cards.find(c => c.id === b); if (!A || !B) return null; const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x, y2 = B.y + B.h / 2; return <path key={`${a}-${b}`} data-canvas-edge={`${a}:${b}`} d={`M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2},${y2}`} stroke={fx(A.c)} fill="none" strokeWidth={2} markerEnd="url(#canvas-arrow)" />; })}<defs><marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill={fx("300")} /></marker></defs></svg>
          {cards.map(c => <div key={c.id} data-canvas-card={c.id} className={`absolute select-none border bg-fx-900 text-xs text-fx-paper ${linkFrom ? "cursor-crosshair" : "cursor-move"}`} style={{ left: c.x, top: c.y, width: c.w, height: c.h, borderColor: fx(c.c) }}
            onPointerDown={e => { e.stopPropagation(); if (linkFrom) { setEdges(es => connectCards(es, linkFrom, c.id)); setLinkFrom(null); return; } const viewport = e.currentTarget.parentElement?.parentElement; if (!viewport) return; viewport.setPointerCapture(e.pointerId); drag.current = { id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y }; }}
            onDoubleClick={() => setEditing({ ...c })}>
            <div className="flex items-center border-b border-fx-800 px-2 py-1"><span className="min-w-0 flex-1 truncate font-semibold">{c.text}</span><div className="flex shrink-0" onPointerDown={e => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-fx-cyan" title={`Conectar ${c.text}`} aria-label={`Conectar ${c.text}`} onClick={() => setLinkFrom(c.id)}><Link2 className="size-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-fx-300" title={`Editar ${c.text}`} aria-label={`Editar ${c.text}`} onClick={() => setEditing({ ...c })}><Pencil className="size-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-fx-300" title={`Excluir ${c.text}`} aria-label={`Excluir ${c.text}`} onClick={() => remove(c.id)}><X className="size-3.5" /></Button></div></div>
            <p className="line-clamp-3 break-words px-3 py-2 text-fx-200">{c.body || "Sem conteúdo"}</p>
          </div>)}
        </div>
      </div>
      <pre aria-label="Arquivo JSON Canvas" className="min-h-0 overflow-auto border-t border-fx-800 bg-fx-black p-3 font-mono text-[11px] leading-relaxed text-fx-300 lg:border-l lg:border-t-0">{json}</pre>
    </div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="w-[calc(100%-2rem)] border-fx-700 bg-fx-950 text-fx-paper"><DialogTitle>Editar nota</DialogTitle><DialogDescription className="text-fx-300">Conteúdo do cartão</DialogDescription>{editing && <><label className="text-sm">Título<input autoFocus value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} className="mt-1 w-full border border-fx-700 bg-fx-900 p-2" /></label><label className="text-sm">Nota<textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} className="mt-1 h-32 w-full border border-fx-700 bg-fx-900 p-2" /></label><Button onClick={() => { setCards(cs => cs.map(c => c.id === editing.id ? editing : c)); setEditing(null); }}>Salvar nota</Button></>}</DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="w-[calc(100%-2rem)] border-fx-700 bg-fx-950 text-fx-paper"><DialogTitle>O que são estes cartões?</DialogTitle><DialogDescription className="text-fx-200">São notas de texto que você organiza visualmente: ideias, referências, tarefas ou etapas de um projeto. As linhas registram relações entre elas; não executam agentes nem sincronizam seu Obsidian.</DialogDescription><p className="text-sm text-fx-300">Use o lápis para editar e o elo para escolher um destino. Baixar .canvas gera um arquivo no formato aberto JSON Canvas, que pode ser aberto no Obsidian. Este quadro fica apenas nesta sessão; baixe o arquivo antes de sair.</p></DialogContent></Dialog>
  </Panel>;
}
