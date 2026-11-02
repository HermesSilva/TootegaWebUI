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

- **Validação do assistente = tipagem:** `npm run typecheck` (é o que o CI faz, mais `npm test`). Teste **puro**
  (sem React) mora aqui em `src/__tests__` e roda com `npm test`; teste de **componente** do motor mora na suíte
  do App do SaaS (`Front/App/src/__tests__/core/...` no ERP) — **não** se cria `*.test.tsx` aqui.
- **Teste só a pedido do dono ou quando a tarefa é de teste**; e aí se roda no App, filtrado ao que mudou
  (`npm test -- <arquivo>` em `Front/App`).
- Mudou caminho, nome de pacote ou export público ⇒ o App do SaaS quebra: ajuste e valide lá (`npx tsc -b` em
  `Front/App`) **antes** de relatar.

### 2.1 Cobertura do motor: `front/Core` sempre acima de 80% (binária — dono, 2026-11-02)

- **Quem mede é o SaaS, não este repositório.** O piso de 80% está em `Ferramentas/Cobertura/piso.json` do ERP, e o job
  "Test Frontend" de lá o cobra sobre o `master` daqui. O check deste repositório não mede cobertura nem roda os
  testes de componente: PR verde aqui ainda pode deixar o ERP vermelho. Foi o que aconteceu em 2026-11-02: o motor de
  fórmulas entrou sem teste, o `front/Core` caiu para 75%, e só o CI do ERP acusou.
- **Código novo chega com teste no mesmo PR.** Lógica pura em `src/__tests__` daqui; componente em
  `Front/App/src/__tests__/core` do ERP, num commit que anda junto (§3). O que não for exercitado entra no
  denominador e puxa o percentual para baixo: uma biblioteca nova inteira sem teste derruba o motor todo.
- **Medir antes de abrir PR que acrescenta código.** Com a branch no checkout `TootegaWebUI` da raiz do ERP, rode da
  raiz do ERP `python Ferramentas/Cobertura/cobertura.py --front` e leia a linha `front/Core`: tem de ficar acima de 80%.
  Saída diferente de zero reprova. Sem o ERP ao lado, a medição não existe: diga isso no PR, não presuma.
- **Mudou comportamento do editor ou de componente?** Os testes de componente do ERP passam a falhar depois do merge.
  Ajuste-os no commit par do ERP, e avise que os dois precisam entrar juntos.
- **O piso não desce para acomodar código sem teste.** Descer é decisão do dono, escrita com o motivo no commit. O
  caminho normal é escrever o teste.
- **Defeito achado ao testar não se fixa como correto.** Escreva o comportamento desejado com `it.fails`, que reprova
  quando o defeito for corrigido, e cite-o no PR.

## 3. Como o assistente opera

- **TUDO É UTF-8** (sem BOM). Ler e escrever sempre em UTF-8.
- **Validar com fato antes de afirmar ou fazer.** Sem fato observado ⇒ sem afirmação e sem ação.
- **NUNCA subir o front** (`npm run dev`) — quem levanta é o dono.
- **NUNCA commitar nem empurrar sem pedido explícito do dono.** Um pedido, um commit. Mensagem de commit sem
  assinatura de IA. Mudança que cruza motor e SaaS são **dois commits, em dois repositórios**, que andam juntos.
- **Toda alteração vai numa branch própria, depois um PR para `master`, e o PR apaga a branch ao mesclar** (dono,
  2026-10-31; `delete_branch_on_merge` ligado no repositório). `master` não aceita push direto e exige o check
  "Typecheck + testes puros".
- **Responder em português**, ortografia correta.
