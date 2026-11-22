/**
 * XSeletorDeHora — a escolha de hora e minuto do editor de data do motor (dono, 2026-11-21): duas colunas que rolam,
 * horas (00 a 23) e minutos (00 a 59). Aparece sozinho no campo de hora e ao lado do calendário no campo de data e
 * hora.
 *
 * É lista da página, e não a do navegador: segue o tema e recebe clique pelo controle remoto do suporte.
 */

import { useEffect, useRef, type JSX } from 'react';

interface XSeletorDeHoraProps {
  /** `hh:mm`, ou vazio quando ainda não há hora. */
  valor: string;
  aoMudar: (pHora: string) => void;
  /** Altura das colunas: a do calendário, quando fica ao lado dele. */
  altura?: string;
}

const dois = (pNumero: number): string => String(pNumero).padStart(2, '0');

const HORAS = Array.from({ length: 24 }, (_, pIndice) => dois(pIndice));
const MINUTOS = Array.from({ length: 60 }, (_, pIndice) => dois(pIndice));

function Coluna({ rotulo, opcoes, escolhida, aoEscolher, altura }: {
  rotulo: string; opcoes: string[]; escolhida: string; aoEscolher: (pOpcao: string) => void; altura: string;
}): JSX.Element {
  const lista = useRef<HTMLDivElement | null>(null);

  // A opção escolhida fica à vista ao abrir e quando muda por digitação.
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'center' });
  }, [escolhida]);

  return (
    <div className="flex flex-col items-center">
      <span className="h-7 text-ui-xs font-medium text-brand-text-secondary">{rotulo}</span>
      <div
        ref={lista} role="listbox" aria-label={rotulo} data-testid={`hora-${rotulo.toLowerCase()}`}
        className={`${altura} w-12 overflow-y-auto scrollbar-thin space-y-0.5 pr-0.5`}
      >
        {opcoes.map((pOpcao) => {
          const ativa = pOpcao === escolhida;

          return (
            <button
              key={pOpcao} type="button" tabIndex={-1} role="option" aria-selected={ativa}
              onClick={() => aoEscolher(pOpcao)}
              className={`block w-full h-7 rounded-md text-ui-sm focus:outline-none ${
                ativa ? 'font-semibold text-white bg-indigo-700' : 'text-brand-text-primary hover:bg-hover'}`}
            >
              {pOpcao}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function XSeletorDeHora({ valor, aoMudar, altura = 'h-48' }: XSeletorDeHoraProps): JSX.Element {
  const partes = /^(\d{2}):(\d{2})/.exec(valor);
  const hora = partes?.[1] ?? '';
  const minuto = partes?.[2] ?? '';

  // Escolher só a hora (ou só o minuto) já forma um valor: a outra metade começa em zero.
  return (
    <div className="flex gap-2 p-3 select-none" data-testid="seletor-de-hora">
      <Coluna rotulo={'Hora'} opcoes={HORAS} escolhida={hora} altura={altura} aoEscolher={(pHora) => aoMudar(`${pHora}:${minuto || '00'}`)} />
      <Coluna rotulo={'Minuto'} opcoes={MINUTOS} escolhida={minuto} altura={altura} aoEscolher={(pMinuto) => aoMudar(`${hora || '00'}:${pMinuto}`)} />
    </div>
  );
}
