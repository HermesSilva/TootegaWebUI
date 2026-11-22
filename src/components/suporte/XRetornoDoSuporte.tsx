/**
 * XRetornoDoSuporte — o aviso, a quem chamou, de que um atendente retornou o chamado que ficou no quadro (dono,
 * 2026-11-19: "o retorno do atendente deve ser um popup, como o que o atendente recebe"). Diz quem é o atendente e o
 * problema registrado, com "Atender" (entra no atendimento) e "Recusar" (encerra o atendimento: o atendente fica
 * sabendo). Fechar no X é "agora não": o aviso sai, o atendimento continua à espera, e "Chamar suporte" entra nele.
 *
 * Quem toca o toque e fecha o aviso quando o atendimento cai é o `XChamarSuporte`, dono do estado da chamada. É
 * diálogo DA CASCA (nasce do aviso em tempo real, nenhuma App o aciona), por isso usa overlay.
 */

import { type JSX } from 'react';
import { Headset, PhoneOff } from 'lucide-react';

import { XModalShell } from '@core/components/templates/XModalShell';
import type { ChamadaDeSuporte } from '@core/lib/suporte/tipos';

interface XRetornoDoSuporteProps {
  chamada: ChamadaDeSuporte;
  /** Atender ou recusar está em curso (os botões esperam). */
  ocupado?: boolean;
  aoAtender: () => void;
  aoRecusar: () => void;
  aoDispensar: () => void;
}

export function XRetornoDoSuporte({ chamada, ocupado = false, aoAtender, aoRecusar, aoDispensar }: XRetornoDoSuporteProps): JSX.Element {
  return (
    <XModalShell variant="overlay" size="sm" title={'O suporte retornou'} closeLabel={'Agora não'} onClose={aoDispensar}>
      <div className="w-full sm:w-[28rem] p-5 space-y-4 text-ui text-brand-text-primary" data-testid="retorno-do-suporte">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-indigo-600/15 text-indigo-500" aria-hidden="true">
            <Headset className="w-5 h-5 animate-pulse" />
          </span>
          <div className="min-w-0 space-y-1" role="status" aria-live="assertive">
            <p>
              <strong>{chamada.atendente || 'Um atendente'}</strong>{' está pronto para atender o chamado que você registrou.'}
            </p>
            <p className="text-ui-sm text-brand-text-secondary">
              {'Ao atender, ele vê a sua tela, fala com você e poderá operar esta aba. Você encerra quando quiser.'}
            </p>
          </div>
        </div>
        {chamada.descricao && (
          <p className="text-ui-sm" data-testid="retorno-do-suporte-descricao">
            <span className="font-medium">{'O problema registrado: '}</span>{chamada.descricao}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button" onClick={aoRecusar} disabled={ocupado} data-testid="retorno-do-suporte-recusar"
            title={'Recusar encerra o atendimento; o atendente fica sabendo'}
            className="inline-flex items-center gap-2 px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover disabled:opacity-50"
          >
            <PhoneOff className="w-4 h-4" aria-hidden="true" /> {'Recusar'}
          </button>
          <button
            type="button" onClick={aoAtender} disabled={ocupado} autoFocus data-testid="retorno-do-suporte-atender"
            className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50"
          >
            <Headset className="w-4 h-4" aria-hidden="true" /> {'Atender'}
          </button>
        </div>
      </div>
    </XModalShell>
  );
}
