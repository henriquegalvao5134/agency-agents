import { useEffect, useState } from "react";
import { Panel, FX } from "./Panel";
import { fx } from "./panel-utils";
const QS = ["Qual foi o melhor momento do ano?","O que você aprendeu sobre si mesmo?","Qual hábito mais te ajudou?","O que você faria diferente?","Quem mais te influenciou?","Qual livro mudou sua forma de pensar?","O que você criou?","Do que você abriu mão?","Para onde você viajou?","Do que você se orgulhou?"];
const q = (i: number) => `${QS[i % QS.length]}${i >= 10 ? ` (${["trabalho","saúde","pessoas"][Math.floor(i / 10) - 1]})` : ""}`;
export function QuestionsPanel() {
  const [cur, setCur] = useState(0); const [ans, setAns] = useState<Record<number, string>>({});
  useEffect(() => { try { setAns(JSON.parse(localStorage.getItem("yr-review") || "{}")); } catch { /* ignore */ } }, []);
  const save = (v: string) => { const n = { ...ans, [cur]: v }; setAns(n); localStorage.setItem("yr-review", JSON.stringify(n)); };
  const done = Object.values(ans).filter(v => v.trim()).length;
  const R = 70, r = 54;
  return (
    <Panel n="05" title="40 perguntas" sub="revisão anual" color="orange" right="kepano">
      <div className="flex h-full flex-col items-center gap-1 p-2 text-xs">
        <svg viewBox="-80 -80 160 160" className="h-40 w-40">
          {Array.from({ length: 40 }, (_, i) => { const a0 = (i / 40) * Math.PI * 2 - Math.PI / 2 + .02, a1 = ((i + 1) / 40) * Math.PI * 2 - Math.PI / 2 - .02; const p = (a: number, rad: number) => `${Math.cos(a) * rad},${Math.sin(a) * rad}`;
            const filled = ans[i]?.trim(); return <path key={i} onClick={() => setCur(i)} className="cursor-pointer transition-opacity hover:opacity-70" d={`M${p(a0, R)} A${R},${R} 0 0 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 0 0 ${p(a0, r)}z`} fill={filled ? fx(FX[Math.floor(i / 5)]!) : fx("800")} stroke={i === cur ? fx("paper") : "none"} strokeWidth={1.5} />; })}
          <text textAnchor="middle" y={6} fontSize={22} fontWeight={700} fill={fx("yellow")}>{cur + 1}</text>
          <text textAnchor="middle" y={20} fontSize={7} fill={fx("500")}>{done} de 40 respondidas</text>
        </svg>
        <div className="w-full flex-1 border border-fx-800 bg-fx-black p-1.5">
          <div className="flex items-center gap-1 text-fx-paper"><button onClick={() => setCur((cur + 39) % 40)} className="text-fx-orange">◀</button><span className="flex-1">{cur + 1}. {q(cur)}</span><button onClick={() => setCur((cur + 1) % 40)} className="text-fx-orange">▶</button></div>
          <textarea value={ans[cur] ?? ""} onChange={e => save(e.target.value)} placeholder="Escreva sua resposta…" className="mt-1 h-12 w-full resize-none bg-transparent text-fx-300 outline-none" />
        </div>
      </div>
    </Panel>
  );
}
