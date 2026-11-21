import { useState } from "react";
import { Panel, FX } from "./Panel";
import { fx } from "./panel-utils";
const BLOCKS = [[10,8,30,"blue"],[50,14,25,"orange"],[25,26,40,"red"],[60,34,20,"cyan"],[15,46,35,"magenta"],[55,56,30,"blue"],[30,68,25,"yellow"],[10,80,40,"red"],[60,86,22,"purple"]] as const;
export function MinimalPanel() {
  const [after, setAfter] = useState(true); const [accent, setAccent] = useState("purple"); const [width, setWidth] = useState(70); const [size, setSize] = useState(12);
  return (
    <Panel n="06" title="minimal" sub="o tema limpo" color="purple" right={<button onClick={() => setAfter(!after)} className="underline">{after ? "depois" : "antes"} ⇄</button>}>
      <div className="flex h-full flex-col text-xs">
        <div className="relative flex-1 overflow-hidden bg-fx-black">
          {!after ? BLOCKS.map(([x, y, w, c], i) => <div key={i} className="absolute h-4 opacity-90" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, background: fx(c), transform: `rotate(${(i % 3 - 1) * 4}deg)` }} />) :
            <div className="mx-auto h-full overflow-hidden py-3 text-fx-200" style={{ width: `${width}%`, fontSize: size }}>
              <div className="font-bold text-fx-paper" style={{ fontSize: size * 1.5 }}>Escrita</div>
              <p className="mt-1 leading-relaxed text-fx-300">Calmo, focado, nada no caminho. Links ficam assim: <span style={{ color: fx(accent) }}>[[isto]]</span>.</p>
              <div className="mt-2 border-l-2 pl-2 italic text-fx-500" style={{ borderColor: fx(accent) }}>Interfaces silenciosas abrem espaço para ideias barulhentas.</div>
              <div className="mt-2 flex gap-1"><span className="px-1" style={{ background: fx(accent), color: fx("black") }}>#revisão</span><span className="border px-1" style={{ borderColor: fx(accent), color: fx(accent) }}>#ideias</span></div>
            </div>}
          <div className="absolute bottom-1 left-2 text-fx-red">{after ? "" : "bagunçado"}</div><div className="absolute bottom-1 right-2 text-fx-purple">{after ? "minimal" : ""}</div>
        </div>
        <div className="space-y-1 border-t border-fx-800 p-2">
          <div className="flex gap-1">{FX.map(c => <button key={c} aria-label={c} onClick={() => setAccent(c)} className="h-3 w-3" style={{ background: fx(c), outline: accent === c ? `1px solid ${fx("paper")}` : "none" }} />)}</div>
          <label className="flex items-center gap-2 text-fx-500">largura<input type="range" min={40} max={95} value={width} onChange={e => setWidth(+e.target.value)} className="flex-1 accent-fx-purple" /></label>
          <label className="flex items-center gap-2 text-fx-500">fonte<input type="range" min={9} max={16} value={size} onChange={e => setSize(+e.target.value)} className="flex-1 accent-fx-purple" /></label>
        </div>
      </div>
    </Panel>
  );
}
