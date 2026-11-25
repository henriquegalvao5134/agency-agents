import { useState } from "react";
import { AlertTriangle, Copy, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtividade, useFichas, useSessao, type FichaResumo } from "@/lib/cerebro/use-atividade";
import {
  comandoContinuar,
  haQuantoTempo,
  ligarFerramenta,
  maiorLimite,
  precisaTrocar,
  quandoLido,
  SITE_CEREBRO,
  type FerramentaIA,
} from "@/lib/cerebro/continuar";

const ABAS: { id: FerramentaIA; rotulo: string }[] = [
  { id: "claude-code", rotulo: "Claude Code" },
  { id: "claude-app", rotulo: "Claude (site/app)" },
  { id: "codex", rotulo: "Codex" },
  { id: "gemini", rotulo: "Gemini" },
];

/** `trocar`: o limite do Claude está alto, então "Continuar em outra IA" já abre na aba Codex. */
function Cartao({ ficha, trocar }: { ficha: FichaResumo; trocar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<FerramentaIA>("claude-code");
  const [aviso, setAviso] = useState("");
  const comando = comandoContinuar(aba, ficha.projeto);
  const site = typeof window === "undefined" ? SITE_CEREBRO : window.location.origin;
  const ligar = ligarFerramenta(aba, site);
  const quando = haQuantoTempo(ficha.atualizado_em);

  const copiar = async (texto: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(`${qual} copiado`);
    } catch {
      setAviso("Copie manualmente");
    }
  };

  return (
    <article data-projeto={ficha.projeto} className="border border-fx-800 bg-fx-950 p-4">
      <h3 className="text-sm font-medium text-fx-paper">{ficha.titulo}</h3>
      <p className="mt-1 font-mono text-xs text-fx-300">{ficha.projeto}</p>
      <p className="mt-3 text-sm text-fx-200">{`Etapa: ${ficha.etapa_atual || "não informada"}`}</p>
      <p className="mt-1 text-sm text-fx-200">{`Próximo passo: ${ficha.proximo_passo || "não informado"}`}</p>
      <p className="mt-2 text-xs text-fx-300">
        {`Salvo por ${ficha.atualizado_por || "desconhecido"}${quando ? ` ${quando}` : ""}`}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 gap-2"
        aria-expanded={aberto}
        onClick={() => {
          if (!aberto) {
            setAba(trocar ? "codex" : "claude-code");
            setAviso("");
          }
          setAberto((v) => !v);
        }}
      >
        <Repeat className="size-3.5" />
        Continuar em outra IA
      </Button>
      {aberto && (
        <div className="mt-3 border-t border-fx-800 pt-3">
          <div role="tablist" className="flex flex-wrap gap-1">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => {
                  setAba(a.id);
                  setAviso("");
                }}
                className={`border px-3 py-1 text-xs ${
                  aba === a.id
                    ? "border-fx-cyan text-fx-paper"
                    : "border-fx-800 text-fx-300 hover:text-fx-paper"
                }`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-fx-paper">
            1. Ligar ao cérebro (só na primeira vez)
          </p>
          <p className="mt-1 text-xs text-fx-300">{ligar.como}</p>
          <pre className="mt-2 border border-fx-800 bg-fx-black p-2 font-mono text-xs break-words whitespace-pre-wrap text-fx-200">
            {ligar.comando}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 gap-2"
            onClick={() => copiar(ligar.comando, "Comando de ligar")}
          >
            <Copy className="size-3.5" />
            Copiar comando de ligar
          </Button>
          <p className="mt-4 text-xs font-medium text-fx-paper">
            2. Colar na IA para continuar daqui
          </p>
          <p className="mt-2 border border-fx-800 bg-fx-black p-2 font-mono text-xs break-words text-fx-200">
            {comando}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => copiar(comando, "Texto")}
            >
              <Copy className="size-3.5" />
              Copiar texto
            </Button>
            {aviso && (
              <span role="status" className="text-xs text-fx-300">
                {aviso}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** "Onde eu parei": projetos com ficha salva e o texto para continuar em outra IA. Só aparece logado. */
export function ProjetosPanel() {
  const sessao = useSessao();
  const fichas = useFichas();
  const atividade = useAtividade();
  if (!sessao.data?.logado) return null;

  const limites = atividade.data?.limites;
  // Leitura velha (5h com mais de 5 h, semanal com mais de 7 dias) não conta: precisaTrocar a ignora.
  const trocar = !!limites && precisaTrocar(limites);
  const lido = limites ? quandoLido(limites.em) : "";
  const lista = fichas.data ?? [];
  return (
    <div className="space-y-4">
      {limites && trocar && (
        <p className="flex items-center gap-2 border border-fx-800 bg-fx-950 p-3 text-sm text-fx-paper">
          <AlertTriangle className="size-4 shrink-0 text-fx-red" />
          {`Seu limite do Claude está em ${Math.round(maiorLimite(limites))}% — salve e continue no Codex ou no Gemini.${lido ? ` (lido ${lido})` : ""}`}
        </p>
      )}
      {lista.length === 0 && fichas.isError ? (
        <p role="alert" className="text-sm text-fx-red">
          Não foi possível carregar os projetos. Recarregue a página ou entre de novo.
        </p>
      ) : lista.length === 0 && !fichas.isLoading ? (
        <p className="text-sm text-fx-300">
          Nenhum projeto com ficha ainda. Peça para a IA salvar a ficha (salvar_ficha) ao trabalhar
          num projeto.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((f) => (
            <Cartao key={f.projeto} ficha={f} trocar={trocar} />
          ))}
        </div>
      )}
    </div>
  );
}
