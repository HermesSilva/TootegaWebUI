/**
 * useAppX — a navegação do AppX para quem está dentro dele (um SubAppX): ir a um nível, a um registro e a um SubAppX
 * sem sair do AppX. Fora de um AppX, `null` — o SubAppX que também roda fora (raro) decide o que fazer sem ele.
 */

import { useContext } from 'react';
import { AppXContext, type XNavegacaoDoAppX } from '@core/contexts/AppXContext';

export function useAppX(): XNavegacaoDoAppX | null {
  return useContext(AppXContext);
}
