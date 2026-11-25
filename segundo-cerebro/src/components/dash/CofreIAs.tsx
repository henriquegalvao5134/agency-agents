import { useState, type FormEvent } from "react";
import { KeyRound, Lock, LogOut, PlugZap, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCofre, useEntrar, useProvedores, useSair } from "@/lib/cerebro/use-atividade";
import { FORNECEDORES, PAPEIS, type NovoProvedor } from "@/lib/cerebro/types";

const MODELOS_SUGERIDOS: Record<(typeof FORNECEDORES)[number], string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5.5",
  xai: "grok-4",
  google: "gemini-3.8-flash",
};
const ROTULO_PAPEL: Record<string, string> = {
  orquestrador: "Orquestrador",
  planejador: "Planejador",
  executor: "Executor",
  "": "Sem papel",
};
const campo =
  "w-full border border-fx-800 bg-fx-black px-2 py-1.5 text-sm text-fx-paper outline-none focus:border-fx-cyan";

/** Login do painel. A senha fica só no Secret CEREBRO_SENHA_PAINEL da Cloudflare. */
export function EntrarPainel() {
  const [senha, setSenha] = useState("");
  const entrar = useEntrar();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (senha) entrar.mutate(senha, { onSuccess: () => setSenha("") });
  };
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3 border-y border-fx-800 py-6">
      <div className="flex items-center gap-2 text-sm text-fx-200">
        <Lock className="size-4 text-brand-blue" />
        Área protegida: entre para ver a atividade e o cofre de IAs.
      </div>
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-fx-300">
        Senha do painel
        <input
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={campo}
        />
      </label>
      <Button
        type="submit"
        disabled={!senha || entrar.isPending}
        className="bg-fx-cyan font-semibold text-fx-black hover:bg-fx-cyan/80"
      >
        {entrar.isPending ? "Entrando…" : "Entrar"}
      </Button>
      {entrar.error && <p className="w-full text-xs text-fx-red">{entrar.error.message}</p>}
    </form>
  );
}

/** Cofre: cadastra IAs com chave de API. A chave vai cifrada para o banco e nunca volta ao navegador. */
export function CofreIAs() {
  const { data: provedores = [] } = useProvedores();
  const cofre = useCofre();
  const sair = useSair();
  const vazio: NovoProvedor = {
    nome: "",
    fornecedor: "anthropic",
    modelo: MODELOS_SUGERIDOS.anthropic,
    papel: "",
    cor: "cyan",
    chave: "",
  };
  const [form, setForm] = useState<NovoProvedor>(vazio);
  const [teste, setTeste] = useState<Record<string, string>>({});
  const salvar = (e: FormEvent) => {
    e.preventDefault();
    cofre.adicionar.mutate(form, { onSuccess: () => setForm(vazio) });
  };
  const testar = (id: string) => {
    setTeste((t) => ({ ...t, [id]: "testando…" }));
    cofre.testar.mutate(id, {
      onSuccess: (r) =>
        setTeste((t) => ({ ...t, [id]: r.ok ? "chave funcionando" : `falhou: ${r.erro ?? ""}` })),
      onError: (e) => setTeste((t) => ({ ...t, [id]: `falhou: ${e.message}` })),
    });
  };
  return (
    <div id="cofre" className="mt-8 grid scroll-mt-20 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm text-fx-paper">
            <ShieldCheck className="size-4 text-fx-green" />
            Cofre de IAs
          </h3>
          <Button size="sm" variant="ghost" onClick={() => sair.mutate()} className="text-fx-300">
            <LogOut />
            Sair
          </Button>
        </div>
        {!provedores.length && (
          <p className="text-xs text-fx-500">Nenhuma IA com chave cadastrada ainda.</p>
        )}
        <ul className="divide-y divide-fx-800 border-y border-fx-800">
          {provedores.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
              <span className="min-w-32 font-semibold text-fx-paper">{p.nome}</span>
              <span className="font-mono text-fx-300">
                {p.fornecedor}/{p.modelo}
              </span>
              <span className="flex items-center gap-1 font-mono text-fx-500">
                <KeyRound className="size-3" />
                ••••{p.final_chave}
              </span>
              <select
                aria-label={`Papel de ${p.nome}`}
                value={p.papel}
                onChange={(e) =>
                  cofre.papel.mutate({ id: p.id, papel: e.target.value as NovoProvedor["papel"] })
                }
                className="border border-fx-800 bg-fx-950 px-1 text-fx-200"
              >
                {PAPEIS.map((x) => (
                  <option key={x} value={x}>
                    {ROTULO_PAPEL[x]}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => testar(p.id)}
                className="h-7 text-fx-cyan"
              >
                <PlugZap />
                Testar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remover ${p.nome}`}
                onClick={() => cofre.remover.mutate(p.id)}
                className="h-7 text-fx-red"
              >
                <Trash2 />
              </Button>
              {teste[p.id] && (
                <span
                  className={
                    teste[p.id]!.startsWith("falhou")
                      ? "w-full text-fx-red"
                      : "w-full text-fx-green"
                  }
                >
                  {teste[p.id]}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-fx-500">
          A IA com papel <b>Orquestrador</b> é a que escolhe os subagentes quando o Claude Code (ou
          outra IA) chama o cérebro. Use um modelo barato e rápido (Haiku, Flash). O trabalho pesado
          continua na ferramenta que chamou.
        </p>
      </div>
      <form onSubmit={salvar} className="space-y-2 border border-fx-800 p-4 lg:col-span-5">
        <h4 className="text-sm text-fx-paper">Cadastrar IA</h4>
        <input
          aria-label="Nome"
          placeholder="Nome (ex.: Haiku orquestrador)"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className={campo}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Fornecedor"
            value={form.fornecedor}
            onChange={(e) => {
              const fornecedor = e.target.value as NovoProvedor["fornecedor"];
              setForm({ ...form, fornecedor, modelo: MODELOS_SUGERIDOS[fornecedor] });
            }}
            className={campo}
          >
            {FORNECEDORES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            aria-label="Papel"
            value={form.papel}
            onChange={(e) => setForm({ ...form, papel: e.target.value as NovoProvedor["papel"] })}
            className={campo}
          >
            {PAPEIS.map((x) => (
              <option key={x} value={x}>
                {ROTULO_PAPEL[x]}
              </option>
            ))}
          </select>
        </div>
        <input
          aria-label="Modelo"
          placeholder="Modelo (id da API)"
          value={form.modelo}
          onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          className={`${campo} font-mono`}
        />
        <input
          aria-label="Chave de API"
          type="password"
          autoComplete="off"
          placeholder="Chave de API (fica cifrada; não aparece de novo)"
          value={form.chave}
          onChange={(e) => setForm({ ...form, chave: e.target.value })}
          className={`${campo} font-mono`}
        />
        <Button
          type="submit"
          disabled={!form.nome.trim() || form.chave.length < 10 || cofre.adicionar.isPending}
          className="w-full bg-fx-cyan font-semibold text-fx-black hover:bg-fx-cyan/80"
        >
          {cofre.adicionar.isPending ? "Salvando…" : "Salvar no cofre"}
        </Button>
        {cofre.adicionar.error && (
          <p className="text-xs text-fx-red">{cofre.adicionar.error.message}</p>
        )}
      </form>
    </div>
  );
}
