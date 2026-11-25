import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Atividade, NovoProvedor, Provedor } from "./types";

/** Cliente do painel: fala só com /api/painel (cookie de sessão HttpOnly; nenhuma chave passa pelo navegador depois de cadastrada). */
async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/painel/${caminho}`, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const corpo = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
  return corpo;
}

export type Sessao = { configurado: boolean; logado: boolean };
export function useSessao() {
  return useQuery({
    queryKey: ["painel", "sessao"],
    queryFn: () => pedir<Sessao>("sessao"),
    staleTime: 60_000,
  });
}
export function useEntrar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (senha: string) =>
      pedir("entrar", { method: "POST", body: JSON.stringify({ senha }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["painel"] }),
  });
}
export function useSair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pedir("sair", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["painel"] }),
  });
}

/** Uma única leitura compartilhada do registro do núcleo; o painel e o cérebro usam a mesma, atualizada a cada 5s. */
export function useAtividade() {
  const sessao = useSessao();
  return useQuery({
    queryKey: ["painel", "atividade"],
    queryFn: () => pedir<Atividade>("atividade"),
    enabled: !!sessao.data?.logado,
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

export type FichaResumo = {
  projeto: string;
  titulo: string;
  etapa_atual: string;
  proximo_passo: string;
  atualizado_por: string;
  atualizado_em?: string;
};
export function useFichas() {
  const sessao = useSessao();
  return useQuery({
    queryKey: ["painel", "fichas"],
    queryFn: () => pedir<FichaResumo[]>("fichas"),
    enabled: !!sessao.data?.logado,
    refetchInterval: 15_000,
  });
}

export function useProvedores() {
  const sessao = useSessao();
  return useQuery({
    queryKey: ["painel", "provedores"],
    queryFn: () => pedir<Provedor[]>("provedores"),
    enabled: !!sessao.data?.logado,
  });
}
export function useCofre() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["painel", "provedores"] });
  return {
    adicionar: useMutation({
      mutationFn: (p: NovoProvedor) =>
        pedir<Provedor>("provedores", { method: "POST", body: JSON.stringify(p) }),
      onSuccess: recarregar,
    }),
    remover: useMutation({
      mutationFn: (id: string) =>
        pedir(`provedores/${encodeURIComponent(id)}`, { method: "DELETE" }),
      onSuccess: recarregar,
    }),
    papel: useMutation({
      mutationFn: ({ id, papel }: { id: string; papel: Provedor["papel"] }) =>
        pedir(`provedores/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ papel }),
        }),
      onSuccess: recarregar,
    }),
    testar: useMutation({
      mutationFn: (id: string) =>
        pedir<{ ok: boolean; resposta?: string; erro?: string }>(
          `provedores/${encodeURIComponent(id)}/testar`,
          { method: "POST" },
        ),
    }),
  };
}
