import { createContext, useMemo, type ReactNode, type JSX } from 'react';

/**
 * Os VALORES CORRENTES do formulário, à disposição dos editores que precisam saber o que o usuário
 * já decidiu em OUTRO campo — sem que o modal tenha de passar o formulário inteiro editor a editor.
 *
 * Nasceu no picker da grade de itens (dono, 2026-10-17): a devolução escolhe o destinatário na
 * primeira aba, e a lista de itens de nota, na terceira, tem de vir filtrada pelas notas de saída
 * feitas para ele. O editor lê daqui o documento do destinatário e a operação, e os manda como
 * filtro fixo ao back (`pickerContextBindings` do modelo). Quem decide QUAIS campos viajam é o
 * back (CE-19); este contexto só expõe o que o formulário tem.
 *
 * Somente leitura, por desenho: o editor consulta, nunca escreve — gravar continua passando pelo
 * `onChange` de cada campo. Fora de um modal (sem provider), o formulário é vazio.
 */
export interface FormValuesContextValue {
  /** O estado do formulário, pelo nome do campo (a leitura tolerante a caixa é do `getFieldValue`). */
  valores: Record<string, unknown>;
}

export const FormValuesContext = createContext<FormValuesContextValue>({ valores: {} });

interface FormValuesProviderProps {
  children: ReactNode;
  valores: Record<string, unknown>;
}

export function FormValuesProvider({ children, valores }: FormValuesProviderProps): JSX.Element {
  const value = useMemo((): FormValuesContextValue => ({ valores }), [valores]);
  return <FormValuesContext.Provider value={value}>{children}</FormValuesContext.Provider>;
}
