import { AudioLines } from "lucide-react";

/**
 * Jarvis por voz rodava pelo gateway da Lovable e foi desligado na saída da Lovable.
 * Volta usando uma chave própria do Cofre de IAs (voz em tempo real), sem passar por terceiros.
 */
export function JarvisPanel() {
  return (
    <section
      id="jarvis"
      aria-label="Jarvis por voz"
      className="mb-8 scroll-mt-6 border-y border-fx-800 py-5"
    >
      <div className="flex items-center gap-3">
        <AudioLines className="h-6 w-6 text-fx-600" />
        <div>
          <h2 className="text-lg font-medium text-fx-paper">
            Jarvis <span className="text-sm text-fx-300">/ AutoGTEC</span>
          </h2>
          <p className="text-xs text-fx-300">
            Desligado na saída da Lovable. Volta com a sua própria chave de voz cadastrada no Cofre
            de IAs.
          </p>
        </div>
      </div>
    </section>
  );
}
