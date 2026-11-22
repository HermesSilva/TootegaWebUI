/**
 * XCalendario — o calendário do editor de data do motor (dono, 2026-11-21): o mês em seis semanas, do domingo ao
 * sábado, com "Limpar" e "Hoje".
 *
 * <b>No alto, dois botões: o MÊS e o ANO</b> (dono, 2026-11-21), para ir longe sem clicar seta por seta. O do mês
 * abre os doze meses; o do ano abre uma página de doze anos. Escolhido o mês ou o ano, volta-se aos dias. As setas ao
 * lado andam conforme o que está na tela: um mês nos dias, um ano nos meses, doze anos nos anos.
 *
 * É só o desenho e os cliques: quem guarda o valor, o dia em foco e o que fazer com a escolha é o `XCampoDeData`,
 * que também trata o teclado (as teclas chegam ao campo de texto, que continua em foco enquanto o calendário está
 * aberto — é assim que se digita a data e se anda pelos dias sem trocar de lugar).
 *
 * Estado nunca só por cor (WCAG 1.4.1): o dia escolhido é preenchido E marcado `aria-selected`; hoje tem contorno;
 * o dia em foco pelo teclado tem anel; dia fora da faixa fica riscado e desabilitado; o botão de mês ou de ano cuja
 * lista está aberta fica marcado `aria-pressed` e com contorno.
 */

import { useState, type JSX } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  DIAS_DA_SEMANA, NOMES_DOS_MESES, dataPorExtenso, foraDaFaixa, partesDaData, semanasDoMes, somarMeses,
} from '@core/lib/dataDigitada';

interface XCalendarioProps {
  /** O dia escolhido, `aaaa-mm-dd`, ou vazio. */
  valor: string;
  /** O dia em foco: é o mês dele que aparece, e é ele que o Enter escolhe. */
  foco: string;
  /** Hoje, `aaaa-mm-dd`. */
  hoje: string;
  minimo?: string;
  maximo?: string;
  aoFocar: (pData: string) => void;
  aoEscolher: (pData: string) => void;
  aoLimpar: () => void;
}

type Modo = 'dias' | 'meses' | 'anos';

/** Quantos anos cabem numa página da escolha de ano. */
const ANOS_POR_PAGINA = 12;

const ANEL_DE_FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary';

const BOTAO_DE_SETA = `inline-flex items-center justify-center w-7 h-7 rounded-md text-brand-text-primary hover:bg-hover ${ANEL_DE_FOCO} `
  + 'disabled:opacity-40 disabled:cursor-not-allowed';

const BOTAO_DE_RODAPE = `px-2 py-1 rounded-md text-ui-sm font-medium text-brand-text-primary hover:bg-hover ${ANEL_DE_FOCO} `
  + 'disabled:opacity-40 disabled:cursor-not-allowed';

const BOTAO_DO_TITULO = `px-2 py-1 rounded-md border text-ui font-semibold text-brand-text-primary hover:bg-hover ${ANEL_DE_FOCO}`;

const OPCAO_DA_LISTA = `h-9 rounded-md text-ui-sm ${ANEL_DE_FOCO}`;

/** O que cada seta anda, e como se chama, conforme o que está na tela. */
const PASSO_DO_MODO: Record<Modo, { meses: number; anterior: string; seguinte: string }> = {
  dias: { meses: 1, anterior: 'Mês anterior', seguinte: 'Mês seguinte' },
  meses: { meses: 12, anterior: 'Ano anterior', seguinte: 'Ano seguinte' },
  anos: { meses: 12 * ANOS_POR_PAGINA, anterior: 'Doze anos antes', seguinte: 'Doze anos depois' },
};

/** Maiúscula só na primeira letra: "Novembro". */
const comInicial = (pTexto: string): string => pTexto.charAt(0).toUpperCase() + pTexto.slice(1);

