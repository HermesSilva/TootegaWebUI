/**
 * useRecalculoAoDigitar — o RECÁLCULO enquanto se digita (dono, 2026-10-25), num lugar só para o modal de
 * ação de linha (`XRowAction.recalcEndpoint`) e o formulário da App (`XFormView.recalcEndpoint`).
 *
 * Cada alteração de um campo-gatilho conta uma versão; a versão nova cancela a espera da anterior, e só a
 * última, passado o `espera`, vai ao back com os valores correntes. A resposta atualiza os campos casados
 * pelo nome (tolerante a caixa: o corpo chega em camelCase), MENOS os gatilhos — eles são do usuário, e
 * sobrescrevê-los mudaria o valor sob os dedos. Sem gatilho declarado, todo campo editável é gatilho, e
 * só os de leitura recebem a resposta. Resposta de versão superada é descartada.
 *
 * A falha já sai pelo diálogo global (api); o campo recalculado fica com o último valor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@core/lib/api';
import { getFieldValue } from '@core/lib';

interface CampoRecalculavel {
  fieldName: string;
  editor?: { isReadOnly?: boolean } | null;
}

export interface OpcoesRecalculo {
  /** O POST de recálculo, já com os marcadores resolvidos. Vazio/ausente ⇒ não recalcula. */
  endpoint?: string;
  gatilhos?: string[];
  /** Espera depois da última digitação, em ms. Padrão: 300. */
  espera?: number;
  campos: CampoRecalculavel[];
  /** Os valores correntes do formulário (o corpo do POST). */
  valores: Record<string, unknown>;
  /** Aplica a resposta aos valores (setState funcional). */
  aplicar: (pAtualizar: (pAnteriores: Record<string, unknown>) => Record<string, unknown>) => void;
}

/** @returns `notificar(nomeDoCampo)` — chame-o a cada alteração de campo feita pelo usuário. */
export function useRecalculoAoDigitar({
  endpoint,
  gatilhos,
  espera = 300,
  campos,
  valores,
  aplicar,
}: OpcoesRecalculo): (pCampo: string) => void {
  const gatilhosMinusculos = useMemo(() => (gatilhos ?? []).map((pNome) => pNome.toLowerCase()), [gatilhos]);
  const [versao, setVersao] = useState(0);
  const valoresRef = useRef(valores);
  valoresRef.current = valores;

  const ehGatilho = useCallback((pCampo: CampoRecalculavel) => gatilhosMinusculos.length === 0
    ? pCampo.editor?.isReadOnly !== true
    : gatilhosMinusculos.includes(pCampo.fieldName.toLowerCase()), [gatilhosMinusculos]);

  const notificar = useCallback((pCampo: string) => {
    if (!endpoint)
      return;
    const campo = campos.find((pC) => pC.fieldName.toLowerCase() === pCampo.toLowerCase());
    if (gatilhosMinusculos.length === 0 ? campo?.editor?.isReadOnly !== true : gatilhosMinusculos.includes(pCampo.toLowerCase()))
      setVersao((pVersao) => pVersao + 1);
  }, [endpoint, campos, gatilhosMinusculos]);

  useEffect(() => {
    if (versao === 0 || !endpoint)
      return;

    let vigente = true;
    const temporizador = setTimeout(() => {
      void (async () => {
        try {
          const resposta = await api.post<Record<string, unknown>>(endpoint, valoresRef.current);
          if (!vigente || !resposta)
            return;
          aplicar((pAnteriores) => {
            const novos = { ...pAnteriores };
            for (const campo of campos) {
              if (ehGatilho(campo))
                continue;
              const valor = getFieldValue(resposta, campo.fieldName);
              if (valor !== undefined)
                novos[campo.fieldName] = valor;
            }
            return novos;
          });
        } catch {
          // A falha já foi mostrada pelo diálogo global; o campo recalculado fica com o último valor.
        }
      })();
    }, espera);

    return () => { vigente = false; clearTimeout(temporizador); };
  // Só a versão dispara: os valores são lidos da referência na hora do envio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  return notificar;
}
