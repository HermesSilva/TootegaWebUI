/**
 * PAINEL — o template das telas de trabalho (dashboards) do Core (dono, 2026-10-25). Cada pasta pode ser usada sozinha:
 *
 *   moldura/          a tela: cabeçalho numa linha (com "precisa de você"), abas, corpo principal + lateral, rodapé
 *   elementos/        peças avulsas: cartão, controle segmentado, menu suspenso, indicador de status por forma, semáforo
 *   graficoDeBaleia/  o gráfico de baleia (fases × trilhas) genérico, a visão em tabela e a legenda
 *   listas/           lista de avisos (ordenada pelo peso) e lista de status
 *
 * Nada aqui conhece o domínio de um SaaS: dados, regras e textos de produto chegam por propriedade. Contraste e uso da
 * cor seguem a WCAG 2.2 AA (skill tootega-front, seção 5-bis).
 */

export * from './elementos';
export * from './moldura';
export * from './graficoDeBaleia';
export * from './listas';
