import { createContext, useCallback, useMemo, useState, type ReactNode, type JSX } from 'react';

/**
 * "O formulário está ocupado" — estado compartilhado entre os EDITORES e o MODAL que os hospeda.
 *
 * Um editor pode disparar trabalho demorado por conta própria: o editor de documento consulta a
 * Receita assim que o CNPJ fica válido, e essa chamada pode levar segundos. Enquanto ela roda, o
 * usuário não deve continuar digitando num formulário que está prestes a ser reescrito pela resposta
 * — daí o véu com o indicador de progresso, no centro do formulário.
 *
 * Genérico (CE-19): o contexto não conhece App, editor ou motivo. Qualquer editor marca o formulário
 * como ocupado; o modal apenas exibe. Fora de um modal (sem provider), `marcarOcupado` é inerte.
 */
export interface FormBusyContextValue {
  /** Verdadeiro enquanto houver ao menos um trabalho em curso. */
  isBusy: boolean;
  /**
   * Verdadeiro quando o formulário está em INCLUSÃO (registro novo). Editor que consulta um cadastro
   * externo para PREENCHER o formulário — o documento, que busca a Receita — só o faz na inclusão
   * (dono, 2026-10-12): em edição o registro já existe, e a consulta reescreveria o que foi gravado
   * e ainda acusaria "documento já cadastrado" contra o próprio registro. Sem provider, vale
   * verdadeiro: fora de um modal não há edição a proteger.
   */
  emInclusao: boolean;
  /** Liga/desliga um trabalho. Trabalhos simultâneos são contados — o véu some no último a terminar. */
  marcarOcupado: (pOcupado: boolean) => void;
}

export const FormBusyContext = createContext<FormBusyContextValue>({
  isBusy: false,
  emInclusao: true,
  marcarOcupado: () => {},
});

interface FormBusyProviderProps {
  children: ReactNode;
  /** O modal informa se o registro é novo; omitido, o formulário é tratado como inclusão. */
  emInclusao?: boolean;
}

export function FormBusyProvider({ children, emInclusao = true }: FormBusyProviderProps): JSX.Element {
  const [pendentes, setPendentes] = useState(0);

  const marcarOcupado = useCallback((pOcupado: boolean): void => {
    setPendentes((atual) => Math.max(0, atual + (pOcupado ? 1 : -1)));
  }, []);

  const value = useMemo(
    (): FormBusyContextValue => ({ isBusy: pendentes > 0, emInclusao, marcarOcupado }),
    [pendentes, emInclusao, marcarOcupado]);

  return <FormBusyContext.Provider value={value}>{children}</FormBusyContext.Provider>;
}
