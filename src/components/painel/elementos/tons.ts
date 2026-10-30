/**
 * A cor de cada tom, numa fonte só. Usa os tokens do tema (`success`, `warning`, `danger`, `info`), que trocam de
 * matiz junto com o tema claro/escuro — o painel nunca crava cor.
 */

import type { XTomDoPainel } from './tipos';

/** Pastilha: fundo suave + texto do tom. */
export const PASTILHA_DO_TOM: Record<XTomDoPainel, string> = {
  neutro: 'bg-muted-bg text-brand-text-secondary',
  info: 'bg-info-bg text-info',
  sucesso: 'bg-success-bg text-success',
  aviso: 'bg-warning-bg text-warning',
  perigo: 'bg-danger-bg text-danger',
};

/** Ponto de status (o "●"). */
export const PONTO_DO_TOM: Record<XTomDoPainel, string> = {
  neutro: 'bg-brand-text-muted',
  info: 'bg-info',
  sucesso: 'bg-success',
  aviso: 'bg-warning',
  perigo: 'bg-danger',
};

/** Texto no tom, sem fundo. */
export const TEXTO_DO_TOM: Record<XTomDoPainel, string> = {
  neutro: 'text-brand-text-secondary',
  info: 'text-info',
  sucesso: 'text-success',
  aviso: 'text-warning',
  perigo: 'text-danger',
};
