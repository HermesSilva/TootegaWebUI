/**
 * XChamadaRecebida — o aviso, ao atendente, de que entrou chamada de suporte na fila (dono, 2026-11-19): quem
 * chamou, de que assinante e grupo, o problema que descreveu e quanto falta do prazo de espera, com o botão que
 * inicia o atendimento.
 *
 * É diálogo DA CASCA (nasce do aviso do cabeçalho, nenhuma App o aciona), por isso usa overlay. "Atender" não
 * atende daqui: abre a App "Atendimento de suporte" (ou a traz para a frente) apertando o botão "Atender a
 * próxima" dela, e é lá que a sessão acontece, contida na área da App. A chamada assumida é a mais antiga da
 * fila — a mesma que este aviso mostra, salvo se outro atendente a assumiu no meio do caminho, e então vem a
 * seguinte (ou o aviso de que a fila esvaziou).
 *
 * Em atendimento, o aviso aparece do mesmo jeito, mas não atende: o atendente cuida de uma chamada por vez, e
 * "Atender a próxima" o devolveria ao atendimento em curso. O aviso diz isso e deixa a chamada na fila.
 */

import { useEffect, useState, type JSX } from 'react';
import { Headset, TriangleAlert } from 'lucide-react';

import { XModalShell } from '@core/components/templates/XModalShell';
import { formatarEspera, type ChamadaDeSuporte } from '@core/lib/suporte/tipos';

interface XChamadaRecebidaProps {
  chamada: ChamadaDeSuporte;
  /** Quantas chamadas esperam na fila, contando esta. */
  naFila: number;
  /** O atendente já está atendendo alguém: o aviso informa, mas não atende. */
  emAtendimento?: boolean;
  aoAtender: () => void;
  aoDispensar: () => void;
}

export function XChamadaRecebida({ chamada, naFila, emAtendimento = false, aoAtender, aoDispensar }: XChamadaRecebidaProps): JSX.Element {
  const [restantes, setRestantes] = useState(chamada.segundosRestantes);

  // O prazo é do servidor; aqui ele só é contado para baixo, e recomeça a cada leitura nova.
  useEffect(() => {
    setRestantes(chamada.segundosRestantes);

    const relogio = window.setInterval(() => setRestantes((pAtual) => Math.max(0, pAtual - 1)), 1000);

    return () => window.clearInterval(relogio);
  }, [chamada.id, chamada.segundosRestantes]);

  const outras = naFila - 1;

  return (
    <XModalShell variant="overlay" size="sm" title={'Chamada de suporte'} closeLabel={'Agora não'} onClose={aoDispensar}>
      <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="chamada-recebida">
        <div className="flex items-start gap-3">
          <Headset className="w-6 h-6 mt-0.5 shrink-0 text-indigo-700 animate-pulse" aria-hidden="true" />
          <div className="min-w-0" role="status" aria-live="assertive">
            <p className="font-semibold">{chamada.usuario}</p>
            <p className="text-ui-sm text-brand-text-secondary">{`${chamada.assinante} · grupo ${chamada.grupo}`}</p>
          </div>
        </div>
        {chamada.descricao && (
          <p className="text-ui-sm" data-testid="chamada-recebida-descricao">
            <span className="font-medium">{'Problema descrito: '}</span>{chamada.descricao}
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ui-sm">
          <dt className="text-brand-text-secondary">{'Resta do prazo de espera'}</dt>
          <dd className="font-semibold tabular-nums" role="timer" data-testid="chamada-recebida-prazo">{formatarEspera(restantes)}</dd>
          {outras > 0 && (
            <>
              <dt className="text-brand-text-secondary">{'Também na fila'}</dt>
              <dd className="font-semibold">{outras === 1 ? '1 chamada' : `${outras} chamadas`}</dd>
            </>
          )}
        </dl>
        {emAtendimento && (
          <p className="flex items-start gap-2 text-ui-sm" data-testid="chamada-recebida-em-atendimento">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong>{'Você está em um atendimento.'}</strong>
              {' Um atendente cuida de uma chamada por vez: encerre o atendimento em curso para atender esta. Ela '
                + 'continua na fila até alguém atender ou o prazo vencer.'}
            </span>
          </p>
        )}
        <p className="text-ui-sm text-brand-text-secondary">
          {'Se ninguém atender no prazo, a chamada vai ao quadro do suporte, e alguém precisa retornar depois.'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={aoDispensar} data-testid="chamada-recebida-dispensar"
            className="px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover"
          >
            {'Agora não'}
          </button>
          <button
            type="button" onClick={aoAtender} autoFocus={!emAtendimento} disabled={emAtendimento} data-testid="chamada-recebida-atender"
            title={emAtendimento ? 'Encerre o atendimento em curso para atender esta chamada' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Headset className="w-4 h-4" aria-hidden="true" /> {'Atender'}
          </button>
        </div>
      </div>
    </XModalShell>
  );
}
