import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lerAtividade } from "./atividade.functions";

/** Uma única leitura compartilhada do registro do núcleo; o painel e o cérebro usam a mesma, atualizada a cada 5s. */
export function useAtividade() {
  const ler = useServerFn(lerAtividade);
  return useQuery({
    queryKey: ["cerebro", "atividade"],
    queryFn: () => ler(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });
}
