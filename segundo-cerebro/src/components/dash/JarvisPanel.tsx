import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Play, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";

export function JarvisPanel() {
  const [captions, setCaptions] = useState<{ role: string; text: string }[]>([]);
  const [activity, setActivity] = useState("");
  const [seconds, setSeconds] = useState<number | null>(null);
  const onEvent = (event: LiveEvent) => {
    if ((event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") && typeof event['delta'] === "string") {
      const text = event['delta'];
      const role = event.type === "session.input_transcript.delta" ? "Você" : "Jarvis";
      setCaptions(c => [...c, { role, text }]);
    }
    if (event.type === "app.delegation.pending") setActivity("Jarvis → núcleo de raciocínio · analisando");
    if (event.type === "app.brain.context") setActivity("Jarvis → orquestrador · índice do cérebro consultado");
    if (event.type === "session.output_transcript.delta") setActivity("Jarvis respondendo");
    if (event.type === "app.closed") setActivity("");
    if (typeof event.usage?.seconds === "number") setSeconds(event.usage.seconds);
  };
  const call = useLiveVoice({ onEvent });
  const active = call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  const labels = { idle: "Pronto para conversar", connecting: "Conectando…", connected: "Em conversa", stopping: "Encerrando…", closed: "Conversa encerrada" };
  return <section id="jarvis" aria-label="Jarvis por voz" className="mb-8 scroll-mt-6 border-y border-fx-800 py-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><AudioLines className="h-6 w-6 text-fx-cyan" /><div><h2 className="text-lg font-medium text-fx-paper">Jarvis <span className="text-sm text-fx-300">/ AutoGTEC</span></h2><p role="status" className="text-xs text-fx-300">{labels[call.status]}</p></div></div>
      <div className="flex flex-wrap items-center gap-2">
        {active ? <><Button variant="outline" size="icon" title={call.muted ? "Ativar microfone" : "Silenciar microfone"} aria-label={call.muted ? "Ativar microfone" : "Silenciar microfone"} disabled={call.status === "stopping"} onClick={() => call.setMuted(!call.muted)} className="border-fx-700 bg-fx-950 text-fx-200">{call.muted ? <MicOff /> : <Mic />}</Button><Button variant="outline" onClick={call.stop} disabled={call.status === "stopping"} className="border-fx-red bg-fx-950 text-fx-red"><PhoneOff />Encerrar</Button></> : <Button variant="outline" onClick={() => { setCaptions([]); setSeconds(null); setActivity(""); call.start(); }} className="border-fx-cyan bg-fx-950 text-fx-cyan"><Phone />Conversar com Jarvis</Button>}
        {call.playbackBlocked && <Button variant="outline" onClick={call.resumePlayback} className="border-fx-700 bg-fx-950 text-fx-paper"><Play />Ouvir Jarvis</Button>}
      </div>
    </div>
    <audio ref={call.audioRef} controls className="mt-3 h-8 w-full max-w-sm" aria-label="Áudio do Jarvis" />
    {activity && <p className="mt-3 text-xs text-fx-cyan">{activity}</p>}
    {call.error && <p role="alert" className="mt-3 text-sm text-fx-red">Não foi possível continuar a conversa: {call.error}</p>}
    {captions.length > 0 && <div aria-label="Transcrição da conversa" className="mt-4 max-h-48 space-y-2 overflow-auto border-l border-fx-700 pl-4 text-sm">{captions.map((c, i) => <p key={i}><span className="mr-2 font-medium text-fx-cyan">{c.role}</span><span className="text-fx-200">{c.text}</span></p>)}</div>}
    <p className="mt-3 text-xs text-fx-300">Voz usa créditos de IA, com mínimo de 15 segundos por chamada; análises adicionais têm consumo separado.</p>
    <p className="mt-1 text-xs text-fx-300">Contexto atual: índice demonstrativo do cérebro. Campanhas, notícias, tarefas salvas e arquivos do Obsidian ainda não conectados.</p>
    {seconds !== null && <p className="mt-2 font-mono text-xs text-fx-300">{Math.max(15, Math.ceil(seconds))}s de voz · {call.finalized ? "uso final recebido" : "uso parcial"}</p>}
  </section>;
}