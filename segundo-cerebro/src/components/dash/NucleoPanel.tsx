import { Activity, AlertTriangle, Gauge, PlugZap, Radio } from "lucide-react";
import { useAtividade, useSessao } from "@/lib/cerebro/use-atividade";
import { CofreIAs, EntrarPainel } from "./CofreIAs";

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : String(n);
const usd = (n: number) => `US$ ${n.toFixed(2)}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const TIPO: Record<string, string> = {
  inicio: "começou",
  etapa: "etapa",
  delegacao: "delegou",
  checkpoint: "salvou ficha",
  fim: "terminou",
  uso: "consumo",
};

function Barra({ rotulo, pct }: { rotulo: string; pct: number | null }) {
  const cor =
    pct === null
      ? "bg-fx-700"
      : pct >= 85
        ? "bg-fx-red"
        : pct >= 60
          ? "bg-fx-yellow"
          : "bg-fx-cyan";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-fx-300">{rotulo}</span>
        <span className="font-mono text-fx-paper">
          {pct === null ? "—" : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="h-2 w-full bg-fx-850">
        <div className={`h-2 ${cor}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

/** Painel ao vivo do núcleo: quem está trabalhando, o que fez e quanto gastou. Só mostra dados reais do registro. */
export function NucleoPanel() {
  const sessao = useSessao();
  if (sessao.data && !sessao.data.configurado)
    return (
      <div className="flex items-start gap-3 border-y border-fx-800 py-6 text-sm text-fx-300">
        <PlugZap className="mt-0.5 size-4 shrink-0 text-fx-yellow" />
        <p>
          O núcleo ainda não está ligado ao banco da Cloudflare. Assim que o banco e os segredos
          forem configurados, este painel passa a mostrar a atividade e o consumo reais de cada IA
          conectada.
        </p>
      </div>
    );
  if (sessao.data && !sessao.data.logado) return <EntrarPainel />;
  return (
    <>
      <AtividadeAoVivo />
      <CofreIAs />
    </>
  );
}

function AtividadeAoVivo() {
  const { data, isLoading, error } = useAtividade();
  if (error)
    return (
      <p className="flex gap-2 border-y border-fx-800 py-6 text-xs text-fx-red">
        <AlertTriangle className="size-4 shrink-0" />
        {error.message}
      </p>
    );
  if (isLoading || !data)
    return (
      <div role="status" className="border-y border-fx-800 py-8 text-sm text-fx-300">
        Lendo o núcleo…
      </div>
    );
  const totalSemana = data.semana.tokens || 1;
  return (
    <div className="grid gap-6 border-y border-fx-800 py-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-4">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm text-fx-paper">
            <Radio className="size-4 text-fx-green" />
            Trabalhando agora
          </h3>
          {data.ativos.length ? (
            <div className="flex flex-wrap gap-2">
              {data.ativos.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1.5 border border-fx-green/40 px-2 py-0.5 text-xs text-fx-green"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fx-green motion-reduce:animate-none" />
                  {a}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-fx-500">Nenhuma IA ativa nos últimos 3 minutos.</p>
          )}
        </div>
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm text-fx-paper">
            <Gauge className="size-4 text-brand-blue" />
            Limites da assinatura Claude
          </h3>
          <Barra rotulo="Janela de 5 horas" pct={data.limites.limite_5h_pct} />
          <Barra rotulo="Semana" pct={data.limites.limite_7d_pct} />
          <p className="text-[11px] text-fx-500">
            {data.limites.em
              ? `Lido do Claude Code às ${hora(data.limites.em)}`
              : "Aparece quando o Claude Code conectado enviar a primeira leitura."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-fx-300">Hoje</dt>
            <dd className="font-mono text-lg text-fx-paper">{fmt(data.hoje.tokens)}</dd>
            <dd className="text-[11px] text-fx-500">{usd(data.hoje.custo_usd)} estimado</dd>
          </div>
          <div>
            <dt className="text-xs text-fx-300">7 dias</dt>
            <dd className="font-mono text-lg text-fx-paper">{fmt(data.semana.tokens)}</dd>
            <dd className="text-[11px] text-fx-500">{usd(data.semana.custo_usd)} estimado</dd>
          </div>
        </dl>
      </div>
      <div className="lg:col-span-3">
        <h3 className="mb-2 text-sm text-fx-paper">Consumo por agente (7 dias)</h3>
        {!data.consumo.length && <p className="text-xs text-fx-500">Sem consumo registrado.</p>}
        <ul className="space-y-2">
          {data.consumo.slice(0, 8).map((c) => {
            const parte = c.tokens / totalSemana,
              alto = parte >= 0.4 && data.consumo.length > 1;
            return (
              <li key={`${c.ferramenta}-${c.agente}`} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className={`truncate ${alto ? "text-fx-yellow" : "text-fx-200"}`}>
                    {c.agente}
                    {c.agente !== c.ferramenta && (
                      <span className="text-fx-500"> · {c.ferramenta}</span>
                    )}
                  </span>
                  <span className="font-mono text-fx-paper">{fmt(c.tokens)}</span>
                </div>
                <div className="mt-1 h-1 bg-fx-850">
                  <div
                    className={`h-1 ${alto ? "bg-fx-yellow" : "bg-brand-blue"}`}
                    style={{ width: `${Math.round(parte * 100)}%` }}
                  />
                </div>
                {alto && (
                  <p className="mt-1 text-[11px] text-fx-yellow">
                    Consumo alto: vale revisar o prompt ou usar um modelo menor na execução.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="lg:col-span-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm text-fx-paper">
          <Activity className="size-4 text-fx-cyan" />
          Linha do tempo
        </h3>
        {!data.eventos.length && (
          <p className="text-xs text-fx-500">Nenhuma atividade registrada ainda.</p>
        )}
        <ol className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {data.eventos.slice(0, 30).map((e) => (
            <li key={e.id} className="grid grid-cols-[3rem_1fr_auto] gap-2 text-xs">
              <time className="font-mono text-fx-500">{hora(e.criado_em)}</time>
              <span className="min-w-0">
                <span className="text-fx-cyan">{e.ferramenta}</span>
                {e.agente && <span className="text-fx-300"> → {e.agente}</span>}{" "}
                <span className="text-fx-500">{TIPO[e.tipo] ?? e.tipo}</span>
                {e.projeto && <span className="text-brand-blue"> · {e.projeto}</span>}
                <span className="block truncate text-fx-300">{e.descricao}</span>
              </span>
              <span className="font-mono text-fx-500">
                {e.tokens_entrada + e.tokens_saida + e.tokens_cache
                  ? fmt(e.tokens_entrada + e.tokens_saida + e.tokens_cache)
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