export function XCalendario({ valor, foco, hoje, minimo, maximo, aoFocar, aoEscolher, aoLimpar }: XCalendarioProps): JSX.Element {
  const [modo, setModo] = useState<Modo>('dias');
  const { ano, mes } = partesDaData(foco) ?? partesDaData(hoje)!;
  const nomeDoMes = comInicial(NOMES_DOS_MESES[mes - 1]);
  const passo = PASSO_DO_MODO[modo];

  // O limite, só na parte da data: o calendário escolhe dia, e a hora (quando há) é conferida por quem o usa.
  const minimoDoDia = minimo?.slice(0, 10);
  const maximoDoDia = maximo?.slice(0, 10);
  const hojeForaDaFaixa = foraDaFaixa(hoje, minimoDoDia, maximoDoDia);

  // A página de anos que contém o ano em foco: 2017 a 2028, 2029 a 2040…
  const primeiroAno = ano - ((ano - 1) % ANOS_POR_PAGINA);
  const anos = Array.from({ length: ANOS_POR_PAGINA }, (_, pIndice) => primeiroAno + pIndice).filter((pAno) => pAno <= 9999);

  // Clicar de novo no botão cuja lista está aberta volta aos dias.
  const alternar = (pModo: Modo): void => setModo((pAtual) => (pAtual === pModo ? 'dias' : pModo));

  const titulo = (pModo: Modo, pTexto: string, pDica: string, pTestID: string): JSX.Element => (
    <button
      type="button" tabIndex={-1} aria-pressed={modo === pModo} title={pDica} data-testid={pTestID}
      onClick={() => alternar(pModo)}
      className={`${BOTAO_DO_TITULO} ${modo === pModo ? 'border-brand-text-primary' : 'border-transparent'}`}
    >
      {pTexto}
    </button>
  );

  return (
    <div className="w-64 p-3 select-none" data-testid="calendario" data-modo={modo}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5 -ml-2" aria-live="polite">
          {titulo('meses', nomeDoMes, 'Escolher o mês', 'calendario-mes')}
          {titulo('anos', String(ano), 'Escolher o ano', 'calendario-ano')}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button" tabIndex={-1} className={BOTAO_DE_SETA}
            aria-label={passo.anterior} title={passo.anterior} onClick={() => aoFocar(somarMeses(foco, -passo.meses))}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button" tabIndex={-1} className={BOTAO_DE_SETA}
            aria-label={passo.seguinte} title={passo.seguinte} onClick={() => aoFocar(somarMeses(foco, passo.meses))}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {modo === 'meses' && (
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={`Meses de ${ano}`}>
          {NOMES_DOS_MESES.map((pNome, pIndice) => {
            const doFoco = pIndice + 1 === mes;

            return (
              <button
                key={pNome} type="button" tabIndex={-1} aria-pressed={doFoco}
                onClick={() => {
                  aoFocar(somarMeses(foco, pIndice + 1 - mes));
                  setModo('dias');
                }}
                className={`${OPCAO_DA_LISTA} ${doFoco ? 'font-semibold text-white bg-indigo-700' : 'text-brand-text-primary hover:bg-hover'}`}
              >
                {comInicial(pNome)}
              </button>
            );
          })}
        </div>
      )}

      {modo === 'anos' && (
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={`Anos de ${anos[0]} a ${anos[anos.length - 1]}`}>
          {anos.map((pAno) => {
            const doFoco = pAno === ano;

            return (
              <button
                key={pAno} type="button" tabIndex={-1} aria-pressed={doFoco}
                onClick={() => {
                  aoFocar(somarMeses(foco, (pAno - ano) * 12));
                  setModo('dias');
                }}
                className={`${OPCAO_DA_LISTA} ${doFoco ? 'font-semibold text-white bg-indigo-700' : 'text-brand-text-primary hover:bg-hover'}`}
              >
                {pAno}
              </button>
            );
          })}
        </div>
      )}

      {modo === 'dias' && (
        <table role="grid" aria-label={`${nomeDoMes} de ${ano}`} className="w-full border-separate border-spacing-0.5">
          <thead>
            <tr>
              {DIAS_DA_SEMANA.map((pDia) => (
                <th key={pDia.curto} scope="col" abbr={pDia.nome} className="h-7 text-ui-xs font-medium text-brand-text-secondary">
                  {pDia.curto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanasDoMes(ano, mes).map((pSemana) => (
              <tr key={pSemana[0].data}>
                {pSemana.map((pDia) => {
                  const escolhido = pDia.data === valor;
                  const emFoco = pDia.data === foco;
                  const ehHoje = pDia.data === hoje;
                  const bloqueado = foraDaFaixa(pDia.data, minimoDoDia, maximoDoDia);

                  return (
                    <td key={pDia.data} role="gridcell" aria-selected={escolhido} className="p-0 text-center">
                      <button
                        type="button" tabIndex={-1} disabled={bloqueado} data-dia={pDia.data}
                        aria-label={dataPorExtenso(pDia.data) + (ehHoje ? ' (hoje)' : '')}
                        aria-current={ehHoje ? 'date' : undefined}
                        onClick={() => aoEscolher(pDia.data)}
                        className={[
                          'w-8 h-8 rounded-md text-ui-sm focus:outline-none',
                          escolhido
                            ? 'font-semibold text-white bg-indigo-700'
                            : pDia.doMes ? 'text-brand-text-primary hover:bg-hover' : 'text-brand-text-secondary hover:bg-hover',
                          ehHoje && !escolhido ? 'border border-brand-text-primary font-semibold' : '',
                          emFoco ? 'ring-2 ring-brand-primary ring-offset-1 ring-offset-brand-surface' : '',
                          bloqueado ? 'opacity-40 line-through cursor-not-allowed hover:bg-transparent' : '',
                        ].join(' ')}
                      >
                        {pDia.dia}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
        <button type="button" tabIndex={-1} className={BOTAO_DE_RODAPE} onClick={aoLimpar} data-testid="calendario-limpar">
          {'Limpar'}
        </button>
        <button
          type="button" tabIndex={-1} className={BOTAO_DE_RODAPE} disabled={hojeForaDaFaixa} data-testid="calendario-hoje"
          title={hojeForaDaFaixa ? 'Hoje está fora das datas que este campo aceita.' : undefined}
          onClick={() => aoEscolher(hoje)}
        >
          {'Hoje'}
        </button>
      </div>
    </div>
  );
}
