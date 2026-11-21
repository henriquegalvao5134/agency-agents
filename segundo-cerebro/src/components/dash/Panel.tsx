import type { ReactNode } from "react";
import { fx } from "./panel-utils";
export const FX = ["red","orange","yellow","green","cyan","blue","purple","magenta"] as const;
export function Panel({ n, title, sub, right, color, children, className = "" }: { n: string; title: string; sub: string; right?: ReactNode; color: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden bg-fx-950 ${className}`}>
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b border-fx-800 px-4 py-3 text-xs">
        <span className="font-mono text-[11px]" style={{ color: fx(color) }}>{n}</span>
        <span className="font-semibold text-fx-paper">{title}</span>
        <span className="text-fx-300">{sub}</span>
        <span className="ml-auto text-[11px] font-medium" style={{ color: fx(color) }}>{right}</span>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
