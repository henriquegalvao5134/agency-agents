import { useState, type ReactNode } from "react";

/** A card docked in the side rail, "plugged" into the brain by a connector on its left edge. */
export function Movable({ children, title, right }: { id: string; className?: string; children: ReactNode; title: ReactNode; right?: ReactNode }) {
  const [min, setMin] = useState(false);
  return <div className="relative border border-fx-800 bg-fx-950 text-xs shadow-lg">
    <span aria-hidden className="absolute -left-4 top-4 h-px w-4 bg-fx-cyan/60" /><span aria-hidden className="absolute -left-[19px] top-[13px] h-2 w-2 rounded-full border border-fx-cyan bg-fx-black" />
    <div className="flex items-center gap-2 border-b border-fx-800 px-3 py-2 text-fx-500">
      <span className="h-1.5 w-1.5 rounded-full bg-fx-cyan" /><span className="font-semibold text-fx-300">{title}</span><span className="ml-auto flex items-center gap-1">{right}<button aria-label={min ? "Expandir" : "Recolher"} onClick={() => setMin(!min)} className="px-1 text-fx-500 hover:text-fx-paper">{min ? "▢" : "–"}</button></span></div>
    {!min && children}</div>;
}
