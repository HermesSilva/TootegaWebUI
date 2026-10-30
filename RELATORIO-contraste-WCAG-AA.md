# Relatório de contraste — WCAG 2.2, nível AA

> **Data:** 2026-10-25 · **Escopo:** o design system do `Front/Core` (tokens de cor dos temas em `src/styles/index.css`
> e a paleta fixa de botões em `src/lib/xButtonPalette.ts`), que vale para todo SaaS da casa. · **Natureza:** só
> medição — **nada foi alterado no código**. As recomendações do §6 são propostas, com os valores já medidos, para o
> dono decidir.

## 1. Critérios e método

| Critério | O que exige | Limite usado |
|---|---|---|
| **1.4.3 Contraste (mínimo)** | texto e imagem de texto | **4,5:1** (texto normal) · 3:1 só para texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) |
| **1.4.11 Contraste não-textual** | partes gráficas e limites de componentes necessários para entendê-los/operá-los | **3:1** contra as cores vizinhas |

- **Tamanho do texto no produto:** `--ui-font-size` 14 px, `-sm` 12 px, `-xs` 11 px no desktop (15/14/13 px no
  celular). **Nenhum texto de interface chega ao limite de "texto grande"**: vale 4,5:1 para todo texto, inclusive
  rótulo de botão em negrito.
- **Cálculo:** luminância relativa e razão de contraste pelas fórmulas da WCAG 2.2. As cores dos temas são lidas do
  `index.css` (HSL); as da paleta de botões vêm do `tailwindcss/theme.css` instalado (OKLCH, convertidas para sRGB);
  as transparências (`/50`, `/70`, `bg-…/60`) são compostas sobre o fundo real, como o navegador faz.
- **Calibração:** branco sobre `amber-500` dá **2,13** e o `text-muted` do tema claro (próximo do `slate-400`) dá
  **2,71** sobre branco — os valores de referência conhecidos. Os scripts estão no Apêndice e refazem tudo.
- **Temas:** `light`, `cloudy`, `dark` e `amber`. O tema **`custom`** parte do `light`, mas recebe as cores do
  assinante em tempo de execução (`themeService.applyCustomColors`): **não é validável estaticamente** (ver §6.6).
- **Fora deste relatório:** foco visível (2.4.7/2.4.11), texto sobre vídeo/imagem, telas montadas por SaaS e a
  verificação no navegador com ferramenta automática (axe/Lighthouse). A medição é sobre os pares de token como o
  código os combina; um componente que sobreponha camadas pode resultar em contraste diferente.

## 2. Resumo

| Tema | Pares avaliados | Passam | Falham | Leitura |
|---|---|---|---|---|
| **light** (padrão) | 34 | 7 | **27** | o mais crítico: texto secundário/esmaecido, cor da marca como texto, todos os status, placeholder e bordas de campo |
| **cloudy** | 34 | 11 | **23** | superfície clara demais para o texto claro: esmaecido, marca, perigo/informação e o próprio anel de foco |
| **dark** | 34 | 22 | **12** | bom no geral; falham o texto esmaecido, o branco sobre botão da marca e as bordas de campo |
| **amber** | 34 | 21 | **13** | como o dark, mais o vermelho de perigo |

A divisória (`border-light`, N2) foi medida mas não entra na conta: é decorativa e a WCAG não a exige.

**Os achados que mais pesam, porque se repetem em toda tela:**

1. **Texto esmaecido (`text-brand-text-muted`) reprova nos quatro temas** (2,19 a 4,36:1). É a classe de texto mais
   usada depois da principal: **333 ocorrências em 91 arquivos**, **116 delas em fonte pequena** (11–12 px) — e
   carrega informação de verdade (datas, contadores, chapéu, legendas, dicas, placeholder).
2. **Borda de campo (`border-color`) a 1,26–1,34:1 em todos os temas.** O `.input-field` tem o fundo igual ao da
   superfície, então a borda é a **única** pista de onde o campo está: reprova o 1.4.11.
3. **Texto branco sobre botão na cor da marca reprova nos quatro temas** (2,49 a 3,98:1) — 26 ocorrências em 17
   arquivos (`bg-brand-primary … text-white`).
4. **Tema claro: as cores de status não servem como texto** (sucesso 2,15–2,30, atenção 2,03–2,13, perigo 3,43–3,78,
   informação 3,19–3,64), nem sobre o fundo do próprio status nem sobre a superfície — e são as pastilhas de estado,
   os avisos e as mensagens.
5. **Dois botões da paleta semântica reprovam em qualquer tema:** **Criar** (branco sobre `green-600`, 3,22:1) — o
   botão "Novo" de toda App — e **Atenção** (branco sobre `amber-500`, 2,13:1).
6. **Transparências derrubam o contraste:** placeholder `text-brand-text-secondary/50` (1,96–2,75:1, 4 usos), texto
   da marca a 70%/60% (`RoleMatrixEditor`, `AccessMatrixEditor`, `RolePermissionsView`), texto secundário a 50%
   (`SubscriptionBlockedModal`, 4 usos), esmaecido a 50% (`XDataView`) e o ícone de fechar aba a 70% (`AppTabBar`,
   1,82–2,51:1 contra o mínimo de 3:1).

## 3. Resultados por tema

Legenda dos identificadores: **T** texto · **S** status · **A** texto com transparência/placeholder · **N** não-texto
(1.4.11) · **B** botão que depende do tema. Cores em hexadecimal, já com a transparência composta.

### 3.1 Tema light (padrão)

