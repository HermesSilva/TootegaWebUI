import { useCallback, useRef, useState } from 'react';
import { api } from '@core/lib';
import { useFormBusy } from '@core/hooks/useFormBusy';

/**
 * Busca de CEP compartilhada pelo campo de formulário (XCEPEditor) e pela célula de grade
 * (XItemsGridEditor). Concentra o que os dois têm em comum: consulta ao completar os oito dígitos,
 * VÉU que trava o formulário enquanto ela roda (useFormBusy — o modal cobre a área do App com o
 * indicador de progresso), dedup do último CEP consultado e o aviso de "não encontrado".
 *
 * A cadeia de endereço vem do back (CepLookupDTO: logradouro, complemento, bairro, cidade, uf, ibge,
 * ddd…); quem chamou decide para onde cada campo vai — o hook só entrega a resposta a `pAplicar`.
 *
 * Genérico (CE-19): não conhece App nem campo. Recebe o endpoint e devolve o resultado.
 */
export interface CepLookupState {
  /** Verdadeiro enquanto a consulta roda — o chamador mostra o spinner. */
  buscando: boolean;
  /** O provedor não achou o CEP: é AVISO, não erro (o usuário preenche à mão). */
  naoEncontrado: boolean;
  /** Consulta o CEP; achando, chama `pAplicar` com a resposta (a cadeia de endereço). */
  consultar: (pDigitos: string, pAplicar: (pResposta: Record<string, unknown>) => void) => Promise<void>;
  /** Limpa o aviso de não-encontrado (ao voltar a digitar). */
  limpar: () => void;
}

export function useCepLookup(pEndpoint: string | undefined): CepLookupState {
  const { marcarOcupado } = useFormBusy();
  const [buscando, setBuscando] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  // Último CEP consultado: o blur logo após digitar (ou uma re-renderização) não repete a chamada.
  const consultadoRef = useRef('');

  const limpar = useCallback((): void => setNaoEncontrado(false), []);

  const consultar = useCallback(
    async (pDigitos: string, pAplicar: (pResposta: Record<string, unknown>) => void): Promise<void> => {
      if (!pEndpoint || pDigitos.length !== 8 || consultadoRef.current === pDigitos)
        return;

      consultadoRef.current = pDigitos;
      setBuscando(true);
      setNaoEncontrado(false);
      marcarOcupado(true);
      try {
        // `true` = silencioso: 404/erro NÃO dispara o diálogo global; aqui o "não encontrado" é aviso
        // local, e a resposta (envelope já desembrulhado) é a cadeia de endereço.
        const resposta = await api.get<Record<string, unknown> | null>(`${pEndpoint}/${pDigitos}`, undefined, true);
        if (resposta)
          pAplicar(resposta);
        else {
          setNaoEncontrado(true);
          consultadoRef.current = '';   // resposta vazia: permite nova tentativa do mesmo CEP
        }
      } catch {
        // CEP inexistente (404) ou provedor fora do ar: aviso, nunca erro vermelho — o usuário digita à
        // mão. Solta a trava do último consultado, para uma nova tentativa do mesmo número valer.
        setNaoEncontrado(true);
        consultadoRef.current = '';
      } finally {
        setBuscando(false);
        marcarOcupado(false);
      }
    },
    [pEndpoint, marcarOcupado]);

  return { buscando, naoEncontrado, consultar, limpar };
}
