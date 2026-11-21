import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "./Panel";
import { fx } from "./panel-utils";
const P = [["Excalidraw","Editor",4.3],["Dataview","Dados",3.4],["Templater","Automação",3.1],["Tasks","Produtividade",2.8],["Calendar","Produtividade",2.5],["Advanced Tables","Editor",2.2],["Git","Sincronização",2.1],["Style Settings","Aparência",1.9],["Kanban","Produtividade",1.8],["Omnisearch","Busca",1.5],["Iconize","Aparência",1.4],["Outliner","Editor",1.3],["Linter","Editor",1.2],["Periodic Notes","Automação",1.1],["Remotely Save","Sincronização",1.0]] as const;
const T = [["Minimal","purple"],["Things","orange"],["Blue Topaz","blue"],["Primary","cyan"],["AnuPpuccin","magenta"],["California Coast","yellow"]] as const;
export function ReleasesPanel() {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("Todos"); const [tab, setTab] = useState<"plugins" | "themes">("plugins");
  const cats = ["Todos", ...new Set(P.map(p => p[1]))];
  const list = P.filter(p => (cat === "Todos" || p[1] === cat) && p[0].toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel n="03" title="Comunidade Obsidian" sub="catálogo demonstrativo" color="green" right="seleção de referência">
      <div className="flex h-full flex-col gap-2 p-3 text-xs"><p className="text-fx-300">Nomes oficiais das extensões preservados. Valores ilustrativos, sem instalação ou sincronização com seu Obsidian.</p>
        <div className="flex gap-1">{(["plugins", "themes"] as const).map(t => <Button variant="ghost" size="sm" key={t} onClick={() => setTab(t)} className={`px-2 py-0.5 ${tab === t ? "bg-fx-green text-fx-black" : "bg-fx-900 text-fx-300"}`}>{t === "plugins" ? "Extensões" : "Temas"}</Button>)}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="buscar…" className="ml-auto w-28 border border-fx-800 bg-fx-black px-1.5 text-fx-paper outline-none focus:border-fx-green" /></div>
        {tab === "plugins" ? <>
          <div className="flex flex-wrap gap-1">{cats.map(c => <Button variant="ghost" size="sm" key={c} onClick={() => setCat(c)} className={`border px-1.5 ${cat === c ? "border-fx-green text-fx-green" : "border-fx-800 text-fx-500"}`}>{c}</Button>)}</div>
          <div className="flex-1 space-y-1 overflow-auto">{list.map(p => (
            <div key={p[0]} className="grid grid-cols-[130px_1fr_40px] items-center gap-2"><span className="truncate text-fx-200" title={p[0]}>{p[0]}</span>
              <div className="h-2 bg-fx-900"><div className="h-full bg-fx-cyan transition-all" style={{ width: `${(p[2] / 4.3) * 100}%` }} /></div><span className="text-right font-mono tabular-nums text-fx-500">{p[2]}M</span></div>))}
            {!list.length && <p className="text-fx-500">Nenhum plugin encontrado.</p>}</div>
        </> : <div className="grid flex-1 grid-cols-3 gap-2 overflow-auto">{T.filter(t => t[0].toLowerCase().includes(q.toLowerCase())).map(([n, c]) => (
          <div key={n} className="border border-fx-800 bg-fx-900 p-1.5 hover:border-fx-300"><div className="flex h-12 gap-1"><div className="w-3" style={{ background: fx(c) }} /><div className="flex-1 space-y-1"><div className="h-1 w-3/4 bg-fx-700" /><div className="h-1 w-1/2" style={{ background: fx(c) }} /><div className="h-1 bg-fx-800" /></div></div><div className="mt-1 text-fx-300">{n}</div></div>))}</div>}
      </div>
    </Panel>
  );
}
