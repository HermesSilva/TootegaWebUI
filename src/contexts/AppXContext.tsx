import { createContext } from 'react';
import type { XResolvedorDoAppX } from '@core/lib/resolvedorDoAppX';

/**
 * O AppX em que a árvore está (dono, 2026-10-25). Fora de AppX, `null`. Dá ao SubAppX as duas portas que ele tem para
 * navegar sem sair do AppX (regra de navegação do AppX — skill tootega-front):
 * - `resolverLink`: resolve um `[[app:X]]` — só SubAppX do próprio AppX abre; o resto fica texto (RX-1);
 * - `irPara`: leva o AppX a um nível (e, opcionalmente, a um registro e a um SubAppX dele) — o cartão do portfólio
 *   que abre o projeto, por exemplo.
 */
export interface XNavegacaoDoAppX {
  resolverLink: XResolvedorDoAppX;
  /** Vai ao nível `pNivel`; com `pRegistro`, troca o registro dele; com `pSecao`, abre esse SubAppX (com o recorte). */
  irPara: (pNivel: string, pRegistro?: string, pSecao?: string, pRecorte?: Record<string, string>) => void;
  /** O AppX tem o nível `pNivel` no modelo que o ator recebeu (já podado)? A ação que leva a ele só aparece se tiver. */
  temNivel: (pNivel: string) => boolean;
}

export const AppXContext = createContext<XNavegacaoDoAppX | null>(null);
