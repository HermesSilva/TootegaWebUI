/**
 * usePosicaoDoPainel — onde o usuário deixou o painel de controle do suporte, lembrado no perfil (dono, 2026-11-19:
 * "passe a salvar a posição do painel, tanto de atendente quanto de usuário"). Na próxima chamada o painel nasce ali,
 * ajustado à área se a janela encolheu (`useMolduraDeModal` recontém o quadro guardado).
 *
 * Só a POSIÇÃO: o painel não se redimensiona, e o tamanho dele muda com o que mostra (enrolado, câmeras).
 */

import { useCallback, useMemo } from 'react';

import type { QuadroDeModal } from '@core/hooks/useMolduraDeModal';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';

/** As chaves no perfil: um painel para quem chama, outro para quem atende. */
export const CHAVE_DO_PAINEL_DO_USUARIO = 'suporte.painel.usuario';
export const CHAVE_DO_PAINEL_DO_ATENDENTE = 'suporte.painel.atendente';

const numero = (pValor: unknown): pValor is number => typeof pValor === 'number' && Number.isFinite(pValor);

/** @returns `[posição guardada ou null, gravar]` — prontos para `quadroSalvo` e `aoMudarQuadro` da moldura. */
export function usePosicaoDoPainel(pChave: string): [QuadroDeModal | null, (pQuadro: QuadroDeModal) => void] {
  const [salva, salvar] = usePreferenciaDoUsuario<QuadroDeModal | null>(pChave, null);

  // Valor estranho no perfil (gravado por outra versão, editado à mão) vale como "nenhum": o painel nasce no padrão.
  const x = salva?.x;
  const y = salva?.y;
  const posicao = useMemo(() => (numero(x) && numero(y) ? { x, y } : null), [x, y]);

  const gravar = useCallback((pQuadro: QuadroDeModal) => salvar({ x: pQuadro.x, y: pQuadro.y }), [salvar]);

  return [posicao, gravar];
}
