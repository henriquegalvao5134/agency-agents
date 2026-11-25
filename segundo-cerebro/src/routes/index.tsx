import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, Network, Blocks, Code2, CircleHelp, Palette, SlidersHorizontal, ArrowUpRight, Megaphone, Newspaper, BookOpen } from "lucide-react";
import { Suspense, useEffect } from "react";
import { newsQueryOptions } from "@/lib/news-query";
import { Button } from "@/components/ui/button";
import { GraphPanel } from "@/components/dash/GraphPanel";
import { CanvasPanel } from "@/components/dash/CanvasPanel";
import { ReleasesPanel } from "@/components/dash/ReleasesPanel";
import { PluginPanel } from "@/components/dash/PluginPanel";
import { QuestionsPanel } from "@/components/dash/QuestionsPanel";
import { MinimalPanel } from "@/components/dash/MinimalPanel";
import { FlexokiPanel } from "@/components/dash/FlexokiPanel";
import brandLogo from "@/assets/autogtec-official-logo.png.asset.json";
import brandIcon from "@/assets/autogtec-icon.png.asset.json";
import { JarvisPanel } from "@/components/dash/JarvisPanel";
import { CampaignsPanel } from "@/components/dash/CampaignsPanel";
import { NewsPanel } from "@/components/dash/NewsPanel";
import { NucleoPanel } from "@/components/dash/NucleoPanel";
import { useSessao } from "@/lib/cerebro/use-atividade";
import { ProjetosPanel } from "@/components/dash/ProjetosPanel";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(newsQueryOptions()); },
  errorComponent: () => <div className="p-8 text-fx-paper">Não foi possível abrir o espaço de trabalho. <Button asChild variant="link"><a href="/">Tentar novamente</a></Button></div>,
  notFoundComponent: () => <p className="p-8 text-fx-paper">Página não encontrada.</p>,
  head: () => ({ meta: [
    { title: "AutoGTEC — Segundo cérebro" },
    { name: "description", content: "O segundo cérebro da AutoGTEC: inteligências conectadas, conhecimento organizado e um espaço de trabalho para criar e refletir." },
    { property: "og:title", content: "AutoGTEC — Segundo cérebro" },
    { property: "og:description", content: "Inteligências conectadas em um único espaço AutoGTEC de trabalho, conhecimento e criação." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const NAV = [
  { id: "cerebro", label: "Cérebro", Icon: BrainCircuit },
  { id: "campanhas", label: "Campanhas", Icon: Megaphone },
  { id: "noticias", label: "Notícias e dólar", Icon: Newspaper },
  { id: "canvas", label: "Canvas", Icon: Network },
  { id: "ferramentas", label: "Extensões", Icon: Blocks },
  { id: "codigo", label: "Código", Icon: Code2 },
  { id: "reflexao", label: "Revisão", Icon: CircleHelp },
  { id: "aparencia", label: "Tema", Icon: SlidersHorizontal },
  { id: "cores", label: "Cores", Icon: Palette },
];

function SectionHeading({ n, title, detail }: { n: string; title: string; detail: string }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="flex items-center gap-3"><span className="font-mono text-xs text-brand-blue">{n}</span><h2 className="text-xl font-medium text-fx-paper">{title}</h2></div>
    <span className="text-xs text-fx-300">{detail}</span>
  </div>;
}

function OndeEuParei() {
  const sessao = useSessao();
  const logado = !!sessao.data?.logado;
  // O link do alerta do Claude Code abre /#onde-eu-parei: a seção só existe depois do login, então rola até ela quando aparece.
  useEffect(() => { if (logado && window.location.hash === "#onde-eu-parei") document.getElementById("onde-eu-parei")?.scrollIntoView(); }, [logado]);
  if (!logado) return null;
  return <div id="onde-eu-parei" className="mt-8 scroll-mt-6"><SectionHeading n="01.2" title="Onde eu parei" detail="Projetos e como continuar em outra IA" /><ProjetosPanel /></div>;
}

function Index() {
  return <div className="workspace-shell min-h-screen bg-fx-black text-fx-200">
    <nav aria-label="Espaço de trabalho" className="workspace-rail">
      <a href="#inicio" aria-label="AutoGTEC · Início" className="flex h-11 w-11 shrink-0 items-center justify-center"><img src={brandIcon.url} alt="AutoGTEC" width={44} height={44} className="h-11 w-11 object-contain" /></a>
      <div className="flex gap-1 lg:flex-col lg:gap-3">{NAV.map(({ id, label, Icon }) => <Button asChild key={id} variant="ghost" size="icon" className="text-fx-300 hover:bg-fx-850 hover:text-fx-cyan"><a href={`#${id}`} title={label} aria-label={label}><Icon /></a></Button>)}</div>
      <span className="hidden flex-1 lg:block" />
      <span className="hidden h-2 w-2 rounded-full bg-fx-green lg:block" aria-hidden />
    </nav>
    <main id="inicio" className="workspace-main mx-auto w-full max-w-[1640px] px-4 pb-10 pt-6 md:px-8 lg:px-10 lg:pt-8">
      <header className="workspace-brand-header mb-8 border-b border-fx-800 pb-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 text-xs text-fx-300"><img src={brandLogo.url} alt="AutoGTEC" width={235} height={40} className="h-10 w-[235px] max-w-full object-contain object-left" /><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-fx-cyan" />Inteligência compartilhada</span></div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><h1 className="text-3xl font-medium text-fx-paper">AutoGTEC<span className="text-brand-blue"> · </span>Segundo cérebro</h1><p className="mt-2 text-sm text-fx-300">Conhecimento, criação e operação em um só lugar.</p></div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">{[["Núcleo", "01"], ["Fontes de notícias", "06"], ["Plataformas de anúncios", "02"], ["Perguntas", "40"]].map(([label, value]) => <div key={label}><dt className="mb-1 text-xs text-fx-300">{label}</dt><dd className="font-mono text-lg text-fx-paper">{value}</dd></div>)}</dl>
        </div>
      </header>
      <JarvisPanel />
      <section id="cerebro" className="workspace-section">
        <SectionHeading n="01" title="Inteligências conectadas" detail="Um núcleo. Múltiplas perspectivas." />
        <div className="h-[1100px] lg:h-[800px]"><GraphPanel /></div>
        <div className="mt-8"><SectionHeading n="01.1" title="Núcleo ao vivo" detail="Quem está trabalhando, o que fez e quanto gastou" /><NucleoPanel /></div>
        <OndeEuParei />
      </section>
      <section id="campanhas" className="workspace-section">
        <SectionHeading n="02" title="Operação dos clientes" detail="Google Ads e Meta Ads" />
        <CampaignsPanel />
      </section>
      <section id="noticias" className="workspace-section">
        <SectionHeading n="03" title="Radar do dia" detail="Notícias, atualizações e câmbio" />
        <Suspense fallback={<div role="status" className="py-12 text-sm text-fx-300">Consultando fontes de notícias e Banco Central…</div>}><NewsPanel /></Suspense>
      </section>
      <section id="canvas" className="workspace-section">
        <SectionHeading n="04" title="Mesa de ideias" detail="Conexões que viram projetos" />
        <div className="h-[620px]"><CanvasPanel /></div>
      </section>
      <section id="ferramentas" className="workspace-section">
        <SectionHeading n="05" title="Oficina" detail="Referências e laboratório local" />
        <div className="grid gap-6 xl:grid-cols-12"><div className="h-[440px] xl:col-span-5"><ReleasesPanel /></div><div id="codigo" className="h-[440px] scroll-mt-20 xl:col-span-7"><PluginPanel /></div></div>
      </section>
      <section id="reflexao" className="workspace-section">
        <SectionHeading n="06" title="Reflexão e identidade" detail="Refletir. Simplificar. Dar cor." />
        <div className="grid gap-6 lg:grid-cols-3"><div className="h-[440px]"><QuestionsPanel /></div><div id="aparencia" className="h-[440px] scroll-mt-20"><MinimalPanel /></div><div id="cores" className="h-[440px] scroll-mt-20"><FlexokiPanel /></div></div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-fx-800 pt-6 text-xs text-fx-300">
        <div><span>AutoGTEC · Segundo cérebro</span><p className="mt-2 max-w-xl text-sm leading-relaxed">Manual configurável pelo autor. Pessoas e IAs devem avaliar a validade e a viabilidade das orientações, não segui-las cegamente.</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm" className="border-fx-700 text-brand-blue"><Link to="/manual"><BookOpen />Manual de uso e implementação</Link></Button><Button asChild variant="ghost" size="sm" className="text-fx-300"><a href="https://github.com/kepano" target="_blank" rel="noreferrer">Referências no GitHub <ArrowUpRight /></a></Button></div>
      </footer>
    </main>
  </div>;
}