| ID | Par | Frente | Fundo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|---|
| T1 | Texto principal / superfície | `#212a36` | `#ffffff` | 14,49:1 | 4,50:1 | passa |
| T2 | Texto principal / fundo da página | `#212a36` | `#eff2f6` | 12,91:1 | 4,50:1 | passa |
| T3 | Texto secundário / superfície | `#65758b` | `#ffffff` | 4,70:1 | 4,50:1 | passa |
| T4 | Texto secundário / fundo da página | `#65758b` | `#eff2f6` | 4,18:1 | 4,50:1 | **falha** |
| T5 | Texto esmaecido (muted) / superfície | `#939eae` | `#ffffff` | 2,71:1 | 4,50:1 | **falha** |
| T6 | Texto esmaecido (muted) / fundo da página | `#939eae` | `#eff2f6` | 2,42:1 | 4,50:1 | **falha** |
| T7 | Texto esmaecido / fundo neutro (muted-bg) | `#939eae` | `#e3e7ed` | 2,19:1 | 4,50:1 | **falha** |
| T8 | Texto secundário / fundo neutro (muted-bg) | `#65758b` | `#e3e7ed` | 3,78:1 | 4,50:1 | **falha** |
| T9 | Texto principal / linha em foco (hover) | `#212a36` | `#e8eaed` | 12,02:1 | 4,50:1 | passa |
| T10 | Cor da marca como texto (link, aba ativa) / superfície | `#3c83f6` | `#ffffff` | 3,64:1 | 4,50:1 | **falha** |
| T11 | Cor da marca como texto / fundo da página | `#3c83f6` | `#eff2f6` | 3,24:1 | 4,50:1 | **falha** |
| T12 | Texto branco / botão na cor da marca | `#ffffff` | `#3c83f6` | 3,64:1 | 4,50:1 | **falha** |
| T13 | Cor da marca / pastilha da marca (brand-primary/10 sobre superfície) | `#3c83f6` | `#ecf3fe` | 3,26:1 | 4,50:1 | **falha** |
| S1 | Sucesso / fundo de sucesso | `#21c45d` | `#e9fcf0` | 2,15:1 | 4,50:1 | **falha** |
| S2 | Atenção / fundo de atenção | `#f59f0a` | `#fefae6` | 2,03:1 | 4,50:1 | **falha** |
| S3 | Perigo / fundo de perigo | `#ef4343` | `#fef1f1` | 3,43:1 | 4,50:1 | **falha** |
| S4 | Informação / fundo de informação | `#3c83f6` | `#e6f1fe` | 3,19:1 | 4,50:1 | **falha** |
| S5 | Sucesso como texto / superfície | `#21c45d` | `#ffffff` | 2,30:1 | 4,50:1 | **falha** |
| S6 | Atenção como texto / superfície | `#f59f0a` | `#ffffff` | 2,13:1 | 4,50:1 | **falha** |
| S7 | Perigo como texto / superfície | `#ef4343` | `#ffffff` | 3,78:1 | 4,50:1 | **falha** |
| S8 | Informação como texto / superfície | `#3c83f6` | `#ffffff` | 3,64:1 | 4,50:1 | **falha** |
| A1 | Placeholder (text-muted) / superfície | `#939eae` | `#ffffff` | 2,71:1 | 4,50:1 | **falha** |
| A2 | Placeholder (text-secondary/50) / superfície | `#b2bac5` | `#ffffff` | 1,96:1 | 4,50:1 | **falha** |
| A3 | Marca com alfa 70% como texto / superfície | `#77a8f9` | `#ffffff` | 2,40:1 | 4,50:1 | **falha** |
| A4 | Texto secundário com alfa 50% / superfície | `#b2bac5` | `#ffffff` | 1,96:1 | 4,50:1 | **falha** |
| A5 | Texto esmaecido com alfa 50% / superfície | `#c9cfd7` | `#ffffff` | 1,57:1 | 4,50:1 | **falha** |
| N1 | Borda de campo (border-color) / superfície | `#d7dfea` | `#ffffff` | 1,34:1 | 3,00:1 | **falha** |
| N2 | Divisória (border-light) / superfície | `#eeeff2` | `#ffffff` | 1,15:1 | 3,00:1 | não exigido (decorativo) |
| N3 | Cor da marca como indicador (aba ativa, foco) / superfície | `#3c83f6` | `#ffffff` | 3,64:1 | 3,00:1 | passa |
| N4 | Ponto de sucesso / superfície | `#21c45d` | `#ffffff` | 2,30:1 | 3,00:1 | **falha** |
| N5 | Ponto de atenção / superfície | `#f59f0a` | `#ffffff` | 2,13:1 | 3,00:1 | **falha** |
| N6 | Ponto de perigo / superfície | `#ef4343` | `#ffffff` | 3,78:1 | 3,00:1 | passa |
| N7 | Ícone esmaecido com alfa 70% (fechar aba) / superfície | `#b3bbc6` | `#ffffff` | 1,94:1 | 3,00:1 | **falha** |
| B1 | Botão "Leitura": sky-950 / sky-300 a 70% sobre a superfície | `#052f4a` | `#9ee1ff` | 9,70:1 | 4,50:1 | passa |
| B2 | Botão "Fechar": red-100 a 80% / red-900 a 60% sobre a superfície | `#f0cccc` | `#b47476` | 2,49:1 | 4,50:1 | **falha** |

### 3.2 Tema cloudy

