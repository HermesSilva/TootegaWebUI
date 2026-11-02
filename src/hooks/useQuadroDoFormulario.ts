import { useCallback } from 'react';
import { versaoDoModelo } from '@core/lib/appModelVersion';
import { chaveDoQuadroDoFormulario, type QuadroDeModal } from './useMolduraDeModal';
import { usePreferenciaDoUsuario } from './usePreferenciaDoUsuario';

/**
 * O quadro (posição e tamanho) que o usuário deixou num formulário, guardado no perfil.
 *
 * EM DESENVOLVIMENTO, CADA VERSÃO NOVA COMEÇA DO ZERO (dono, 2026-11-02). O tamanho salvo vence a largura
 * declarada no modelo (`ModalWidth`, FE-3) e até o piso dos editores (FE-9): quem alarga um modal no back
 * e tem um quadro antigo no perfil continua vendo o modal do mesmo tamanho, sem aviso nenhum. Por isso o
 * quadro leva a versão do modelo em que foi gravado, e em dev o de outra versão não vale mais. O registro
 * antigo fica no perfil até o próximo arrasto o sobrescrever: não se aplica, e é o que importa.
 *
 * A versão é a do MODELO, vinda do back (`appModelVersion`), porque é o back que define o formulário e é
 * ele que reinicia a cada mudança; o `__BUILD_VERSION__` do front só muda quando o Vite reinicia.
 *
 * Fora de desenvolvimento nada muda: o quadro do usuário sobrevive às versões.
 */
export function quadroVigente(
  pQuadro: QuadroDeModal | null, pVersao: string, pEmDesenvolvimento: boolean,
): QuadroDeModal | null {
  if (!pQuadro || !pEmDesenvolvimento)
    return pQuadro;

  return pQuadro.versao === pVersao ? pQuadro : null;
}

/** @returns `[quadro, gravar]` — o quadro que ainda vale e a gravação que o carimba com a versão corrente. */
export function useQuadroDoFormulario(pNomeDoFormulario: string): [QuadroDeModal | null, (pQuadro: QuadroDeModal) => void] {
  const [salvo, salvar] = usePreferenciaDoUsuario<QuadroDeModal | null>(
    chaveDoQuadroDoFormulario(pNomeDoFormulario), null);

  const gravar = useCallback(
    (pQuadro: QuadroDeModal) => salvar({ ...pQuadro, versao: versaoDoModelo() }),
    [salvar]);

  return [quadroVigente(salvo, versaoDoModelo(), import.meta.env.DEV), gravar];
}
