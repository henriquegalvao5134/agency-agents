import { describe, expect, it } from "vitest";
import { build } from "@/components/dash/brain-graph-model";
import {
  buildBrainIndex,
  GROUPS,
  inRegion,
  REGIAO_DO_DEPARTAMENTO,
  type RegionId,
} from "@/components/dash/brain";
import { agentesDoDepartamento } from "@/lib/cerebro/agentes-cliente";
import { DEPARTAMENTOS } from "@/lib/cerebro/agencia";
import agentesJson from "@/lib/cerebro/agentes.json";
import catalogo from "@/lib/cerebro/catalogo.json";
import divisoes from "@/lib/cerebro/divisoes.json";

describe("departamentos e agentes reais ocupam os lobos", () => {
  it("cada departamento é um hub e cada agente real é um neurônio dentro da sua região", () => {
    const { nodes } = build();
    const hubs = nodes.filter((n) => n.hub && n.g >= 0);
    const agentes = nodes.filter((n) => n.agenteId);
    expect(hubs.map((h) => h.label)).toEqual(DEPARTAMENTOS.map((d) => d.rotulo));
    expect(agentes.length).toBe(Object.values(divisoes).reduce((a, b) => a + b, 0));
    expect(
      agentes.find((n) => n.agenteId === "engineering/engineering-backend-architect")!.label,
    ).toBe("Backend Architect");
    for (const n of agentes) expect(inRegion(GROUPS[n.g]!.region, n.tx, n.ty)).toBe(true);
    // hubs de departamentos na mesma região não coincidem
    const frontal = hubs.filter((h) => GROUPS[h.g]!.region === "frontal");
    expect(
      Math.hypot(frontal[0]!.tx - frontal[1]!.tx, frontal[0]!.ty - frontal[1]!.ty),
    ).toBeGreaterThan(20);
    expect(GROUPS.find((g) => g.dep === "dev")).toMatchObject({
      region: "parietal",
      n: 66,
      id: "Desenvolvimento",
    });
    expect(buildBrainIndex([])).toContain("- Desenvolvimento → Lobo parietal");
    expect(buildBrainIndex([])).not.toContain("notas/");
  });

  it("todo hub fica dentro da sua região e hubs que dividem região ficam visivelmente separados", () => {
    const hubs = build().nodes.filter((n) => n.hub && n.g >= 0);
    for (const h of hubs) expect(inRegion(GROUPS[h.g]!.region, h.tx, h.ty)).toBe(true);
    const porRegiao = new Map<RegionId, typeof hubs>();
    for (const h of hubs) {
      const r = GROUPS[h.g]!.region;
      porRegiao.set(r, [...(porRegiao.get(r) ?? []), h]);
    }
    // frontal, occipital, temporal e cerebelo têm dois departamentos cada
    expect([...porRegiao.values()].filter((hs) => hs.length > 1)).toHaveLength(4);
    for (const hs of porRegiao.values())
      for (let i = 0; i < hs.length; i++)
        for (let j = i + 1; j < hs.length; j++)
          expect(Math.hypot(hs[i]!.tx - hs[j]!.tx, hs[i]!.ty - hs[j]!.ty)).toBeGreaterThan(20);
  });

  it("cada neurônio de agente aparece uma vez, no grupo do seu departamento, ligado à rede", () => {
    const { nodes, links } = build();
    const agentes = nodes.filter((n) => n.agenteId);
    expect(new Set(agentes.map((n) => n.agenteId)).size).toBe(agentes.length);
    for (const g of GROUPS) {
      const doGrupo = agentes.filter((n) => GROUPS[n.g] === g);
      expect(doGrupo.map((n) => ({ id: n.agenteId, nome: n.label }))).toEqual(
        agentesDoDepartamento(g.dep),
      );
      expect(doGrupo).toHaveLength(g.n);
    }
    const ligados = new Set(links.flat());
    for (const n of agentes) expect(ligados.has(n.id)).toBe(true);
  });

  it("GROUPS segue DEPARTAMENTOS com a região, a cor e o total reais", () => {
    expect(GROUPS.map((g) => g.dep)).toEqual(DEPARTAMENTOS.map((d) => d.id));
    expect(REGIAO_DO_DEPARTAMENTO).toEqual({
      estrategia: "frontal",
      produto: "frontal",
      dev: "parietal",
      design: "occipital",
      midia: "occipital",
      marketing: "temporal",
      vendas: "temporal",
      qualidade: "cerebellum",
      especialistas: "cerebellum",
      seguranca: "brainstem",
    });
    for (const [i, d] of DEPARTAMENTOS.entries())
      expect(GROUPS[i]).toEqual({
        id: d.rotulo,
        dep: d.id,
        c: d.cor,
        n: agentesDoDepartamento(d.id).length,
        region: REGIAO_DO_DEPARTAMENTO[d.id],
      });
    // divisões fora de DEPARTAMENTOS (academic, gis, ...) caem em Especialistas
    expect(GROUPS.find((g) => g.dep === "especialistas")!.n).toBe(
      divisoes.academic +
        divisoes["game-development"] +
        divisoes.gis +
        divisoes.healthcare +
        divisoes.research +
        divisoes["spatial-computing"],
    );
    expect(GROUPS.find((g) => g.dep === "vendas")!.n).toBe(divisoes.sales + divisoes.support);
  });

  it("agentesDoDepartamento manda divisões fora de DEPARTAMENTOS para especialistas", () => {
    expect(agentesDoDepartamento("especialistas").map((a) => a.id)).toContain(
      "academic/academic-anthropologist",
    );
    expect(agentesDoDepartamento("dev").every((a) => a.id.startsWith("engineering/"))).toBe(true);
    const todos = DEPARTAMENTOS.flatMap((d) => agentesDoDepartamento(d.id).map((a) => a.id));
    expect(todos.sort()).toEqual(catalogo.map((a) => a.id).sort());
  });

  it("buildBrainIndex lista departamentos → regiões e manda registrar na ficha", () => {
    const indice = buildBrainIndex([]);
    expect(indice).toContain("## Departamentos → regiões");
    expect(indice).not.toContain("## Pastas → regiões");
    expect(indice).toContain(
      "- Desenvolvimento → Lobo parietal (integração · estrutura), 66 agentes",
    );
    for (const g of GROUPS) expect(indice).toContain(`- ${g.id} → `);
    expect(indice).toContain("- Registre decisões e progresso na ficha do projeto (salvar_ficha).");
    expect(indice).not.toContain("wikilinks");
  });
});

describe("agentes.json sem deriva", () => {
  it("é o catalogo.json agrupado por divisão, só com id e nome, na ordem do catálogo", () => {
    const esperado: Record<string, { id: string; nome: string }[]> = {};
    for (const a of catalogo) (esperado[a.divisao] ??= []).push({ id: a.id, nome: a.nome });
    expect(agentesJson).toEqual(esperado);
  });
});