| ID | Par | Frente | Fundo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|---|
| T1 | Texto principal / superfície | `#e7e9ef` | `#424957` | 7,45:1 | 4,50:1 | passa |
| T2 | Texto principal / fundo da página | `#e7e9ef` | `#2f3541` | 10,14:1 | 4,50:1 | passa |
| T3 | Texto secundário / superfície | `#a4aab7` | `#424957` | 3,88:1 | 4,50:1 | **falha** |
| T4 | Texto secundário / fundo da página | `#a4aab7` | `#2f3541` | 5,28:1 | 4,50:1 | passa |
| T5 | Texto esmaecido (muted) / superfície | `#788191` | `#424957` | 2,30:1 | 4,50:1 | **falha** |
| T6 | Texto esmaecido (muted) / fundo da página | `#788191` | `#2f3541` | 3,13:1 | 4,50:1 | **falha** |
| T7 | Texto esmaecido / fundo neutro (muted-bg) | `#788191` | `#363d49` | 2,78:1 | 4,50:1 | **falha** |
| T8 | Texto secundário / fundo neutro (muted-bg) | `#a4aab7` | `#363d49` | 4,69:1 | 4,50:1 | passa |
| T9 | Texto principal / linha em foco (hover) | `#e7e9ef` | `#4d5566` | 6,16:1 | 4,50:1 | passa |
| T10 | Cor da marca como texto (link, aba ativa) / superfície | `#4e7dda` | `#424957` | 2,27:1 | 4,50:1 | **falha** |
| T11 | Cor da marca como texto / fundo da página | `#4e7dda` | `#2f3541` | 3,09:1 | 4,50:1 | **falha** |
| T12 | Texto branco / botão na cor da marca | `#ffffff` | `#4e7dda` | 3,98:1 | 4,50:1 | **falha** |
| T13 | Cor da marca / pastilha da marca (brand-primary/10 sobre superfície) | `#4e7dda` | `#434e64` | 2,10:1 | 4,50:1 | **falha** |
| S1 | Sucesso / fundo de sucesso | `#33cc6b` | `#24422f` | 5,27:1 | 4,50:1 | passa |
| S2 | Atenção / fundo de atenção | `#e8a530` | `#453821` | 5,35:1 | 4,50:1 | passa |
| S3 | Perigo / fundo de perigo | `#e25050` | `#4f2222` | 3,47:1 | 4,50:1 | **falha** |
| S4 | Informação / fundo de informação | `#5e95ed` | `#24344c` | 4,19:1 | 4,50:1 | **falha** |
| S5 | Sucesso como texto / superfície | `#33cc6b` | `#424957` | 4,30:1 | 4,50:1 | **falha** |
| S6 | Atenção como texto / superfície | `#e8a530` | `#424957` | 4,24:1 | 4,50:1 | **falha** |
| S7 | Perigo como texto / superfície | `#e25050` | `#424957` | 2,37:1 | 4,50:1 | **falha** |
| S8 | Informação como texto / superfície | `#5e95ed` | `#424957` | 3,01:1 | 4,50:1 | **falha** |
| A1 | Placeholder (text-muted) / superfície | `#788191` | `#424957` | 2,30:1 | 4,50:1 | **falha** |
| A2 | Placeholder (text-secondary/50) / superfície | `#737a87` | `#424957` | 2,09:1 | 4,50:1 | **falha** |
| A3 | Marca com alfa 70% como texto / superfície | `#4a6db3` | `#424957` | 1,78:1 | 4,50:1 | **falha** |
| A4 | Texto secundário com alfa 50% / superfície | `#737a87` | `#424957` | 2,09:1 | 4,50:1 | **falha** |
| A5 | Texto esmaecido com alfa 50% / superfície | `#5d6574` | `#424957` | 1,54:1 | 4,50:1 | **falha** |
| N1 | Borda de campo (border-color) / superfície | `#4f5869` | `#424957` | 1,26:1 | 3,00:1 | **falha** |
| N2 | Divisória (border-light) / superfície | `#3a404a` | `#424957` | 1,15:1 | 3,00:1 | não exigido (decorativo) |
| N3 | Cor da marca como indicador (aba ativa, foco) / superfície | `#4e7dda` | `#424957` | 2,27:1 | 3,00:1 | **falha** |
| N4 | Ponto de sucesso / superfície | `#33cc6b` | `#424957` | 4,30:1 | 3,00:1 | passa |
| N5 | Ponto de atenção / superfície | `#e8a530` | `#424957` | 4,24:1 | 3,00:1 | passa |
| N6 | Ponto de perigo / superfície | `#e25050` | `#424957` | 2,37:1 | 3,00:1 | **falha** |
| N7 | Ícone esmaecido com alfa 70% (fechar aba) / superfície | `#687080` | `#424957` | 1,82:1 | 3,00:1 | **falha** |
| B1 | Botão "Leitura": sky-950 / sky-300 a 70% sobre a superfície | `#052f4a` | `#65aacd` | 5,41:1 | 4,50:1 | passa |
| B2 | Botão "Fechar": red-100 a 80% / red-900 a 60% sobre a superfície | `#e1bebf` | `#682c32` | 6,18:1 | 4,50:1 | passa |

### 3.3 Tema dark

