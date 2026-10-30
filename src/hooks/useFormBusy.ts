import { useContext } from 'react';
import { FormBusyContext, type FormBusyContextValue } from '@core/contexts/FormBusyContext';

/**
 * Estado "o formulário está ocupado" (ver FormBusyProvider). Um editor que dispare trabalho demorado
 * — a consulta do documento à Receita, por exemplo — marca o formulário como ocupado, e o modal
 * cobre a tela com o indicador de progresso enquanto isso durar.
 */
export function useFormBusy(): FormBusyContextValue {
  return useContext(FormBusyContext);
}
