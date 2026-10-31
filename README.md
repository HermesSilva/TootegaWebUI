# Tootega WebUI — o motor do front

Repositório do pacote **`@Tootega/core`**: o motor genérico do front dos SaaS da Tootega (React 19 + Vite +
TypeScript) e o **design system** (`tailwind.config.js`, `src/styles/index.css`). É a biblioteca que renderiza
qualquer App a partir do modelo que o back declara (CE-19): grades, formulários, modais, editores de campo,
casca, painel de ajuda, painel da Jaci, hooks e os registros por nome que o SaaS preenche
(`XFieldEditorRegistry`, `XFormTabComponentRegistry`, `XButtonActionRegistry`, `XCustomComponentRegistry`).

Nasceu em 2026-10-30 (D56) a partir do `Front/Core` do `TootegaCore`, que entre 2026-10-23 e 2026-10-30 o
abrigou (D54, ADR-0009 do ERP). O back da plataforma (ID, SYS, JCI, LOG, `Tootega.Core`) continua em
`github.com/Tootega/TootegaCore`; este repositório **não depende dele**, e ele não depende deste. Quem junta os
três é o SaaS.

## Regras binárias

- **O motor não conhece SaaS nenhum.** Nada aqui cita módulo, tabela, rota ou texto de produto. Componente de
  domínio (fiscal, financeiro, estoque…) mora no App do SaaS e se registra por nome nos registros do motor.
- **Texto vem do back, em pt-BR.** O motor exibe o que o modelo da App traz; não há chave de tradução nem
  catálogo (CLAUDE.md do ERP, §2).
- **Modal acionado por um App fica contido na área de quem chamou** — nunca cobre a página, a casca ou as abas.
  Só diálogo da casca usa overlay. Detalhe e dimensões (FE-#): skill `tootega-front` do SaaS.
- **Erro mudo é defeito** (CE-21-quater): toda falha diz o que aconteceu e por quê.
- **Acessibilidade WCAG 2.2 AA**: texto 4,5:1, não-texto 3:1, estado nunca só por cor. Medição em
  `RELATORIO-contraste-WCAG-AA.md`.

## Como um SaaS usa

1. **Checkout na raiz do SaaS**, numa pasta chamada exatamente `TootegaWebUI`, e `/TootegaWebUI/` no
   `.gitignore` do SaaS (o histórico é deste repositório):

   ```
   <SaaS>/
   ├── TootegaCore/      ← a plataforma (back)
   ├── TootegaWebUI/     ← este repositório
   ├── Back/ …
   └── Front/App/ …      ← o App do SaaS
   ```

2. **`package.json` do App:** `"@Tootega/core": "file:../../TootegaWebUI"`. Depois de mudar o caminho, rode
   `npm install` no App: o link em `node_modules/@Tootega/core` aponta para a pasta do `file:`, e um link velho
   derruba o `tsc` em todo `@core/*` com "Cannot find module".
3. **Apelido `@core`** → `../../TootegaWebUI/src` no `tsconfig.json` (`paths`), no `vite.config.ts`
   (`resolve.alias`) e no `vitest.config.ts`. No Vite, libere a pasta em `server.fs.allow`.
4. **CSS:** o App importa `@core/styles/index.css` (já traz o Tailwind e o design system); as classes do App
   entram pela detecção automática do Tailwind v4.
5. **Ativos que o SaaS serve:** o motor usa `/icons/jaci.svg` (avatar da Jaci) por URL; o `public/icons` do App
   precisa tê-lo. Os ícones deste repositório (`public/icons`) entram na imagem do front do SaaS.
6. **Testes:** os que NÃO renderizam React (parser, serializador e transações do AsciiDoc, tokenizador,
   utilitários puros) moram aqui, em `src/__tests__`, e rodam com `npm test`; o vitest do App do SaaS aponta um
   projeto para esta raiz e os conta na catraca de cobertura dele. **Teste de componente** (que renderiza React)
   mora na suíte do App do SaaS, que é quem garante uma cópia só de React.
7. **CI/CD do SaaS:** `actions/checkout` deste repositório em `./TootegaWebUI` antes do `npm ci` do App. O
   repositório é privado e o `GITHUB_TOKEN` de um repositório não lê outro: cada SaaS cadastra aqui uma
   **deploy key só-leitura** e guarda a chave privada num secret dele (no ERP, `TOOTEGAWEBUI_DEPLOY_KEY`; a
   produção usa `PRD_TOOTEGAWEBUI_DEPLOY_KEY` e fixa a branch `PROD`). A imagem do front se constrói com o
   contexto na raiz do SaaS, e entram só `Front/App` e `TootegaWebUI`.

## Compilar sozinho

```
npm ci
npm run typecheck
npm test
```

É o que o CI deste repositório faz (`.github/workflows/ci.yml`): prova que o motor tipa e passa nos testes puros
**sem SaaS nenhum ao lado**. Se tipar aqui e quebrar no SaaS, o defeito é do App; se quebrar aqui, algo do motor passou a depender do
que só o SaaS tem.

## Layout

| Pasta | O que é |
|---|---|
| `src/components/` | `templates/` (XApplicationView, XModalShell, grades, formulários, diálogo de exportação), `ui/`, `layout/`, `ajuda/`, `jaci/`, `painel/`, `novidades/`, `face/` |
| `src/contexts/`, `src/hooks/`, `src/lib/`, `src/types/` | contexto de autenticação e tema, hooks (preferências, seletor de arquivo, painéis), utilitários puros (visibilidade, formatação, filtro padrão, paleta de botões), tipos do modelo da App |
| `src/styles/` | `index.css` — tokens de tema (HSL) + Tailwind |
| `public/icons/` | ícones do motor |
| `tailwind.config.js` | o design system |
