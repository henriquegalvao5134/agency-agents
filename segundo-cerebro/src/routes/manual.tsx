import { createFileRoute, Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import manual from "../../MANUAL.md?raw";

export const Route = createFileRoute("/manual")({
  head: () => ({ meta: [
    { title: "Manual de uso e implementação — AutoGTEC" },
    { name: "description", content: "Guia configurável do segundo cérebro AutoGTEC: uso dos módulos, implementação, limites e avaliação crítica para leitores e IAs." },
    { property: "og:title", content: "Manual de uso e implementação — AutoGTEC" },
    { property: "og:description", content: "Entenda cada módulo e adapte o segundo cérebro AutoGTEC com orientações verificáveis, não regras inflexíveis." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ManualPage,
});

function ManualPage() {
  const download = () => {
    const url = URL.createObjectURL(new Blob([manual], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "MANUAL-AutoGTEC.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 text-fx-200 md:px-10">
    <nav aria-label="Navegação do manual" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-fx-800 pb-5">
      <Button asChild variant="ghost" className="text-fx-200"><Link to="/"><ArrowLeft />Voltar ao cérebro</Link></Button>
      <Button variant="outline" onClick={download} className="border-fx-700 bg-fx-950 text-brand-blue"><Download />Baixar manual</Button>
    </nav>
    <div className="mb-5 flex items-center gap-2 text-sm text-brand-blue"><BookOpen className="size-4" />AutoGTEC · Documentação</div>
    <article className="manual-content"><ReactMarkdown>{manual}</ReactMarkdown></article>
    <footer className="mt-10 border-t border-fx-800 pt-5 text-sm text-fx-300">AutoGTEC · Orientações adaptáveis, capacidades verificáveis.</footer>
  </main>;
}