| ID | Par | Frente | Fundo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|---|
| T1 | Texto principal / superfície | `#f8fafc` | `#1d283a` | 14,17:1 | 4,50:1 | passa |
| T2 | Texto principal / fundo da página | `#f8fafc` | `#0e1525` | 17,41:1 | 4,50:1 | passa |
| T3 | Texto secundário / superfície | `#94a3b8` | `#1d283a` | 5,78:1 | 4,50:1 | passa |
| T4 | Texto secundário / fundo da página | `#94a3b8` | `#0e1525` | 7,11:1 | 4,50:1 | passa |
| T5 | Texto esmaecido (muted) / superfície | `#6c7c93` | `#1d283a` | 3,49:1 | 4,50:1 | **falha** |
| T6 | Texto esmaecido (muted) / fundo da página | `#6c7c93` | `#0e1525` | 4,29:1 | 4,50:1 | **falha** |
| T7 | Texto esmaecido / fundo neutro (muted-bg) | `#6c7c93` | `#1a1f28` | 3,89:1 | 4,50:1 | **falha** |
| T8 | Texto secundário / fundo neutro (muted-bg) | `#94a3b8` | `#1a1f28` | 6,45:1 | 4,50:1 | passa |
| T9 | Texto principal / linha em foco (hover) | `#f8fafc` | `#2a3546` | 11,83:1 | 4,50:1 | passa |
| T10 | Cor da marca como texto (link, aba ativa) / superfície | `#5593f7` | `#1d283a` | 4,87:1 | 4,50:1 | passa |
| T11 | Cor da marca como texto / fundo da página | `#5593f7` | `#0e1525` | 5,99:1 | 4,50:1 | passa |
| T12 | Texto branco / botão na cor da marca | `#ffffff` | `#5593f7` | 3,04:1 | 4,50:1 | **falha** |
| T13 | Cor da marca / pastilha da marca (brand-primary/10 sobre superfície) | `#5593f7` | `#23334d` | 4,18:1 | 4,50:1 | **falha** |
| S1 | Sucesso / fundo de sucesso | `#47d17a` | `#1e3e2a` | 6,00:1 | 4,50:1 | passa |
| S2 | Atenção / fundo de atenção | `#efac39` | `#40331c` | 6,22:1 | 4,50:1 | passa |
| S3 | Perigo / fundo de perigo | `#f15b5b` | `#451717` | 4,60:1 | 4,50:1 | passa |
| S4 | Informação / fundo de informação | `#689df3` | `#1f2e47` | 5,00:1 | 4,50:1 | passa |
| S5 | Sucesso como texto / superfície | `#47d17a` | `#1d283a` | 7,53:1 | 4,50:1 | passa |
| S6 | Atenção como texto / superfície | `#efac39` | `#1d283a` | 7,50:1 | 4,50:1 | passa |
| S7 | Perigo como texto / superfície | `#f15b5b` | `#1d283a` | 4,51:1 | 4,50:1 | passa |
| S8 | Informação como texto / superfície | `#689df3` | `#1d283a` | 5,44:1 | 4,50:1 | passa |
| A1 | Placeholder (text-muted) / superfície | `#6c7c93` | `#1d283a` | 3,49:1 | 4,50:1 | **falha** |
| A2 | Placeholder (text-secondary/50) / superfície | `#596679` | `#1d283a` | 2,54:1 | 4,50:1 | **falha** |
| A3 | Marca com alfa 70% como texto / superfície | `#4473be` | `#1d283a` | 3,13:1 | 4,50:1 | **falha** |
| A4 | Texto secundário com alfa 50% / superfície | `#596679` | `#1d283a` | 2,54:1 | 4,50:1 | **falha** |
| A5 | Texto esmaecido com alfa 50% / superfície | `#455267` | `#1d283a` | 1,87:1 | 4,50:1 | **falha** |
| N1 | Borda de campo (border-color) / superfície | `#2e3a4d` | `#1d283a` | 1,29:1 | 3,00:1 | **falha** |
| N2 | Divisória (border-light) / superfície | `#252c37` | `#1d283a` | 1,05:1 | 3,00:1 | não exigido (decorativo) |
| N3 | Cor da marca como indicador (aba ativa, foco) / superfície | `#5593f7` | `#1d283a` | 4,87:1 | 3,00:1 | passa |
| N4 | Ponto de sucesso / superfície | `#47d17a` | `#1d283a` | 7,53:1 | 3,00:1 | passa |
| N5 | Ponto de atenção / superfície | `#efac39` | `#1d283a` | 7,50:1 | 3,00:1 | passa |
| N6 | Ponto de perigo / superfície | `#f15b5b` | `#1d283a` | 4,51:1 | 3,00:1 | passa |
| N7 | Ícone esmaecido com alfa 70% (fechar aba) / superfície | `#546378` | `#1d283a` | 2,42:1 | 3,00:1 | **falha** |
| B1 | Botão "Leitura": sky-950 / sky-300 a 70% sobre a superfície | `#052f4a` | `#5aa0c4` | 4,80:1 | 4,50:1 | passa |
| B2 | Botão "Fechar": red-100 a 80% / red-900 a 60% sobre a superfície | `#debbbd` | `#5a1e27` | 7,24:1 | 4,50:1 | passa |

### 3.4 Tema amber

