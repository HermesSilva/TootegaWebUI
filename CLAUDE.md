# Tootega WebUI — diretivas do repositório

> Este repositório (`github.com/Tootega/TootegaWebUI`) é o **motor do front** dos SaaS da Tootega: o pacote
> `@Tootega/core` (React 19 + Vite + TypeScript) e o design system. Nasceu em 2026-10-30 (D56) do `Front/Core`
> do `TootegaCore`. Cada SaaS faz checkout dele **na própria raiz**, na pasta `TootegaWebUI`, e o App do SaaS o
> referencia por `file:../../TootegaWebUI` e pelo apelido `@core`. O `README.md` diz como um SaaS o consome.

## 1. O que vale aqui

As regras vinculantes do front são as do SaaS que o consome — hoje o Tootega ERP (`d:\Tootega\Source\TootegaERP`,
`CLAUDE.md` e skills `tootega-front`, `tootega-convencoes`, `tootega-relatorios`). Ao trabalhar neste
repositório com o ERP ao lado, **carregue a skill `tootega-front` do ERP**: contenção de modal, dimensões FE-#,
WCAG 2.2 AA, registros por nome, extensão do motor. O que segue é o núcleo que não pode faltar nem com o
repositório aberto sozinho.

- **O motor não conhece SaaS nenhum** (binária). Nada aqui cita módulo de produto, tabela, rota de produto ou
  texto de negócio. Componente de domínio mora no App do SaaS e se registra por nome nos registros do motor
  (`XFieldEditorRegistry`, `XFormTabComponentRegistry`, `XButtonActionRegistry`, `XCustomComponentRegistry`).
  Nome de domínio em código genérico se renomeia.
- **O motor não depende do TootegaCore** (back) e vice-versa. Três repositórios; o SaaS é quem os junta.
- **Idioma único pt-BR, texto vem do back.** O motor exibe o rótulo e a mensagem como o modelo da App traz. Sem
  chave de tradução, sem catálogo, sem `i18next`. Texto próprio do motor (casca, diálogos genéricos) se escreve
  em português, direto.
- **Modal acionado por um App fica contido na área de quem chamou, sem exceção** — inclusive mensagem de aviso,
  validação e erro. Só diálogo da casca usa overlay (`agnostic-responsive-guard` do App o cobra).
- **Erro mudo é defeito** (CE-21-quater): toda falha diz o que aconteceu e por quê; frase genérica é bug.
- **Falha de negócio é aviso laranja**, nunca erro vermelho (CE-20); mensagem formatada, com destaque e
  orientação (CE-21).
- **WCAG 2.2 AA**: texto 4,5:1, não-texto 3:1, estado nunca só por cor. Medição em
  `RELATORIO-contraste-WCAG-AA.md`.
- **Siglas sempre maiúsculas** em identificadores (CE-8); **um tipo por arquivo** (CE-9).

## 2. Build e validação

- **Validação do assistente = só tipagem:** `npm run typecheck` (é o que o CI faz). Teste de componente do motor
  mora na suíte do App do SaaS (`Front/App/src/__tests__/core/...` no ERP) — **não** se cria `*.test.tsx` aqui.
- **Teste só a pedido do dono ou quando a tarefa é de teste**; e aí se roda no App, filtrado ao que mudou
  (`npm test -- <arquivo>` em `Front/App`).
- Mudou caminho, nome de pacote ou export público ⇒ o App do SaaS quebra: ajuste e valide lá (`npx tsc -b` em
  `Front/App`) **antes** de relatar.

## 3. Como o assistente opera

- **TUDO É UTF-8** (sem BOM). Ler e escrever sempre em UTF-8.
- **Validar com fato antes de afirmar ou fazer.** Sem fato observado ⇒ sem afirmação e sem ação.
- **NUNCA subir o front** (`npm run dev`) — quem levanta é o dono.
- **NUNCA commitar nem empurrar sem pedido explícito do dono.** Um pedido, um commit. Mensagem de commit sem
  assinatura de IA. Mudança que cruza motor e SaaS são **dois commits, em dois repositórios**, que andam juntos.
- **NUNCA criar branch nem trocar de branch.** Trabalha-se na branch em que a sessão começou.
- **Responder em português**, ortografia correta.
