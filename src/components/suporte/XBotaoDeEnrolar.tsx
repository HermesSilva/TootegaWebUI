/**
 * XBotaoDeEnrolar — o micro botão que enrola e desenrola os painéis de controle do suporte (dono, 2026-11-19):
 * enrolado, o painel fica só na alça de arrasto, com a situação da ligação, e neste botão. O estado vem no ícone
 * (seta para cima = desenrolar), no `aria-expanded` e no hint, não só na aparência.
 */

import type { JSX } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface XBotaoDeEnrolarProps {
  enrolado: boolean;
  aoAlternar: () => void;
}

export function XBotaoDeEnrolar({ enrolado, aoAlternar }: XBotaoDeEnrolarProps): JSX.Element {
  const dica = enrolado ? 'Desenrolar o painel' : 'Enrolar o painel';

  return (
    <button
      type="button" onClick={aoAlternar} aria-expanded={!enrolado} aria-label={dica} title={dica}
      // A alça de arrasto fica ao lado: o clique aqui não começa um arrasto.
      onPointerDown={(pEvento) => pEvento.stopPropagation()}
      data-testid="suporte-enrolar"
      className="inline-flex items-center justify-center w-5 h-5 shrink-0 self-start rounded text-brand-text-secondary hover:bg-hover"
    >
      {enrolado ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
    </button>
  );
}
