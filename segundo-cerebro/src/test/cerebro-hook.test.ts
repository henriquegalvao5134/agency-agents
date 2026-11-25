import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const GANCHO = resolve(__dirname, "../../integracoes/claude-code/cerebro-hook.mjs");
const SESSAO = "teste-alerta-onde-eu-parei";
const ESTADO = join(tmpdir(), `cerebro-${SESSAO}.json`);

afterEach(() => rmSync(ESTADO, { force: true }));

describe("gancho do Claude Code: alerta de limite", () => {
  it("manda continuar pela seção Onde eu parei com o link direto para ela", () => {
    writeFileSync(ESTADO, JSON.stringify({ limite_5h_pct: 92 }));
    const env = { ...process.env };
    delete env["CEREBRO_URL"]; // sem núcleo configurado: nada vai para a rede
    delete env["CEREBRO_TOKEN"];
    const r = spawnSync(process.execPath, [GANCHO], {
      input: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: SESSAO,
        cwd: "/tmp/crm-x",
      }),
      env,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const saida = JSON.parse(r.stdout) as { hookSpecificOutput: { additionalContext: string } };
    const texto = saida.hookSpecificOutput.additionalContext;
    expect(texto).toContain("o limite de 5 horas está em 92%");
    expect(texto).toContain(
      "https://henriquegalvao5134-agency-agents-segundo-cerebro.leandrotecnico02.workers.dev/#onde-eu-parei",
    );
  });
});
