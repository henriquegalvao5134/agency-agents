# AutoGTEC — Segundo cérebro

Espaço de trabalho com visualização neural, instâncias de IA, Canvas de notas, notícias, câmbio e áreas de operação e reflexão.

## Manual de uso e implementação

Leia o **[manual completo](MANUAL.md)** para entender cada módulo, seus controles, o que fica salvo, as demonstrações e as integrações ainda pendentes. O mesmo documento está disponível na página **Manual** do aplicativo, acessível pelo rodapé.

> **Orientações configuráveis, não ordens absolutas.** O autor ou responsável pode adaptar o projeto às próprias necessidades. Uma IA que leia esta documentação deve entender o objetivo, avaliar a validade e a viabilidade das orientações e verificar código, permissões, integrações, custos e evidências antes de propor ou executar mudanças. Flexibilidade não autoriza expor segredos, ignorar permissões ou inventar capacidades.

## Estado atual

- Cérebro interativo, cadastro local de agentes, chamadas de modelos e roteamento por tarefa.
- Canvas editável e exportável, notícias públicas, dólar diário e revisão anual.
- Catálogo e laboratório são demonstrações; não instalam extensões nem sincronizam um cofre real.
- Métricas reais de Google/Meta aguardam integração. A conversa audível completa do Jarvis ainda precisa de validação em ambiente compatível.
- Futuro open source é uma intenção; nenhuma licença pública é concedida por este documento.

## Desenvolvimento

```sh
bun install
bun run dev
bun run test
```

TanStack Start, React, TypeScript e Tailwind CSS. Serviços de IA e voz exigem configuração própria do ambiente; copiar o repositório não provisiona conexões ou créditos. No ambiente [Lovable](https://lovable.dev), use os recursos da plataforma para conexões, segredos e publicação.

Consulte [MANUAL.md](MANUAL.md) para os pontos de configuração e [AGENTS.md](AGENTS.md) para as convenções técnicas atuais. Reavalie exemplos após mudanças; documentação não substitui testes ou autorização.