| ID | Par | Frente | Fundo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|---|
| T1 | Texto principal / superfície | `#f0e7db` | `#2d211b` | 12,76:1 | 4,50:1 | passa |
| T2 | Texto principal / fundo da página | `#f0e7db` | `#1b120e` | 15,06:1 | 4,50:1 | passa |
| T3 | Texto secundário / superfície | `#b8a694` | `#2d211b` | 6,63:1 | 4,50:1 | passa |
| T4 | Texto secundário / fundo da página | `#b8a694` | `#1b120e` | 7,83:1 | 4,50:1 | passa |
| T5 | Texto esmaecido (muted) / superfície | `#8d7768` | `#2d211b` | 3,70:1 | 4,50:1 | **falha** |
| T6 | Texto esmaecido (muted) / fundo da página | `#8d7768` | `#1b120e` | 4,36:1 | 4,50:1 | **falha** |
| T7 | Texto esmaecido / fundo neutro (muted-bg) | `#8d7768` | `#1f1814` | 4,15:1 | 4,50:1 | **falha** |
| T8 | Texto secundário / fundo neutro (muted-bg) | `#b8a694` | `#1f1814` | 7,44:1 | 4,50:1 | passa |
| T9 | Texto principal / linha em foco (hover) | `#f0e7db` | `#372b25` | 11,18:1 | 4,50:1 | passa |
| T10 | Cor da marca como texto (link, aba ativa) / superfície | `#ee8c2b` | `#2d211b` | 6,26:1 | 4,50:1 | passa |
| T11 | Cor da marca como texto / fundo da página | `#ee8c2b` | `#1b120e` | 7,39:1 | 4,50:1 | passa |
| T12 | Texto branco / botão na cor da marca | `#ffffff` | `#ee8c2b` | 2,49:1 | 4,50:1 | **falha** |
| T13 | Cor da marca / pastilha da marca (brand-primary/10 sobre superfície) | `#ee8c2b` | `#402c1d` | 5,28:1 | 4,50:1 | passa |
| S1 | Sucesso / fundo de sucesso | `#37be68` | `#1b3223` | 5,72:1 | 4,50:1 | passa |
| S2 | Atenção / fundo de atenção | `#e09d29` | `#32291b` | 6,14:1 | 4,50:1 | passa |
| S3 | Perigo / fundo de perigo | `#df4949` | `#391818` | 3,94:1 | 4,50:1 | **falha** |
| S4 | Informação / fundo de informação | `#eb9947` | `#3c2c20` | 5,83:1 | 4,50:1 | passa |
| S5 | Sucesso como texto / superfície | `#37be68` | `#2d211b` | 6,49:1 | 4,50:1 | passa |
| S6 | Atenção como texto / superfície | `#e09d29` | `#2d211b` | 6,71:1 | 4,50:1 | passa |
| S7 | Perigo como texto / superfície | `#df4949` | `#2d211b` | 3,86:1 | 4,50:1 | **falha** |
| S8 | Informação como texto / superfície | `#eb9947` | `#2d211b` | 6,83:1 | 4,50:1 | passa |
| A1 | Placeholder (text-muted) / superfície | `#8d7768` | `#2d211b` | 3,70:1 | 4,50:1 | **falha** |
| A2 | Placeholder (text-secondary/50) / superfície | `#736458` | `#2d211b` | 2,75:1 | 4,50:1 | **falha** |
| A3 | Marca com alfa 70% como texto / superfície | `#b46c26` | `#2d211b` | 3,80:1 | 4,50:1 | **falha** |
| A4 | Texto secundário com alfa 50% / superfície | `#736458` | `#2d211b` | 2,75:1 | 4,50:1 | **falha** |
| A5 | Texto esmaecido com alfa 50% / superfície | `#5d4c42` | `#2d211b` | 1,92:1 | 4,50:1 | **falha** |
| N1 | Borda de campo (border-color) / superfície | `#43352d` | `#2d211b` | 1,33:1 | 3,00:1 | **falha** |
| N2 | Divisória (border-light) / superfície | `#332924` | `#2d211b` | 1,10:1 | 3,00:1 | não exigido (decorativo) |
| N3 | Cor da marca como indicador (aba ativa, foco) / superfície | `#ee8c2b` | `#2d211b` | 6,26:1 | 3,00:1 | passa |
| N4 | Ponto de sucesso / superfície | `#37be68` | `#2d211b` | 6,49:1 | 3,00:1 | passa |
| N5 | Ponto de atenção / superfície | `#e09d29` | `#2d211b` | 6,71:1 | 3,00:1 | passa |
| N6 | Ponto de perigo / superfície | `#df4949` | `#2d211b` | 3,86:1 | 3,00:1 | passa |
| N7 | Ícone esmaecido com alfa 70% (fechar aba) / superfície | `#705d51` | `#2d211b` | 2,51:1 | 3,00:1 | **falha** |
| B1 | Botão "Leitura": sky-950 / sky-300 a 70% sobre a superfície | `#052f4a` | `#5f9ebb` | 4,69:1 | 4,50:1 | passa |
| B2 | Botão "Fechar": red-100 a 80% / red-900 a 60% sobre a superfície | `#dfbaba` | `#601c1a` | 7,07:1 | 4,50:1 | passa |

## 4. Paleta fixa de botões (igual em todos os temas)

Rótulo do botão sobre o fundo opaco da paleta semântica (`XBUTTON_PALETTE`). Os botões "Leitura" e "Fechar", que têm
transparência e por isso dependem do tema, estão nas tabelas do §3 (B1 e B2).

| Botão | Texto | Fundo | Contraste | Resultado |
|---|---|---|---|---|
| Criar (Novo) | `white #ffffff` | `green-600 #00a63e` | 3,22:1 | **falha** |
| Editar | `white #ffffff` | `blue-600 #155dfc` | 5,25:1 | passa |
| Exportar | `white #ffffff` | `violet-600 #7f22fe` | 5,89:1 | passa |
| Neutro | `white #ffffff` | `slate-600 #45556c` | 7,58:1 | passa |
| Padrão (custom) | `white #ffffff` | `slate-700 #314158` | 10,36:1 | passa |
| Perigo | `white #ffffff` | `red-600 #e7000b` | 4,77:1 | passa |
| Atenção | `white #ffffff` | `amber-500 #fe9a00` | 2,13:1 | **falha** |
| Destaque (próxima etapa) | `white #ffffff` | `indigo-600 #4f39f6` | 6,46:1 | passa |
| Documento | `slate-100 #f1f5f9` | `slate-800 #1d293d` | 13,34:1 | passa |

## 5. Onde o código agrava (levantamento em `Front/Core/src` e no App do ANVIL, sem testes)

| Padrão | Ocorrências | Observação |
|---|---|---|
| `text-brand-text-muted` (sem alfa) | 333 em 91 arquivos | reprova em todos os temas (T5–T7) |
| … na mesma linha que fonte pequena (`text-ui-xs`, `text-xs`, `text-[10–11px]`) | 116 em 57 arquivos | o caso mais frágil: pouco contraste **e** letra pequena |
| `bg-brand-primary` com `text-white` | 26 em 17 arquivos | reprova em todos os temas (T12) |
| `placeholder:text-brand-text-muted` (inclui o `.input-field`) | 11 + o padrão do design system | reprova em todos os temas (A1) |
| `placeholder:text-brand-text-secondary/50` | 4 | 1,96–2,75:1 (A2) |
| `text-brand-primary/70` e `/60` | 4 em 3 arquivos (`AccessMatrixEditor:306`, `RoleMatrixEditor:146`, `RolePermissionsView:64,76`) | 1,78–3,80:1 (A3) |
| `text-brand-text-secondary/50` | 4 em `SubscriptionBlockedModal:540–556` | 1,96–2,75:1 (A4) |
| `text-brand-text-muted/50` | 1 em `XDataView:126` | 1,54–1,92:1 (A5) |
| `text-brand-text-muted/70` (ícone de fechar aba) | 1 em `AppTabBar:198` | 1,82–2,51:1 contra 3:1 (N7) |
| `text-brand-text-muted/30` | 2 em `AppTabBar:224,238` | **isento**: são os botões de rolagem **desabilitados** (a WCAG não exige contraste de controle inativo) |
| `CLOSE_BUTTON_STYLE` (`text-red-100/80` sobre `bg-red-900/60`) | 14 em 7 arquivos | passa nos temas escuros; **reprova no claro** (2,49:1 — B2), porque o vermelho a 60% clareia sobre o branco |

