import { useState } from "react";
import { Panel } from "./Panel";
import { fx } from "./panel-utils";
const SW = [["Preto","black","#100F0F"],["200","200","#CECDC3"],["400","500","#878580"],["600","700","#575653"],["Papel","paper","#FFFCF0"],["Vermelho","red","#D14D41"],["Laranja","orange","#DA702C"],["Amarelo","yellow","#D0A215"],["Verde","green","#879A39"],["Ciano","cyan","#3AA99F"],["Azul","blue","#4385BE"],["Roxo","purple","#8B7EC8"],["Magenta","magenta","#CE5D97"]] as const;
export function FlexokiPanel() {
  const [light, setLight] = useState(true); const [pick, setPick] = useState<(typeof SW)[number]>(SW[11]); const [copied, setCopied] = useState(false);
  const bg = light ? fx("paper") : fx("black"), fg = light ? fx("black") : fx("200"), mute = light ? fx("500") : fx("600");
  return (
    <Panel n="07" title="flexoki" sub="as cores dele para escrita + código" color="yellow" right={<button onClick={() => setLight(!light)} className="underline">{light ? "claro" : "escuro"} ◐</button>}>
      <div className="flex h-full flex-col gap-2 p-2 text-xs">
        <div className="grid grid-cols-13 gap-0.5" style={{ gridTemplateColumns: "repeat(13,1fr)" }}>{SW.map(s => (
          <button key={s[0]} title={s[0]} onClick={() => { setPick(s); navigator.clipboard?.writeText(s[2]); setCopied(true); setTimeout(() => setCopied(false), 900); }} className="h-7 border" style={{ background: fx(s[1]), borderColor: pick[0] === s[0] ? fx("paper") : "transparent" }} />))}</div>
        <div className="text-fx-500"><span style={{ color: fx(pick[1]) }}>■ {pick[0].toLowerCase()}</span> {pick[2]} {copied && <span className="text-fx-green">· copiado</span>}</div>
        <div className="flex-1 overflow-hidden border-l-4 p-2 font-mono leading-5 transition-colors" style={{ background: bg, color: fg, borderColor: fx(pick[1]) }}>
          <div className="font-bold" style={{ color: fx(pick[1]) }}># Escrita</div>
          <div><span style={{ color: fx("magenta") }}>def</span> <span style={{ color: fx("orange") }}>review</span>(year):</div>
          <div>&nbsp;&nbsp;<span style={{ color: fx("magenta") }}>for</span> q <span style={{ color: fx("magenta") }}>in</span> questions:</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;note.<span style={{ color: fx("blue") }}>add</span>(q)</div>
          <div>&nbsp;&nbsp;<span style={{ color: fx("magenta") }}>return</span> <span style={{ color: fx("cyan") }}>"done"</span></div>
          <div className="mt-1 italic" style={{ color: mute }}>// cores calmas, suaves para os olhos</div>
        </div>
      </div>
    </Panel>
  );
}
