/**
 * As cores das séries do gráfico de baleia: um par CATEGÓRICO fixo, independente da cor da marca. Previsto = oliva (110°),
 * realizado = azul (242°) — o par padrão, escolhido pelo dono (2026-10-25); um SaaS pode sobrepor as variáveis.
 *
 * Os tons vêm de variáveis CSS POR TEMA (`coresDaBaleia.css`), escolhidos para passar a WCAG 2.2 AA em todos os temas
 * (dono, 2026-10-25): cada série com ao menos 3:1 contra a superfície. O realizado é OPACO e o fundo do previsto é leve
 * (10%), para a hachura opaca ter contraste sobre ele; o gráfico separa as séries com contorno na cor da superfície.
 * Valem em CSS (`style`), não em atributo de apresentação do SVG.
 */

import './coresDaBaleia.css';

export const COR_PREVISTO = 'var(--baleia-previsto)';
export const FUNDO_PREVISTO = 'color-mix(in srgb, var(--baleia-previsto) 10%, transparent)';
export const HACHURA_PREVISTO = 'var(--baleia-previsto)';

export const COR_REALIZADO = 'var(--baleia-realizado)';
export const PREENCHIMENTO_REALIZADO = 'var(--baleia-realizado)';
