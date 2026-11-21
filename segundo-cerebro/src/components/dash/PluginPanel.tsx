import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "./Panel";
const CODE = `import { Plugin } from 'obsidian';

export default class WordGoal extends Plugin {
  goal = 500;
  async onload() {
    this.addRibbonIcon('target', 'Meta de palavras', () => {
      new GoalModal(this.app).open();
    });
    this.addStatusBarItem().setText('meta: ' + this.goal);
  }
}`;
const KW = /\b(import|from|export|default|class|extends|async|await|new|this|const|let|return|function)\b/g;
function hl(src: string) {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc.split(/('(?:[^'\\]|\\.)*'|\/\/.*$)/m).map((part, i) => i % 2 ? `<span class="text-fx-cyan">${part}</span>` :
    part.replace(KW, '<span class="text-fx-magenta">$1</span>').replace(/\b(\d+)\b/g, '<span class="text-fx-orange">$1</span>').replace(/\b([A-Z]\w+)\b/g, '<span class="text-fx-yellow">$1</span>')).join("");
}
export function PluginPanel() {
  const [code, setCode] = useState(CODE); const [log, setLog] = useState<string[]>(["Simulador local"]); const [ran, setRan] = useState<number | null>(null);
  const pre = useRef<HTMLPreElement>(null);
  const run = () => {
    const goal = Number(/goal\s*=\s*(\d+)/.exec(code)?.[1] ?? NaN);
    const ok = /extends Plugin/.test(code) && /onload/.test(code);
    setLog(["Simulador local", "Análise da estrutura de main.ts", ok ? `✓ estrutura reconhecida` : "✗ erro: a classe precisa estender Plugin com onload()", ok ? `✓ prévia simulada · meta=${isNaN(goal) ? "?" : goal}` : ""].filter(Boolean));
    setRan(ok ? goal : null);
  };
  return (
    <Panel n="04" title="Laboratório de extensões" sub="exemplo TypeScript" color="orange" right="simulação local">
      <div className="grid h-full grid-cols-[minmax(0,1fr)_145px] text-xs">
        <div className="flex min-h-0 flex-col border-r border-fx-800">
          <div className="flex items-center border-b border-fx-800 px-2 py-1 text-fx-500 font-mono">main.ts<Button variant="ghost" size="sm" onClick={run} className="ml-auto bg-fx-orange px-2 font-bold text-fx-black hover:opacity-80">▶ SIMULAR</Button></div>
          <div className="relative flex-1 overflow-hidden">
            <pre ref={pre} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-2 leading-4 text-fx-200" dangerouslySetInnerHTML={{ __html: hl(code) + "\n" }} />
            <textarea spellCheck={false} style={{fontFamily:"var(--font-mono)"}} value={code} onChange={e => setCode(e.target.value)} onScroll={e => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft; } }}
              className="absolute inset-0 resize-none whitespace-pre bg-transparent p-2 leading-4 text-transparent caret-fx-orange outline-none" />
          </div>
          <pre className="font-mono h-16 border-t border-fx-800 bg-fx-black p-2 leading-4 text-fx-green">{log.join("\n")}</pre>
        </div>
        <div className="p-2"><div className="font-mono text-fx-500">Diário/exemplo.md</div>
          <div className="mt-2 space-y-1">{[80, 60, 90, 40, 70].map((w, i) => <div key={i} className="h-1 bg-fx-700" style={{ width: `${w}%` }} />)}</div>
          {ran !== null ? <div className="mt-3 border border-fx-orange p-1.5 text-fx-orange">◎ Meta de palavras: 212 / {isNaN(ran) ? "?" : ran}<div className="mt-1 h-1 bg-fx-800"><div className="h-full bg-fx-orange" style={{ width: `${isNaN(ran) ? 0 : Math.min(100, 21200 / ran)}%` }} /></div></div> : <p className="mt-3 text-fx-600">Exemplo de extensão do Obsidian. Simular valida a estrutura do código; não compila, instala ou importa arquivos do seu cofre.</p>}
        </div>
      </div>
    </Panel>
  );
}