## 6. Recomendações (não aplicadas)

Valores medidos com os mesmos scripts. A regra usada: **mesmo matiz e saturação**, só a luminosidade muda, até
passar contra **todos** os fundos em que o token aparece.

### 6.1 Texto esmaecido e secundário

| Tema | Token | Hoje | Sugerido | Pior contraste depois |
|---|---|---|---|---|
| light | `--text-muted` | `215 14% 63%` | `215 14% 42%` | 4,50 |
| light | `--text-secondary` | `215 16% 47%` | `215 16% 42%` | 4,57 |
| cloudy | `--text-muted` | `220 10% 52%` | `220 10% 73%` | 4,54 |
| cloudy | `--text-secondary` | `220 12% 68%` | `220 12% 74%` | 4,65 |
| dark | `--text-muted` | `215 15% 50%` | `215 15% 57%` | 4,51 |
| amber | `--text-muted` | `25 15% 48%` | `25 15% 54%` | 4,56 |

**Trade-off:** no **light** e no **cloudy**, o esmaecido que passa fica praticamente igual ao secundário — a
hierarquia "secundário × esmaecido" deixa de existir pela cor. Saídas possíveis: (a) aceitar e marcar a hierarquia
por tamanho/peso; (b) no cloudy, **escurecer a superfície** (`--brand-surface`), o que devolve folga a todos os textos
claros de uma vez; (c) restringir o esmaecido ao que é decorativo ou redundante (o que a WCAG não cobra).

### 6.2 Cor da marca como texto e sob texto branco

| Tema | Token | Hoje | Sugerido (como texto) | Pior contraste depois |
|---|---|---|---|---|
| light | `--brand-primary` | `217 91% 60%` | `217 91% 50%` | 4,51 |
| cloudy | `--brand-primary` | `220 65% 58%` | `220 65% 77%` | 4,52 |

O **branco sobre o botão da marca** (T12) reprova nos quatro temas, e nos escuros o caminho é o oposto do texto
(a marca precisa clarear para ser lida como texto e escurecer para segurar o branco). A saída consistente é um
**token próprio para o fundo de botão** (ex.: `--brand-primary-strong`) ou **texto escuro sobre o botão** nos temas
escuros — decisão de design, não de cálculo.

### 6.3 Status

| Tema | Token | Hoje | Sugerido | Pior contraste depois |
|---|---|---|---|---|
| light | `--success` | `142 71% 45%` | `142 71% 30%` | 4,52 |
| light | `--warning` | `38 92% 50%` | `38 92% 32%` | 4,62 |
| light | `--danger` | `0 84% 60%` | `0 84% 47%` | 4,56 |
| light | `--info` | `217 91% 60%` | `217 91% 49%` | 4,59 |
| cloudy | `--success` | `142 60% 50%` | `142 60% 54%` | 4,53 |
| cloudy | `--warning` | `38 80% 55%` | `38 80% 59%` | 4,55 |
| cloudy | `--danger` | `0 72% 60%` | `0 72% 79%` | 4,51 |
| cloudy | `--info` | `217 80% 65%` | `217 80% 77%` | 4,53 |
| amber | `--danger` | `0 70% 58%` | `0 70% 63%` | 4,51 |

No light, o status escurecido serve ao **texto**; o ponto de status (1.4.11, 3:1) passaria com menos. Se o mesmo
token pinta os dois, vale o mais exigente (4,5:1).

### 6.4 Borda de campo

| Tema | `--border-color` hoje | Sugerido | Contraste depois |
|---|---|---|---|
| light | `214 32% 88%` | `214 32% 60%` | 3,09 |
| cloudy | `220 14% 36%` | `220 14% 61%` | 3,08 |
| dark | `217 25% 24%` | `217 25% 48%` | 3,08 |
| amber | `22 20% 22%` | `22 20% 43%` | 3,05 |

Mudar o `--border-color` global escurece **toda** borda (cartões, tabelas). A alternativa cirúrgica é um token só
para o limite de campo (ex.: `--input-border`) usado no `.input-field` e nos editores, ou dar ao campo um fundo
diferente da superfície (aí a borda deixa de ser a única pista).

### 6.5 Botões da paleta semântica

| Botão | Hoje | Alternativa medida | Contraste |
|---|---|---|---|
| Criar | branco / `green-600` — 3,22 | branco / `green-700` | 4,95 |
| | | branco / `green-800` | 7,13 |
| Atenção | branco / `amber-500` — 2,13 | texto `amber-950` / `amber-500` | 7,03 |
| | | texto `slate-900` / `amber-500` | 8,35 |
| | | branco / `amber-700` | 5,03 |
| Fechar (tema claro) | `red-100/80` / `red-900/60` — 2,49 | fundo opaco (sem `/60`) — o vermelho deixa de clarear sobre o branco | a medir na escolha |

### 6.6 Tema `custom` e prevenção

