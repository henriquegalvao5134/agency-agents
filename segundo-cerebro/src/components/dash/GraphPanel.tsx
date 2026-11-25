import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { agentSnapshot, saveAgentSnapshot, serverAgentSnapshot, subscribeAgents } from "@/lib/brain-agent-store";
import { agentIsWorking, isTaskActive, type BrainTask } from "@/lib/brain-routing";
import { TaskMonitor } from "./TaskMonitor";
import { AgenciaLayer } from "./AgenciaLayer";
import { agentesAcesos, estadoAgencia, rotuloOrquestrador } from "@/lib/cerebro/agencia";
import { vistaPadrao } from "./brain-camera";
import divisoes from "@/lib/cerebro/divisoes.json";
import { useAtividade, useProvedores, useSessao } from "@/lib/cerebro/use-atividade";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FX } from "./Panel";
import { Move, Rotate3D, RotateCcw, Scan, Hand } from "lucide-react";
import { Movable } from "./Movable";
import { build, buildCortex, detalheDoNo, project, regionAt, type N, type Pulse, type Rot } from "./brain-graph-model";
import { Panel } from "./Panel";
import { fx, rng } from "./panel-utils";
import { CORE, buildBrainIndex, estimateTokens, BRAIN_IMG, DEFAULT_AGENTS, portY, PORT_X, wirePath, type Agent, type AgentId, BRAINSTEM, CEREBELLUM, CEREBRUM, FOLIA, GROUPS, REGIONS, SKILLS, SULCI, type RegionId } from "./brain";
export function GraphPanel() {
  const [data] = useState(build);
  const [cortex] = useState(buildCortex);
  const rot = useRef<Rot>({ yaw: 0, pitch: 0 });
  const [spin, setSpin] = useState(false); const spinRef = useRef(spin); spinRef.current = spin;
  const cv = useRef<HTMLCanvasElement>(null);
  const colors = useRef<Record<string, string> | null>(null);
  const [, tick] = useState(0);
  const [view, setView] = useState({ x: 40, y: 30, k: 1.3 });
  const [brainOffset, setBrainOffset] = useState({ x: 0, y: 0 });
  const brainOffsetRef = useRef(brainOffset); brainOffsetRef.current = brainOffset;
  const [portOffsets, setPortOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [movement, setMovement] = useState<"rotate" | "brain" | "pan">("rotate");
  const [sel, setSel] = useState<N | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const svg = useRef<SVGSVGElement>(null);
  // Quantas entradas de IA existem agora: a vista padrão enquadra a coluna delas, o cérebro, a agência e as skills.
  const nAgentesRef = useRef(DEFAULT_AGENTS.length);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let previousWidth = 0;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (!width || width === previousWidth) return;
      previousWidth = width;
      setView(vistaPadrao(width, el.clientHeight, nAgentesRef.current));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ port?: { id: string; x: number; y: number; ox: number; oy: number }; brain?: { x: number; y: number; ox: number; oy: number }; pan?: { x: number; y: number; vx: number; vy: number }; rot?: { x: number; y: number; yaw: number; pitch: number } } | null>(null);
  const pulses = useRef<Pulse[]>(Array.from({ length: 14 }, (_, i) => ({ l: (i * 37) % data.links.length, t: (i % 10) / 10, rev: false, hops: Infinity, speed: 0.015 })));
  const regionAct = useRef(new Map<RegionId, number>());
  const [skill, setSkill] = useState<(typeof SKILLS)[number] | null>(null);
  const timers = useRef<number[]>([]);
  const agentesLocais = useSyncExternalStore(subscribeAgents, agentSnapshot, serverAgentSnapshot);
  // IAs cadastradas no cofre do núcleo (com chave cifrada no servidor) também viram entradas do cérebro.
  const sessao = useSessao();
  const provedores = useProvedores();
  const cofre = provedores.data ?? [];
  const agents = [...agentesLocais, ...cofre.filter(p => !agentesLocais.some(a => a.id === `cofre:${p.id}`)).map(p => ({ id: `cofre:${p.id}`, name: p.nome, vendor: p.fornecedor, c: p.cor, model: `${p.fornecedor}/${p.modelo}`, kind: "api" as const }))];
  const [agent, setAgent] = useState<AgentId>("claude-code");
  const [log, setLog] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [prompt, setPrompt] = useState("");
  // Many AIs can think at once: each agent has its own busy flag and answer, all reading the same AI core.
  const [tasks, setTasks] = useState<BrainTask[]>([]);
  const [delegate, setDelegate] = useState(true);
  // Uma entrada de IA também acende quando essa ferramenta registrou atividade real no núcleo (Claude Code, etc.).
  const atividade = useAtividade().data;
  const ativosNoNucleo = atividade?.ativos ?? [];
  // Agência GD3 e skills de trabalho: acendem pelas delegações recentes do orquestrador.
  const estado = estadoAgencia(atividade, divisoes);
  // Agentes chamados nas delegações recentes (janela do servidor) acendem como neurônios dentro do lobo.
  const acesos = agentesAcesos(atividade?.delegacoes);
  const orquestrador = cofre.find(p => p.papel === "orquestrador");
  const rotuloNucleo = rotuloOrquestrador({ carregando: sessao.isLoading || provedores.isLoading, logado: !!sessao.data?.logado, nome: orquestrador?.nome, ativo: estado.orquestradorAtivo });
  const busyMap = Object.fromEntries(agents.map(a => [a.id, agentIsWorking(tasks, a.id) || ativosNoNucleo.includes(a.id)]));
  const activeTasks = tasks.filter(isTaskActive);
  const runningSkills = SKILLS.filter(s => activeTasks.some(t => t.phase === "running" && t.skillId === s.id));
  const [answers, setAnswers] = useState<Record<string, { ok: boolean; text: string }>>({});
  const saveAgents = (lista: Agent[]) => saveAgentSnapshot(lista.filter(a => !a.id.startsWith("cofre:")));
  nAgentesRef.current = agents.length;
  const ag = agents.find(a => a.id === agent) ?? agents[0] ?? DEFAULT_AGENTS[0]!;
  const online = new Set(agents.filter(a => a.model).map(a => a.id));
  // Fire a skill: light each region of its path in order and launch a burst of synaptic pulses there.
  const fire = (sk: (typeof SKILLS)[number], executor?: Agent) => {
    setLog(l => [`${executor ? `${executor.name} executando` : "Prévia visual"} → ${sk.label}: ${sk.path.map(r => REGIONS[r].name.replace("Lobo ", "")).join(", ")}`, ...l].slice(0, 3));
    setSkill(sk);
    sk.path.forEach((reg, step) => timers.current.push(window.setTimeout(() => {
      regionAct.current.set(reg, performance.now());
      const gs = GROUPS.map((g, i) => (g.region === reg ? i : -1)).filter(i => i >= 0);
      const ls = data.links.map((l, i) => [l, i] as const).filter(([[a, b]]) => gs.includes(data.nodes[a]!.g) || gs.includes(data.nodes[b]!.g));
      for (let k = 0; k < 28 && ls.length; k++) pulses.current.push({ l: ls[(k * 13 + step * 7) % ls.length]![1], t: 0, rev: k % 2 === 0, hops: 6, c: REGIONS[reg].c, speed: 0.035 });
    }, 500 + step * 550)));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // A caixa do cérebro fala com o núcleo: o orquestrador do cofre escolhe os subagentes e a IA selecionada responde com a chave dela.
  const send = async () => {
    const me = ag;
    const selectedSkill = skill ?? SKILLS[0];
    const request = prompt.trim();
    if (!selectedSkill || !request) return;
    if (!me.id.startsWith("cofre:")) {
      setAnswers(a => ({ ...a, [me.id]: { ok: false, text: `${me.name} ainda não tem chave no cofre. Cadastre uma IA em "Cofre de IAs" (logo abaixo do cérebro) e selecione ela aqui.` } }));
      return;
    }
    const id = crypto.randomUUID(), startedAt = Date.now();
    setTasks(ts => [{ id, mode: delegate ? "delegated" : "direct", toolCallId: null, sourceId: me.id, source: me.name, targetId: me.id, target: me.name,
      skillId: selectedSkill.id, skill: selectedSkill.label, task: request, reason: "",
      phase: delegate ? "routing" : "running", startedAt, finishedAt: null,
      events: [{ at: startedAt, label: delegate ? `${me.name} chamou o orquestrador do núcleo` : `${me.name} iniciou execução direta` }],
    }, ...ts]);
    const updateTask = (patch: Partial<BrainTask>, label: string) => setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch, events: [...t.events, { at: Date.now(), label }] } : t));
    try {
      const r = await fetch("/api/painel/perguntar", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provedorId: me.id.slice("cofre:".length), pedido: request, skill: selectedSkill.label, delegar: delegate }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { texto?: string; erro?: string; area?: string | null; agentes?: string[] };
      if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
      if (delegate) updateTask({ phase: "running", reason: `${corpo.area ?? ""}: ${(corpo.agentes ?? []).join(", ")}` }, `Orquestrador → ${(corpo.agentes ?? []).join(", ") || "sem subagente"} → ${me.name}`);
      fire(selectedSkill, me);
      setAnswers(a => ({ ...a, [me.id]: { ok: true, text: corpo.texto ?? "" } }));
      updateTask({ phase: "completed", finishedAt: Date.now() }, `${me.name} devolveu o resultado`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível falar com a IA.";
      setAnswers(a => ({ ...a, [me.id]: { ok: false, text } }));
      updateTask({ phase: "failed", finishedAt: Date.now() }, text);
    }
  };
  const flash = useRef(new Map<number, number>());
  const viewRef = useRef(view); viewRef.current = view;
  useEffect(() => {
    let raf = 0, alpha = 1;
    const adj = new Map<number, number[]>(); data.links.forEach(([a, b], i) => { adj.set(a, [...(adj.get(a) ?? []), i]); adj.set(b, [...(adj.get(b) ?? []), i]); });
    const R = rng(3);
    const step = () => {
      const { nodes, links } = data;
      if (spinRef.current && !drag.current) rot.current.yaw += 0.006;
      const o = rot.current;
      for (const n of data.nodes) { const p = project(n.tx, n.ty, n.bz ?? 0, o); n.x = p.x; n.y = p.y; n.d = p.s; }
      // Cortex is painted on a canvas behind the SVG with the same camera, so neurons and brain are one volume.
      const c = cv.current; if (c) {
        const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1; if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
        const ctx = c.getContext("2d")!; const v = viewRef.current; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * (w / 2 + v.x + brainOffsetRef.current.x * v.k), dpr * (h / 2 + v.y + brainOffsetRef.current.y * v.k)); ctx.globalCompositeOperation = "lighter";
        const now0 = performance.now();
        if (!colors.current) { const cs = getComputedStyle(c); colors.current = Object.fromEntries(FX.map(k => [k, cs.getPropertyValue(`--fx-${k}`).trim() || "#888"])); }
        for (const p of cortex) { const q = project(p.x, p.y, p.z, o); const reg = regionAt(p.x, p.y); const t0 = reg ? regionAct.current.get(reg) : undefined; const act = t0 ? Math.max(0, 1 - (now0 - t0) / 2600) : 0;
          ctx.globalAlpha = Math.min(1, p.b * (q.s - .5) * 1.5 + act * .7); ctx.fillStyle = colors.current![p.c] ?? "#888"; const rr = (1.2 + act * 1.2) * q.s; ctx.fillRect(q.x - rr / 2, q.y - rr / 2, rr, rr); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      const now = performance.now();
      for (const p of pulses.current) { p.t += p.speed; if (p.t >= 1) { p.hops--; const [a, b] = data.links[p.l]!; const end = p.rev ? a : b; flash.current.set(end, now); const opts = adj.get(end) ?? []; const l = opts[Math.floor(R() * opts.length)] ?? 0; p.l = l; p.rev = data.links[l]![1] === end; p.t = 0; } }
      pulses.current = pulses.current.filter(p => p.hops > 0);
      tick(t => t + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const el = svg.current!;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const v = viewRef.current; const rect = el.getBoundingClientRect(); const px = e.clientX - rect.left - rect.width / 2, py = e.clientY - rect.top - rect.height / 2; const nk = Math.min(4, Math.max(.3, v.k * Math.exp(-e.deltaY * 0.0015))); const k = nk / v.k; setView({ k: nk, x: px - (px - v.x) * k, y: py - (py - v.y) * k }); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { cancelAnimationFrame(raf); el.removeEventListener("wheel", onWheel); };
  }, [data, cortex]);
  const toWorld = (e: React.PointerEvent) => { const r = svg.current?.getBoundingClientRect(); if (!r) return { x: 0, y: 0 }; return { x: (e.clientX - r.left - r.width / 2 - view.x) / view.k, y: (e.clientY - r.top - r.height / 2 - view.y) / view.k }; };
  const startBrainMove = (e: React.PointerEvent) => { e.stopPropagation(); svg.current?.setPointerCapture(e.pointerId); drag.current = { brain: { x: e.clientX, y: e.clientY, ox: brainOffset.x, oy: brainOffset.y } }; };
  const vis = (n: N) => n.g < 0 || !hidden.has(n.g);
  const color = (n: N) => n.g < 0 ? fx("paper") : fx(GROUPS[n.g]!.c);
  const regiaoCurta = (id: RegionId) => { const s = REGIONS[id].name.replace("Lobo ", ""); return s.charAt(0).toUpperCase() + s.slice(1); };
  const GYRI = ["M-180,-60 C-150,-80 -120,-40 -90,-70 S-40,-60 -20,-100", "M-170,-10 C-140,-30 -110,0 -80,-25 S-40,-10 -10,-40", "M-130,-120 C-110,-100 -80,-130 -50,-110", "M40,-130 C70,-110 100,-130 130,-100", "M30,-60 C60,-80 90,-50 120,-70 S160,-40 190,-50", "M-120,55 C-90,40 -60,65 -30,45 S20,50 50,30", "M140,10 C160,-5 180,20 200,0"];
  return (
    <Panel n="01" title="Cérebro AutoGTEC" sub="núcleo compartilhado" color="purple" right={<span>cérebro unificado · {activeTasks.length ? `${activeTasks.length} tarefas ativas` : "em espera"}</span>}>
      <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[510px] min-w-0 flex-1">
      {activeTasks.length > 0 && <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-24px)] border-l-2 border-fx-cyan bg-fx-black/90 px-3 py-2 text-xs text-fx-paper">{activeTasks.slice(0, 3).map(t => <div key={t.id} className="break-words">{t.source}{t.mode === "delegated" ? ` → Orquestrador${t.target ? ` → ${t.target} · ${t.skill}` : " · escolhendo agente e skill…"}` : ` · ${t.skill} · executando`}</div>)}</div>}
      <canvas ref={cv} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="absolute right-3 top-3 z-10 flex gap-1 border border-fx-800 bg-fx-950 p-1">
        {([{ id: "rotate", label: "Girar cérebro", Icon: Rotate3D }, { id: "brain", label: "Mover cérebro", Icon: Move }, { id: "pan", label: "Mover tela", Icon: Hand }] as const).map(({ id, label, Icon }) => <Button key={id} size="icon" variant="ghost" title={label} aria-label={label} aria-pressed={movement === id} onClick={() => setMovement(id)} className={movement === id ? "bg-fx-850 text-fx-cyan" : "text-fx-300"}><Icon /></Button>)}
        <Button size="icon" variant="ghost" title="Rotação automática 360°" aria-label="Rotação automática 360°" aria-pressed={spin} onClick={() => setSpin(s => !s)} className="text-fx-300"><RotateCcw /></Button>
        <Button size="icon" variant="ghost" title="Restaurar vista e posições" aria-label="Restaurar vista e posições" onClick={() => { rot.current = { yaw: 0, pitch: 0 }; setBrainOffset({ x: 0, y: 0 }); setPortOffsets({}); setView(vistaPadrao(svg.current?.clientWidth ?? 900, svg.current?.clientHeight ?? 600, agents.length)); }} className="text-fx-300"><Scan /></Button>
      </div>
      <svg ref={svg} aria-label="Cérebro e entradas de IA" className="relative h-full w-full cursor-grab touch-none select-none" onPointerDown={e => { svg.current?.setPointerCapture(e.pointerId); const w = toWorld(e); const onBrain = !e.shiftKey && ((w.x - brainOffset.x - 5) / 230) ** 2 + ((w.y - brainOffset.y - 20) / 210) ** 2 < 1;
          if (movement === "brain" && onBrain) { startBrainMove(e); return; }
          drag.current = movement === "rotate" && onBrain ? { rot: { x: e.clientX, y: e.clientY, ...rot.current } } : { pan: { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y } }; }}
        onPointerMove={e => { const d = drag.current; if (!d) return; if (d.port) { const p = d.port; setPortOffsets(v => ({ ...v, [p.id]: { x: p.ox + (e.clientX - p.x) / view.k, y: p.oy + (e.clientY - p.y) / view.k } })); } else if (d.brain) { const b = d.brain; setBrainOffset({ x: b.ox + (e.clientX - b.x) / view.k, y: b.oy + (e.clientY - b.y) / view.k }); } else if (d.rot) { rot.current = { yaw: d.rot.yaw + (e.clientX - d.rot.x) * 0.008, pitch: Math.max(-1.4, Math.min(1.4, d.rot.pitch + (e.clientY - d.rot.y) * 0.008)) }; } else if (d.pan) { const p = d.pan; setView(v => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y })); } }}
        onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <g transform={`translate(${(svg.current?.clientWidth ?? 600) / 2 + view.x},${(svg.current?.clientHeight ?? 400) / 2 + view.y}) scale(${view.k})`}>
          <defs>
            <radialGradient id="glow"><stop offset="0" stopColor={fx("paper")} stopOpacity={.9} /><stop offset="1" stopColor={fx("cyan")} stopOpacity={0} /></radialGradient>
            <radialGradient id="brainFill" cx="40%" cy="35%" r="75%"><stop offset="0" stopColor={fx("800")} /><stop offset="0.6" stopColor={fx("900")} /><stop offset="1" stopColor={fx("950")} /></radialGradient>
            <linearGradient id="stemFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fx("850")} /><stop offset="1" stopColor={fx(ag.c)} stopOpacity={.35} /></linearGradient>
            {(Object.keys(REGIONS) as RegionId[]).map(id => <radialGradient key={id} id={`rg-${id}`}><stop offset="0" stopColor={fx(REGIONS[id].c)} stopOpacity={.9} /><stop offset="0.55" stopColor={fx(REGIONS[id].c)} stopOpacity={.35} /><stop offset="1" stopColor={fx(REGIONS[id].c)} stopOpacity={0} /></radialGradient>)}
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter>
            <filter id="neon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <pattern id="circuit" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7h5l2-2h7M7 0v4" stroke={fx("800")} strokeWidth={.5} fill="none" /><circle cx="7" cy="5" r=".8" fill={fx("700")} /></pattern>
          </defs>
          <clipPath id="cereb"><path d={CEREBRUM} /></clipPath>
          {/* AI inputs: each assistant is a port wired into the AI core */}
          {agents.map((a0, ai) => { const offset = portOffsets[a0.id] ?? { x: 0, y: 0 }; const a = { ...a0, y: portY(ai, agents.length) + offset.y }; const on = online.has(a.id), act = a.id === agent || !!busyMap[a.id]; const wire = `M${PORT_X + 70 + offset.x},${a.y} C${PORT_X + 150 + offset.x},${a.y} ${CORE.x + brainOffset.x - 120},${CORE.y + brainOffset.y + 100} ${CORE.x + brainOffset.x},${CORE.y + brainOffset.y}`; return (
            <g key={a.id} data-ai-port={a.id}>
              <path d={wire} pointerEvents="none" fill="none" stroke={fx(act ? a.c : "800")} strokeOpacity={act ? .35 : .6} strokeWidth={act ? 5 : 1.5} filter={act ? "url(#soft)" : undefined} />
              <path d={wire} pointerEvents="none" fill="none" stroke={fx(on ? a.c : "700")} strokeWidth={act ? 1.8 : 1} strokeOpacity={on ? (act ? 1 : .5) : .4} strokeDasharray={on ? "4 8" : "2 6"} className={busyMap[a.id] ? "wire-flow" : ""} />
              <g transform={`translate(${offset.x},0)`} role="button" tabIndex={0} aria-label={`Selecionar e mover ${a.name}`} className="cursor-move" onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAgent(a.id); } }} onPointerDown={e => { e.stopPropagation(); svg.current?.setPointerCapture(e.pointerId); setAgent(a.id); drag.current = { port: { id: a.id, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y } }; }}>
              <rect x={PORT_X - 40} y={a.y - 15} width={110} height={30} rx={6} fill={fx("950")} stroke={fx(act ? a.c : "700")} strokeWidth={act ? 1.6 : 1} filter={act ? "url(#neon)" : undefined} />
              <circle cx={PORT_X - 26} cy={a.y} r={4} fill={fx(on ? a.c : "600")}>{act && <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />}</circle>
              <text x={PORT_X - 16} y={a.y - 1} fontSize={9} fontWeight={600} fontFamily="var(--font-sans)" fill={fx(act ? "paper" : "300")}>{a.name}</text>
              <text x={PORT_X - 16} y={a.y + 9} fontSize={7} fontFamily="var(--font-mono)" fill={fx("500")}>{busyMap[a.id] ? "◉ trabalhando" : a.kind === "autonomous" && !a.id.startsWith("cofre:") ? "○ via MCP" : on ? (act ? "● selecionada" : "● cofre") : "○ precisa de chave"} · {a.vendor}</text>
              <circle cx={PORT_X + 70} cy={a.y} r={3} fill={fx(on ? a.c : "700")} />
              </g>
            </g>); })}
          <g role="button" tabIndex={0} aria-label="Adicionar IA" className="cursor-pointer" onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenu(true); } }} onPointerDown={e => { e.stopPropagation(); setMenu(true); }}>
            <rect x={PORT_X - 40} y={portY(agents.length - 1, agents.length) + 24} width={110} height={24} rx={6} fill="none" stroke={fx("cyan")} strokeDasharray="4 3" />
            <text x={PORT_X + 15} y={portY(agents.length - 1, agents.length) + 39} textAnchor="middle" fontSize={9} fontWeight={600} fontFamily="var(--font-sans)" fill={fx("cyan")}>+ Adicionar IA</text>
          </g>
          <text x={PORT_X + 15} y={portY(0, agents.length) - 26} fontSize={8} fontWeight={600} letterSpacing={1.5} textAnchor="middle" fontFamily="var(--font-sans)" fill={fx("500")}>ENTRADAS DE IA</text>
          <AgenciaLayer estado={estado} core={{ x: CORE.x + brainOffset.x, y: CORE.y + brainOffset.y }} />
          <g data-brain-volume transform={`translate(${brainOffset.x},${brainOffset.y})`}>
          {/* Region glow: soft radial light; brightness = how recently a skill activated that region */}
          {(Object.keys(REGIONS) as RegionId[]).map(id => { const R = REGIONS[id]; const t0 = regionAct.current.get(id); const act = t0 ? Math.max(0, 1 - (performance.now() - t0) / 2600) : 0; const lit = runningSkills.some(s => s.path.includes(id)) || skill?.path.includes(id);
            const P = project(R.cx, R.cy, 0, rot.current); return <g key={id} style={{ mixBlendMode: "screen" }}><circle cx={P.x} cy={P.y} r={R.r * (1.1 + act * .25)} fill={`url(#rg-${id})`} opacity={0.18 + act * 0.7 + (lit ? 0.1 : 0)} /></g>; })}
          {(Object.keys(REGIONS) as RegionId[]).map(id => { const R = REGIONS[id]; const pos = { frontal: [-150, -125], parietal: [60, -160], occipital: [215, -75], temporal: [-60, 112], cerebellum: [175, 165], brainstem: [80, 215] }[id]; const P = project(pos[0]!, pos[1]!, 0, rot.current); return <text key={id} x={P.x} y={P.y} fontSize={12} fontWeight={700} letterSpacing={1} paintOrder="stroke" stroke={fx("black")} strokeWidth={4} fill={fx(R.c)} textAnchor="middle" fontFamily="var(--font-sans)">{R.name.toUpperCase()}</text>; })}
          {data.links.map(([s, t], i) => { const a = data.nodes[s]!, b = data.nodes[t]!; if (!vis(a) || !vis(b)) return null; const hl = sel && (sel === a || sel === b); const mx = (a.x + b.x) / 2 + (b.y - a.y) * .18, my = (a.y + b.y) / 2 - (b.x - a.x) * .18; return <path key={i} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke={hl ? color(sel!) : a.id === 0 ? fx(ag.c) : fx("600")} strokeOpacity={hl ? .9 : (a.id === 0 ? .55 : .45) * Math.min(1, ((a.d ?? 1) - .6) * 2.5)} strokeWidth={hl ? 1.8 : .9} />; })}
          {runningSkills.flatMap(sk => sk.path.map(reg => { const R = REGIONS[reg]; const P = project(R.cx, R.cy, 0, rot.current); return <g key={`${sk.id}-${reg}`} pointerEvents="none"><path d={`M${CORE.x},${CORE.y} Q${P.x - 20},${CORE.y - 30} ${P.x},${P.y}`} fill="none" stroke={fx(R.c)} strokeWidth={1.8} strokeDasharray="3 5" className="wire-flow" /><text x={P.x} y={P.y + 18} fontFamily="var(--font-sans)" fontSize={9} textAnchor="middle" fill={fx("paper")} stroke={fx("black")} strokeWidth={3} paintOrder="stroke">{sk.label} · executando</text></g>; }))}
          {pulses.current.map((p, i) => { const [s0, t0] = data.links[p.l]!; const a = data.nodes[p.rev ? t0 : s0]!, b = data.nodes[p.rev ? s0 : t0]!; if (!vis(a) || !vis(b)) return null; const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t; return <g key={i}><line x1={a.x + (b.x - a.x) * Math.max(0, p.t - .35)} y1={a.y + (b.y - a.y) * Math.max(0, p.t - .35)} x2={x} y2={y} stroke={p.c ? fx(p.c) : color(a)} strokeWidth={p.c ? 2.2 : 1.2} strokeOpacity={p.c ? 1 : .6} strokeLinecap="round" /><circle cx={x} cy={y} r={p.c ? 7 : 4} fill={p.c ? fx(p.c) : "url(#glow)"} fillOpacity={p.c ? .35 : 1} /><circle cx={x} cy={y} r={1.4} fill={fx("paper")} /></g>; })}
          {/* Agents on duty: neurons wired by dendrites into the orchestrator core; fire while thinking */}
          {agents.map((a, i) => { const ang = (i / Math.max(1, agents.length)) * Math.PI * 2 - Math.PI / 2; const Q = project(CORE.x + Math.cos(ang) * 58, CORE.y + Math.sin(ang) * 30, Math.sin(ang) * 40, rot.current); const x = Q.x, y = Q.y; const busy = !!busyMap[a.id]; const mx = (CORE.x + x) / 2 + Math.sin(ang) * 14, my = (CORE.y + y) / 2 - Math.cos(ang) * 14; return (
            <g key={a.id} className="cursor-pointer" onPointerDown={e => { e.stopPropagation(); setAgent(a.id); }}>
              <path d={`M${CORE.x},${CORE.y} Q${mx},${my} ${x},${y}`} fill="none" stroke={fx(a.c)} strokeWidth={busy ? 1.6 : .8} strokeOpacity={busy ? 1 : .55} strokeDasharray={busy ? "2 3" : undefined} className={busy ? "wire-flow" : ""} />
              <circle cx={x} cy={y} r={busy ? 9 : 6} fill={fx(a.c)} opacity={.18}>{busy && <animate attributeName="r" values="6;11;6" dur="1s" repeatCount="indefinite" />}</circle>
              <circle cx={x} cy={y} r={3.6} fill={fx(a.c)} filter="url(#neon)" />
              <text x={x} y={y - 7} textAnchor="middle" fontSize={7.5} fontWeight={600} fontFamily="var(--font-sans)" fill={fx("paper")} paintOrder="stroke" stroke={fx("black")} strokeWidth={2.5}>{a.name}{busy ? " · pensando" : ""}</text>
            </g>); })}
          {data.nodes.filter(vis).map(n => (
            <g key={n.id} data-brain-core={n.id === 0 ? "true" : undefined} transform={`translate(${n.x},${n.y})`} className={n.id === 0 || movement === "brain" ? "cursor-move" : "cursor-pointer"} onPointerDown={e => { if (n.id === 0 || movement === "brain") { startBrainMove(e); return; } e.stopPropagation(); setSel(n); }}>
              {(() => { const f = flash.current.get(n.id); const age = f ? (performance.now() - f) / 500 : 1; return age < 1 ? <circle r={(n.hub ? 10 : 5) + age * 8} fill="none" stroke={color(n)} strokeOpacity={1 - age} /> : null; })()}
              {!n.hub && n.id !== 0 && <circle r={6} fill={color(n)} opacity={.14} />}<circle r={(n.id === 0 ? 10 : n.hub ? 5.5 : 2.6) * (n.d ?? 1)} opacity={Math.min(1, ((n.d ?? 1) - .55) * 2.2)} fill={n.id === 0 ? fx(ag.c) : color(n)} filter={n.id === 0 || n.hub ? "url(#neon)" : undefined} fillOpacity={1} />
              {n.id === 0 && <g pointerEvents="none">
                <circle r={26} fill={fx(ag.c)} fillOpacity={.15} filter="url(#soft)" />
                <circle r={19} fill="none" stroke={fx(ag.c)} strokeWidth={1} strokeDasharray="3 4" className="core-spin" />
                <circle r={15} fill="none" stroke={fx("paper")} strokeOpacity={.6} strokeWidth={.8} strokeDasharray="10 5" className="core-spin-rev" />
                {estado.orquestradorAtivo && <circle data-core-pulse r={23} fill="none" stroke={fx(ag.c)} strokeWidth={1.5} className="core-pulse" />}
                <text textAnchor="middle" y={-30} fontSize={8} fontWeight={600} letterSpacing={1.2} fontFamily="var(--font-sans)" fill={fx(ag.c)}>{rotuloNucleo}</text>
                <text textAnchor="middle" dy={3} fontSize={7} fontWeight={700} fontFamily="var(--font-mono)" fill={fx("black")}>IA</text></g>}
              {n.hub && n.id !== 0 && <g><text textAnchor="middle" y={-11} fontSize={9.5} fontWeight={600} paintOrder="stroke" stroke={fx("black")} strokeWidth={3} fontFamily="var(--font-sans)" fill={color(n)}>{n.label}</text></g>}
            </g>
          ))}
          {/* Agente delegado: anel pulsando na cor do departamento e o nome, por cima dos outros neurônios */}
          {data.nodes.filter(n => n.agenteId && acesos.has(n.agenteId) && vis(n)).map(n => (
            <g key={`aceso-${n.id}`} data-agente-aceso={n.agenteId} transform={`translate(${n.x},${n.y})`} pointerEvents="none">
              <circle r={7} fill="none" stroke={fx(GROUPS[n.g]!.c)} strokeWidth={1.4}><animate attributeName="r" values="4;9;4" dur="1.2s" repeatCount="indefinite" /></circle>
              <text textAnchor="middle" y={-11} fontSize={8} fontWeight={600} paintOrder="stroke" stroke={fx("black")} strokeWidth={2.5} fontFamily="var(--font-sans)" fill={fx("paper")}>{n.label}</text>
            </g>
          ))}
          </g>
        </g>
      </svg>
      {sel && (
        <div data-detalhe-no className="absolute bottom-2 right-2 w-56 border border-fx-700 bg-fx-900 p-2 text-xs">
          <div className="flex justify-between"><b style={{ color: color(sel) }}>{detalheDoNo(sel).titulo}</b><button onClick={() => setSel(null)} aria-label="Fechar detalhe" className="text-fx-500">×</button></div>
          {detalheDoNo(sel).linhas.map(l => <p key={l} className="mt-1 text-fx-300">{l}</p>)}
        </div>
      )}
        </div>
        <aside className="flex max-h-[400px] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-fx-800 bg-fx-black/40 p-4 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
      <Movable id="skills" className="right-2 top-2 w-72" title="Controle do cérebro" right={<Button size="sm" variant="ghost" onClick={() => setMenu(true)} className="h-auto px-1.5 text-fx-cyan">+ Conectar IA</Button>}><div className="p-3">

        <div className="mb-2 flex items-center gap-2 border-b border-fx-800 pb-2"><span className="h-2 w-2 animate-pulse rounded-full" style={{ background: fx(ag.c) }} /><span className="text-fx-500">IA ativa</span><b style={{ color: fx(ag.c) }}>{ag.name}</b><span className="ml-auto font-mono text-[11px] text-fx-600">{ag.model ?? "sem modelo"}</span></div>
        <label className="mb-3 block font-semibold text-fx-paper">Agente selecionado<select aria-label="Selecionar agente" value={agent} onChange={e => setAgent(e.target.value)} className="mt-1 w-full border border-fx-700 bg-fx-950 p-2 text-fx-paper">{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <div className="mb-1 font-semibold text-fx-paper">Ativar uma habilidade</div>
        <div className="flex flex-wrap gap-1">{SKILLS.map(sk => <button key={sk.id} onClick={() => fire(sk)} className={`border px-2 py-0.5 transition-colors ${skill?.id === sk.id ? "border-fx-yellow bg-fx-yellow text-fx-black" : "border-fx-700 text-fx-200 hover:border-fx-yellow"}`}>⚡ {sk.label}</button>)}</div>
        {skill ? <div className="mt-2 leading-4"><div className="flex flex-wrap items-center gap-1">{skill.path.map((r, i) => <span key={r} className="flex items-center gap-1">{i > 0 && <span className="text-fx-600">→</span>}<span style={{ color: fx(REGIONS[r].c) }}>{REGIONS[r].name}</span></span>)}</div><p className="mt-1 text-fx-500">{skill.why}</p></div>
          : <p className="mt-2 text-fx-500">Clique numa IA à esquerda e escolha uma skill para vê-la ler as regiões do cérebro que usa.</p>}
        <div className="mt-2 border-t border-fx-800 pt-2">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={`Peça para ${ag.name} pensar com esta skill…`} className="h-14 w-full resize-none border border-fx-800 bg-fx-black p-1.5 text-fx-paper outline-none focus:border-fx-yellow" />
          <label className="my-2 flex items-center gap-2 text-fx-300"><input type="checkbox" checked={delegate} onChange={e => setDelegate(e.target.checked)} className="accent-fx-cyan" />Delegar pelo orquestrador</label>
          <Button size="sm" variant="outline" disabled={!!busyMap[ag.id] || !prompt.trim()} onClick={send} className="mt-1 w-full border-fx-cyan bg-fx-950 text-fx-cyan">{busyMap[ag.id] ? `${ag.name} trabalhando…` : `Enviar para ${ag.name}`}</Button>
          {answers[ag.id] && <div className={`mt-1 max-h-36 overflow-auto whitespace-pre-wrap border-l-2 p-1.5 leading-4 ${answers[ag.id]!.ok ? "text-fx-200" : "text-fx-red"}`} style={{ borderColor: fx(ag.c) }}>{answers[ag.id]!.text.replace(/\*\*/g, "")}</div>}
          {Object.values(busyMap).some(Boolean) && <div className="mt-2 space-y-0.5"><div className="text-[11px] uppercase tracking-wide text-fx-600">Trabalhando no núcleo de IA agora</div>{agents.filter(a => busyMap[a.id]).map(a => <div key={a.id} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: fx(a.c) }} /><span style={{ color: fx(a.c) }}>{a.name}</span><span className="text-fx-600">pensando…</span></div>)}</div>}
        </div>
        {log.length > 0 && <div className="mt-2 space-y-0.5 border-t border-fx-800 pt-1 font-mono text-[11px] text-fx-500">{log.map((l, i) => <div key={i} className={i ? "opacity-60" : "text-fx-300"}>› {l}</div>)}</div>}
      </div></Movable>
      <Movable id="orch" title="Orquestrador · brain.md" right={<span className="font-mono text-[11px] text-fx-green">~{estimateTokens(buildBrainIndex(agents))} tokens</span>}>
        <p className="px-3 pt-2 leading-4 text-fx-500">Toda IA lê primeiro este arquivo central, assim entende o vault sem gastar milhões de tokens.</p>
        <pre className="m-3 max-h-48 overflow-auto border border-fx-800 bg-fx-black p-2 font-mono text-[11px] leading-4 text-fx-300">{buildBrainIndex(agents)}</pre>
      </Movable>
      <Movable id="legend" className="bottom-2 left-2 w-48" title="Departamentos → lobos">
        {GROUPS.map((g, i) => (
          <button key={g.id} onClick={() => setHidden(h => { const s = new Set(h); s.has(i) ? s.delete(i) : s.add(i); return s; })} className={`flex w-full justify-between gap-2 px-2 py-0.5 hover:bg-fx-900 ${hidden.has(i) ? "opacity-30" : ""}`}>
            <span className="truncate text-left" style={{ color: fx(g.c) }}>● {g.id}</span><span className="shrink-0 text-fx-500">{regiaoCurta(g.region)} · {g.n} {g.n === 1 ? "agente" : "agentes"}</span>
          </button>
        ))}
        <div className="border-t border-fx-800 px-2 py-1 text-[11px] leading-4 text-fx-500">Cada departamento mora no lobo que faz esse tipo de pensamento.</div>
        <div className="border-t border-fx-800 px-2 py-1 text-fx-cyan">→ role para zoom · arraste</div>
      </Movable>
        </aside>
      </div>
        <Dialog open={menu} onOpenChange={setMenu}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto border-fx-700 bg-fx-950 text-fx-paper">
          <DialogTitle>Conectar IA ao cérebro</DialogTitle>
          <DialogDescription className="text-fx-300">As IAs com chave ficam no Cofre de IAs, logo abaixo do cérebro: a chave é cifrada no servidor e nunca volta para o navegador. Ferramentas como Claude Code e Codex se conectam pela porta MCP e acendem aqui quando trabalham.</DialogDescription>
          <Button asChild className="w-full bg-fx-cyan font-semibold text-fx-black hover:bg-fx-cyan/80"><a href="#cofre" onClick={() => setMenu(false)}>Abrir o Cofre de IAs</a></Button>
          <div className="max-h-40 space-y-0.5 overflow-auto border-t border-fx-800 pt-2 text-xs">{agents.map(a => <div key={a.id} className="flex items-center gap-1"><span style={{ color: fx(a.c) }}>●</span><span className="flex-1 truncate text-fx-300">{a.name}</span><span className="font-mono text-[11px] text-fx-500">{a.id.startsWith("cofre:") ? "cofre" : "ferramenta"}</span>{!a.id.startsWith("cofre:") && <button aria-label={`Remover ${a.name}`} onClick={() => saveAgents(agents.filter(x => x.id !== a.id))} className="text-fx-red">×</button>}</div>)}
            <button onClick={() => saveAgents(DEFAULT_AGENTS)} className="text-[11px] text-fx-600 underline">restaurar padrões</button></div>
          <Button variant="outline" onClick={() => setMenu(false)} className="border-fx-700 bg-fx-900 text-fx-paper">Fechar</Button>
        </DialogContent></Dialog>
      <TaskMonitor tasks={tasks} />
      </div>
    </Panel>
  );
}
