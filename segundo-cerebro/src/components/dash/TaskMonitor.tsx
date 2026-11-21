import { Activity, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { isTaskActive, type BrainTask } from "@/lib/brain-routing";

const labels = { routing: "Roteando", running: "Executando", completed: "Concluída", failed: "Falhou" };
export function TaskMonitor({ tasks }: { tasks: BrainTask[] }) {
  const active = tasks.filter(isTaskActive);
  return <section aria-label="Atividade do orquestrador" className="border-t border-fx-800 bg-fx-950 px-4 py-3 text-xs">
    <header className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-semibold text-fx-paper"><Activity className="size-4 text-fx-cyan" />Atividade do orquestrador</h3>
      <span className="text-fx-400">{active.length ? `${active.length} em andamento` : "Nenhuma tarefa em andamento"}</span>
    </header>
    {!tasks.length && <p className="text-fx-500">Aguardando chamadas</p>}
    <div className="max-h-48 space-y-2 overflow-y-auto">
      {tasks.map(t => <details key={t.id} className="border-l-2 border-fx-700 pl-3">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center gap-2 text-fx-300">
            {isTaskActive(t) ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none text-fx-cyan" /> : t.phase === "failed" ? <CircleAlert className="size-3.5 text-fx-red" /> : <CheckCircle2 className="size-3.5 text-fx-green" />}
            <b className={t.phase === "failed" ? "text-fx-red" : "text-fx-cyan"}>{labels[t.phase]}</b>
            <span>{t.source}{t.mode === "delegated" ? ` → Orquestrador${t.target ? ` → ${t.target}` : ""}` : " · execução direta"}{t.skill ? ` · ${t.skill}` : ""}</span>
            <span className="ml-auto font-mono text-fx-500">{new Date(t.startedAt).toLocaleTimeString("pt-BR")} · {Math.max(0, Math.floor(((t.finishedAt ?? Date.now()) - t.startedAt) / 1000))}s</span>
          </div>
          <p className="mt-1 truncate text-fx-400">{t.task}</p>
        </summary>
        <div className="mt-2 space-y-1 pb-2 text-fx-400">
          <p className="break-words text-fx-200">{t.task}</p>
          {t.reason && <p>{t.reason}</p>}
          <ol>{t.events.map((e, i) => <li key={i} className="flex gap-2"><time className="shrink-0 font-mono text-fx-600">{new Date(e.at).toLocaleTimeString("pt-BR")}</time><span>{e.label}</span></li>)}</ol>
          <pre className="overflow-x-auto border-t border-fx-800 pt-2 font-mono text-fx-500">{JSON.stringify({ taskId: t.id, tool: t.toolCallId ? "delegar_tarefa" : null, toolCallId: t.toolCallId, caller: t.sourceId, agentId: t.targetId, skillId: t.skillId, status: t.phase }, null, 2)}</pre>
        </div>
      </details>)}
    </div>
  </section>;
}