O tema do assinante não passa por validação nenhuma: qualquer cor entra. A proteção que falta é **medir na hora de
salvar** (as funções deste relatório cabem em poucas linhas) e avisar — ou recusar — a combinação que reprova. E,
para o Core inteiro, um **teste de contraste dos tokens** no estilo do `guardaCaixaAlta.test.ts` (que já reprova a
suíte por classe proibida) seguraria a regressão: os pares do §3 viram asserções.

## Apêndice — como refazer a medição

Os dois scripts abaixo rodam com Node (sem dependências) e leem o `index.css` do Core. Os valores OKLCH da paleta de
botões estão transcritos do `tailwindcss/theme.css` instalado em 2026-10-25 (Tailwind v4).

```text
node contraste.mjs  TootegaCore/Front/Core/src/styles/index.css   # §3 e §4
node sugestoes.mjs  TootegaCore/Front/Core/src/styles/index.css   # §6.1 a §6.4
```

### contraste.mjs

```js
// Contraste WCAG 2.2 AA dos tokens do design system do Tootega Core.
// Uso: node contraste.mjs <caminho do index.css> > saida.json
import { readFileSync } from 'node:fs';

const css = readFileSync(process.argv[2], 'utf8');
const TEMAS = ['light', 'cloudy', 'dark', 'amber'];

function blocoDoTema(pTema) {
  const re = pTema === 'light'
    ? /:root,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`html\\[data-theme="${pTema}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`tema ${pTema} não encontrado`);
  const vars = {};
  for (const [, nome, valor] of m[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g))
    vars[nome] = valor.trim();
  return vars;
}

function hslParaRgb(pHsl) {
  const [h, s, l] = pHsl.replace(/%/g, '').split(/\s+/).map(Number);
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255));
}

function oklchParaRgb(pL, pC, pH) {
  const hr = (pH * Math.PI) / 180;
  const a = pC * Math.cos(hr), b = pC * Math.sin(hr);
  const l_ = pL + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = pL - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = pL - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  });
}

const TW = {
  white: [255, 255, 255],
  'green-600': oklchParaRgb(0.627, 0.194, 149.214),
  'blue-600': oklchParaRgb(0.546, 0.245, 262.881),
  'violet-600': oklchParaRgb(0.541, 0.281, 293.009),
  'slate-600': oklchParaRgb(0.446, 0.043, 257.281),
  'slate-700': oklchParaRgb(0.372, 0.044, 257.287),
  'slate-800': oklchParaRgb(0.279, 0.041, 260.031),
  'slate-100': oklchParaRgb(0.968, 0.007, 247.896),
  'red-600': oklchParaRgb(0.577, 0.245, 27.325),
  'amber-500': oklchParaRgb(0.769, 0.188, 70.08),
  'indigo-600': oklchParaRgb(0.511, 0.262, 276.966),
  'sky-300': oklchParaRgb(0.828, 0.111, 230.318),
  'sky-950': oklchParaRgb(0.293, 0.066, 243.157),
  'red-900': oklchParaRgb(0.396, 0.141, 25.723),
  'red-100': oklchParaRgb(0.936, 0.032, 17.717),
};

const hex = (pRgb) => '#' + pRgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const misturar = (pFrente, pAlfa, pFundo) => pFrente.map((v, i) => Math.round(pAlfa * v + (1 - pAlfa) * pFundo[i]));

