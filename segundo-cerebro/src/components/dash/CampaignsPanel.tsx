import { useState } from "react";
import { ArrowUpRight, Megaphone, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { name: "Google Ads", url: "https://ads.google.com/", reach: "Pesquisa e canais Google" },
  { name: "Meta Ads", url: "https://business.facebook.com/adsmanager/", reach: "Facebook e Instagram" },
] as const;
export function CampaignsPanel() {
  const [provider, setProvider] = useState("Todos");
  return <div className="border-y border-fx-800 py-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-fx-200"><Megaphone className="size-4 text-brand-blue" />Campanhas dos clientes</div><div className="flex gap-1" aria-label="Filtrar plataforma">{["Todos", "Google Ads", "Meta Ads"].map(p => <Button key={p} size="sm" variant="ghost" aria-pressed={provider === p} onClick={() => setProvider(p)} className={provider === p ? "bg-fx-850 text-brand-blue" : "text-fx-300"}>{p}</Button>)}</div></div>
    <div className="grid gap-4 md:grid-cols-2">{PROVIDERS.filter(p => provider === "Todos" || p.name === provider).map(p => <article key={p.name} className="rounded-md border border-fx-800 bg-fx-950 p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-fx-paper">{p.name}</h3><p className="mt-1 text-xs text-fx-300">{p.reach}</p></div><span className="flex items-center gap-1 text-xs text-fx-yellow"><Unplug className="size-3.5" />Não conectado</span></div>
      <dl className="my-6 grid grid-cols-2 gap-x-6 gap-y-4">{["Investimento", "Impressões", "Cliques", "Resultados"].map(label => <div key={label}><dt className="text-xs text-fx-300">{label}</dt><dd className="mt-1 font-mono text-xl text-fx-600">—</dd></div>)}</dl>
      <div className="border-t border-fx-800 pt-4"><p className="mb-3 text-sm leading-relaxed text-fx-300">Nenhuma conta vinculada a este projeto. Métricas, período e contexto de cliente aguardam conexão; nenhum resultado está sendo analisado.</p><Button variant="outline" size="sm" asChild className="border-fx-700 bg-fx-900 text-fx-200"><a href={p.url} target="_blank" rel="noreferrer">Abrir {p.name}<ArrowUpRight /></a></Button></div>
    </article>)}</div>
  </div>;
}