function luminancia(pRgb) {
  const [r, g, b] = pRgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(pA, pB) {
  const [l1, l2] = [luminancia(pA), luminancia(pB)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const resultado = { temas: {}, botoes: [] };

for (const tema of TEMAS) {
  const v = blocoDoTema(tema);
  const t = (pNome) => hslParaRgb(v[pNome]);
  const sup = t('brand-surface'), fundo = t('brand-background');
  const pares = [
    // [id, descrição, frente, fundo, critério (4.5 texto | 3 não-texto), onde aparece]
    ['T1', 'Texto principal / superfície', t('text-primary'), sup, 4.5],
    ['T2', 'Texto principal / fundo da página', t('text-primary'), fundo, 4.5],
    ['T3', 'Texto secundário / superfície', t('text-secondary'), sup, 4.5],
    ['T4', 'Texto secundário / fundo da página', t('text-secondary'), fundo, 4.5],
    ['T5', 'Texto esmaecido (muted) / superfície', t('text-muted'), sup, 4.5],
    ['T6', 'Texto esmaecido (muted) / fundo da página', t('text-muted'), fundo, 4.5],
    ['T7', 'Texto esmaecido / fundo neutro (muted-bg)', t('text-muted'), t('muted-bg'), 4.5],
    ['T8', 'Texto secundário / fundo neutro (muted-bg)', t('text-secondary'), t('muted-bg'), 4.5],
    ['T9', 'Texto principal / linha em foco (hover)', t('text-primary'), t('hover'), 4.5],
    ['T10', 'Cor da marca como texto (link, aba ativa) / superfície', t('brand-primary'), sup, 4.5],
    ['T11', 'Cor da marca como texto / fundo da página', t('brand-primary'), fundo, 4.5],
    ['T12', 'Texto branco / botão na cor da marca', [255, 255, 255], t('brand-primary'), 4.5],
    ['T13', 'Cor da marca / pastilha da marca (brand-primary/10 sobre superfície)', t('brand-primary'), misturar(t('brand-primary'), 0.1, sup), 4.5],
    ['S1', 'Sucesso / fundo de sucesso', t('success'), t('success-bg'), 4.5],
    ['S2', 'Atenção / fundo de atenção', t('warning'), t('warning-bg'), 4.5],
    ['S3', 'Perigo / fundo de perigo', t('danger'), t('danger-bg'), 4.5],
    ['S4', 'Informação / fundo de informação', t('info'), t('info-bg'), 4.5],
    ['S5', 'Sucesso como texto / superfície', t('success'), sup, 4.5],
    ['S6', 'Atenção como texto / superfície', t('warning'), sup, 4.5],
    ['S7', 'Perigo como texto / superfície', t('danger'), sup, 4.5],
    ['S8', 'Informação como texto / superfície', t('info'), sup, 4.5],
    ['A1', 'Placeholder (text-muted) / superfície', t('text-muted'), sup, 4.5],
    ['A2', 'Placeholder (text-secondary/50) / superfície', misturar(t('text-secondary'), 0.5, sup), sup, 4.5],
    ['A3', 'Marca com alfa 70% como texto / superfície', misturar(t('brand-primary'), 0.7, sup), sup, 4.5],
    ['A4', 'Texto secundário com alfa 50% / superfície', misturar(t('text-secondary'), 0.5, sup), sup, 4.5],
    ['A5', 'Texto esmaecido com alfa 50% / superfície', misturar(t('text-muted'), 0.5, sup), sup, 4.5],
    ['N1', 'Borda de campo (border-color) / superfície', t('border-color'), sup, 3],
    ['N2', 'Divisória (border-light) / superfície', t('border-light'), sup, 3],
    ['N3', 'Cor da marca como indicador (aba ativa, foco) / superfície', t('brand-primary'), sup, 3],
    ['N4', 'Ponto de sucesso / superfície', t('success'), sup, 3],
    ['N5', 'Ponto de atenção / superfície', t('warning'), sup, 3],
    ['N6', 'Ponto de perigo / superfície', t('danger'), sup, 3],
    ['N7', 'Ícone esmaecido com alfa 70% (fechar aba) / superfície', misturar(t('text-muted'), 0.7, sup), sup, 3],
    ['B1', 'Botão "Leitura": sky-950 / sky-300 a 70% sobre a superfície', TW['sky-950'], misturar(TW['sky-300'], 0.7, sup), 4.5],
    ['B2', 'Botão "Fechar": red-100 a 80% / red-900 a 60% sobre a superfície', misturar(TW['red-100'], 0.8, misturar(TW['red-900'], 0.6, sup)), misturar(TW['red-900'], 0.6, sup), 4.5],
  ];
  resultado.temas[tema] = pares.map(([id, desc, a, b, criterio]) => {
    const r = contraste(a, b);
    return { id, desc, frente: hex(a), fundo: hex(b), razao: Math.round(r * 100) / 100, criterio, passa: r >= criterio };
  });
}

for (const [nome, frente, fundo] of [
  ['Criar (Novo)', 'white', 'green-600'],
  ['Editar', 'white', 'blue-600'],
  ['Exportar', 'white', 'violet-600'],
  ['Neutro', 'white', 'slate-600'],
  ['Padrão (custom)', 'white', 'slate-700'],
  ['Perigo', 'white', 'red-600'],
  ['Atenção', 'white', 'amber-500'],
  ['Destaque (próxima etapa)', 'white', 'indigo-600'],
  ['Documento', 'slate-100', 'slate-800'],
]) {
  const r = contraste(TW[frente], TW[fundo]);
  resultado.botoes.push({ nome, frente: `${frente} ${hex(TW[frente])}`, fundo: `${fundo} ${hex(TW[fundo])}`, razao: Math.round(r * 100) / 100, criterio: 4.5, passa: r >= 4.5 });
}

process.stdout.write(JSON.stringify(resultado, null, 2));
```

### sugestoes.mjs

```js
// Para cada token reprovado, a luminosidade HSL mais próxima da atual (mesmo matiz e saturação) que passa contra
// TODOS os fundos em que o token é usado. Uso: node sugestoes.mjs <index.css>
import { readFileSync } from 'node:fs';

const css = readFileSync(process.argv[2], 'utf8');
function bloco(pTema) {
  const re = pTema === 'light'
    ? /:root,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`html\\[data-theme="${pTema}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const vars = {};
  for (const [, n, v] of css.match(re)[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) vars[n] = v.trim();
  return vars;
}
const hsl = (h, s, l) => {
  const S = s / 100, L = l / 100, c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255));
};
const parse = (p) => p.replace(/%/g, '').split(/\s+/).map(Number);
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ctr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const ALVOS = [
  ['text-secondary', ['brand-surface', 'brand-background', 'muted-bg'], 4.5],
  ['text-muted', ['brand-surface', 'brand-background', 'muted-bg'], 4.5],
  ['brand-primary', ['brand-surface', 'brand-background'], 4.5],
  ['success', ['brand-surface', 'success-bg'], 4.5],
  ['warning', ['brand-surface', 'warning-bg'], 4.5],
  ['danger', ['brand-surface', 'danger-bg'], 4.5],
  ['info', ['brand-surface', 'info-bg'], 4.5],
  ['border-color', ['brand-surface'], 3],
];

const saida = {};
for (const tema of ['light', 'cloudy', 'dark', 'amber']) {
  const v = bloco(tema);
  saida[tema] = [];
  for (const [token, fundos, alvo] of ALVOS) {
    const [h, s, l] = parse(v[token]);
    const bgs = fundos.map((f) => hsl(...parse(v[f])));
    const pior = (L) => Math.min(...bgs.map((b) => ctr(hsl(h, s, L), b)));
    const atual = pior(l);
    if (atual >= alvo) continue;
    let sugerida = null;
    for (let d = 1; d <= 100 && sugerida === null; d++)
      for (const L of [l - d, l + d])
        if (L >= 0 && L <= 100 && pior(L) >= alvo) { sugerida = L; break; }
    saida[tema].push({ token, atual: `${h} ${s}% ${l}%`, contrasteAtual: Math.round(atual * 100) / 100, sugerido: sugerida === null ? 'nenhum L passa' : `${h} ${s}% ${sugerida}%`, contrasteSugerido: sugerida === null ? null : Math.round(pior(sugerida) * 100) / 100, alvo, fundos: fundos.join(', ') });
  }
}
process.stdout.write(JSON.stringify(saida, null, 2));
```
