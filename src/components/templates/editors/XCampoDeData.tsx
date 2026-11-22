/**
 * XCampoDeData — o campo de data, de data e hora e de hora do motor (dono, 2026-11-21). Substitui o campo nativo do
 * navegador nos três editores e na célula de data da grade de itens.
 *
 * <b>Por que próprio.</b> O campo do navegador escreve no formato do idioma do NAVEGADOR (`mm/dd/yyyy` numa tela em
 * português), não segue o tema do sistema, e o calendário dele não é da página: não recebe foco pelo controle remoto
 * do suporte nem aparece para o atendente clicar. Este é um campo de texto comum, com máscara, e um painel desenhado
 * pela página.
 *
 * <b>Como se usa.</b> Digita-se a data (`dd/mm/aaaa`; as barras entram sozinhas) ou escolhe-se no calendário, que
 * abre ao clicar no campo, no ícone ou com a seta para baixo. Com o calendário aberto o foco continua no campo: as
 * setas andam pelos dias, PageUp e PageDown trocam o mês, Enter escolhe e Esc fecha. O valor só é entregue quando a
 * data está inteira e existe; o que não existe (31/02) ou está fora da faixa do campo é recusado com o motivo escrito
 * embaixo, e ao sair do campo o texto volta ao último valor aceito.
 *
 * <b>O valor</b> é o mesmo que o campo nativo entregava (`aaaa-mm-dd`, `aaaa-mm-ddThh:mm`, `hh:mm`), e vazio é texto
 * vazio: quem usa converte para o que o formulário guarda.
 *
 * O painel abre pela regra única de painel ancorado a campo (`usePosicaoFlutuante`: abaixo, acima, direita, esquerda).
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type JSX, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarDays, ChevronDown, Clock } from 'lucide-react';

import { usePosicaoFlutuante } from '@core/hooks/usePosicaoFlutuante';
import { ZIndexManager } from '@core/lib/zIndexManager';
import {
  FORMATO_DO_TIPO, dataDeHoje, dataDoValor, digitacaoCompleta, escreverValor, foraDaFaixa, horaDoValor, lerDigitado,
  mascararData, somarDias, somarMeses, type TipoDeData,
} from '@core/lib/dataDigitada';

import { XCalendario } from './XCalendario';
import { XSeletorDeHora } from './XSeletorDeHora';

interface XCampoDeDataProps {
  tipo: TipoDeData;
  /** O valor no formato do tipo, ou vazio. */
  valor: string;
  /** Chamado com o valor novo (vazio = campo limpo). Só com data inteira, que existe e está na faixa. */
  aoMudar: (pValor: string) => void;
  id?: string;
  /** Limites, no formato do tipo. */
  minimo?: string;
  maximo?: string;
  desabilitado?: boolean;
  /** O formulário recusou o valor: a borda fica vermelha. */
  comErro?: boolean;
  /** Célula de grade: sem o ícone da esquerda, com as classes da célula no lugar das do editor, e o motivo da recusa no hint. */
  classeDaCelula?: string;
  /** Sobra espaço à direita, antes do botão de abrir, para o que vem em `children` (o botão de desfazer do editor). */
  comBotaoADireita?: boolean;
  /** O que fica dentro do quadro do campo, por cima dele (o botão de desfazer). */
  children?: ReactNode;
}

const ROTULO_DO_PAINEL: Record<TipoDeData, string> = {
  data: 'Abrir o calendário',
  dataHora: 'Abrir o calendário e a escolha de hora',
  hora: 'Abrir a escolha de hora',
};

/** O motivo da recusa do que foi digitado, completo: o que está errado e o que o campo aceita. */
function motivoDaRecusa(pTexto: string, pTipo: TipoDeData): string {
  if (pTipo === 'hora')
    return `${pTexto} não é uma hora que existe: a hora vai de 00 a 23 e o minuto, de 00 a 59.`;

  return `${pTexto} não existe no calendário. Confira o dia, o mês${pTipo === 'dataHora' ? ', o ano e a hora (de 00:00 a 23:59)' : ' e o ano'}.`;
}

function motivoDaFaixa(pTipo: TipoDeData, pMinimo?: string, pMaximo?: string): string {
  const minimo = pMinimo ? escreverValor(pMinimo, pTipo) : '';
  const maximo = pMaximo ? escreverValor(pMaximo, pTipo) : '';

  if (minimo && maximo)
    return `Este campo aceita de ${minimo} a ${maximo}.`;

  return minimo ? `Este campo aceita a partir de ${minimo}.` : `Este campo aceita até ${maximo}.`;
}

export function XCampoDeData({
  tipo, valor, aoMudar, id, minimo, maximo, desabilitado, comErro, classeDaCelula, comBotaoADireita, children,
}: XCampoDeDataProps): JSX.Element {
  const [texto, setTexto] = useState(() => escreverValor(valor, tipo));
  const [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState(false);
  const [camada, setCamada] = useState(0);
  // O dia em foco no calendário: o mês dele é o que aparece, e é ele que o Enter escolhe.
  const [foco, setFoco] = useState('');

  const quadro = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const painel = useRef<HTMLDivElement | null>(null);

  const { posicao } = usePosicaoFlutuante(aberto, quadro, painel);
  const temCalendario = tipo !== 'hora';

  // O valor mudou por fora (registro carregado, desfazer, escolha no calendário): o texto o acompanha.
  useEffect(() => {
    setTexto(escreverValor(valor, tipo));
  }, [valor, tipo]);

  const entregar = useCallback((pValor: string): boolean => {
    if (foraDaFaixa(pValor, minimo, maximo)) {
      setAviso(motivoDaFaixa(tipo, minimo, maximo));
      return false;
    }

    setAviso('');
    aoMudar(pValor);

    return true;
  }, [aoMudar, minimo, maximo, tipo]);

  const abrir = useCallback(() => {
    if (desabilitado || aberto)
      return;

    setFoco(dataDoValor(valor) || dataDeHoje());
    setCamada(ZIndexManager.next());
    setAberto(true);
  }, [aberto, desabilitado, valor]);

  const fechar = useCallback(() => setAberto(false), []);

  // Clique fora do campo e do painel fecha. Só isso, o Esc e o Tab fecham: escolher a hora não fecha.
  useEffect(() => {
    if (!aberto)
      return;

    const aoPressionarFora = (pEvento: MouseEvent): void => {
      const alvo = pEvento.target as Node;

      if (!quadro.current?.contains(alvo) && !painel.current?.contains(alvo))
        setAberto(false);
    };

    document.addEventListener('mousedown', aoPressionarFora);

    return () => document.removeEventListener('mousedown', aoPressionarFora);
  }, [aberto]);

  function aoDigitar(pEvento: ChangeEvent<HTMLInputElement>): void {
    const novo = mascararData(pEvento.target.value, tipo);

    setTexto(novo);
    setAviso('');

    if (novo === '') {
      if (valor !== '')
        aoMudar('');
      return;
    }

    if (!digitacaoCompleta(novo, tipo))
      return;

    const lido = lerDigitado(novo, tipo);

    if (lido === null) {
      setAviso(motivoDaRecusa(novo, tipo));
      return;
    }

    if (entregar(lido) && temCalendario)
      setFoco(dataDoValor(lido));
  }

  // Saiu do campo com data pela metade ou recusada: o texto volta ao último valor aceito. Foco que vai para o painel
  // (o controle remoto do suporte leva o foco ao botão clicado) não é sair do campo.
  function aoSair(pEvento: FocusEvent<HTMLInputElement>): void {
    if (painel.current?.contains(pEvento.relatedTarget as Node | null))
      return;

    setTexto(escreverValor(valor, tipo));
    setAviso('');
  }

  function escolherDia(pData: string): void {
    setFoco(pData);

    // Data e hora: o dia entra com a hora que já havia (ou meia-noite), e o painel fica para a hora ser escolhida.
    if (tipo === 'dataHora') {
      entregar(`${pData}T${horaDoValor(valor) || '00:00'}`);
      return;
    }

    if (entregar(pData))
      fechar();
  }

  function escolherHora(pHora: string): void {
    entregar(tipo === 'hora' ? pHora : `${dataDoValor(valor) || foco || dataDeHoje()}T${pHora}`);
  }

  function limpar(): void {
    setTexto('');
    setAviso('');
    if (valor !== '')
      aoMudar('');
    fechar();
  }

  function aoTeclar(pEvento: KeyboardEvent<HTMLInputElement>): void {
    if (!aberto) {
      if (pEvento.key === 'ArrowDown' && !pEvento.ctrlKey && !pEvento.metaKey) {
        pEvento.preventDefault();
        abrir();
      }
      return;
    }

    if (pEvento.key === 'Escape') {
      // O Esc é do painel: não chega a quem está por fora.
      pEvento.preventDefault();
      pEvento.stopPropagation();
      fechar();
      return;
    }

    if (pEvento.key === 'Tab') {
      fechar();
      return;
    }

    if (!temCalendario)
      return;

    const passos: Record<string, (pData: string) => string> = {
      ArrowLeft: (pData) => somarDias(pData, -1),
      ArrowRight: (pData) => somarDias(pData, 1),
      ArrowUp: (pData) => somarDias(pData, -7),
      ArrowDown: (pData) => somarDias(pData, 7),
      PageUp: (pData) => somarMeses(pData, -1),
      PageDown: (pData) => somarMeses(pData, 1),
    };

    const passo = passos[pEvento.key];

    if (passo) {
      pEvento.preventDefault();
      setFoco((pAtual) => passo(pAtual || dataDeHoje()));
      return;
    }

    // Enter escolhe o dia em foco — a não ser que o que está digitado já seja ele (aí o Enter é do formulário).
    if (pEvento.key === 'Enter' && foco && dataDoValor(valor) !== foco && !foraDaFaixa(foco, minimo?.slice(0, 10), maximo?.slice(0, 10))) {
      pEvento.preventDefault();
      escolherDia(foco);
    }
  }

  // À esquerda, o ícone que diz o que o campo é (como nos demais editores); à direita, o botão que abre o painel —
  // o lugar em que o campo do navegador o tinha, e onde o usuário o procura.
  const Icone = tipo === 'hora' ? Clock : Calendar;
  const IconeDeAbrir = tipo === 'hora' ? ChevronDown : CalendarDays;
  const recusado = aviso !== '';

  const classeDoCampo = classeDaCelula
    ?? `w-full h-editor pl-10 ${comBotaoADireita ? 'pr-14' : 'pr-9'} text-ui rounded-lg border bg-brand-surface text-brand-text-primary `
      + 'placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent '
      + 'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg '
      + (comErro || recusado ? 'border-danger focus:ring-danger' : 'border-border');

  return (
    <>
      <div ref={quadro} className="relative" data-campo-de-data={tipo}>
        {!classeDaCelula && (
          <Icone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" aria-hidden="true" />
        )}
        <input
          ref={campo} id={id} type="text" inputMode="numeric" autoComplete="off"
          value={texto} placeholder={FORMATO_DO_TIPO[tipo]} disabled={desabilitado}
          aria-haspopup="dialog" aria-expanded={aberto} aria-invalid={comErro || recusado || undefined}
          title={classeDaCelula && recusado ? aviso : undefined}
          onChange={aoDigitar} onClick={abrir} onKeyDown={aoTeclar} onBlur={aoSair}
          className={classeDoCampo}
        />
        <button
          type="button" tabIndex={-1} disabled={desabilitado}
          aria-label={ROTULO_DO_PAINEL[tipo]} title={ROTULO_DO_PAINEL[tipo]} data-testid="campo-de-data-abrir"
          onMouseDown={(pEvento) => pEvento.preventDefault()}
          onClick={() => {
            campo.current?.focus();
            if (aberto)
              fechar();
            else
              abrir();
          }}
          className={`absolute ${classeDaCelula ? 'right-0.5 p-1' : 'right-1.5 p-1.5'} top-1/2 -translate-y-1/2 rounded text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary disabled:opacity-50 disabled:pointer-events-none`}
        >
          <IconeDeAbrir className="w-4 h-4" aria-hidden="true" />
        </button>
        {children}
      </div>

      {/* O motivo da recusa: na célula de grade não há onde escrever, e ele vai no hint do campo. */}
      {recusado && !classeDaCelula && (
        <p role="alert" className="mt-1 text-ui-xs text-danger" data-testid="campo-de-data-aviso">{aviso}</p>
      )}

      {aberto && createPortal(
        <div
          ref={painel} role="dialog" aria-label={tipo === 'hora' ? 'Escolha de hora' : 'Calendário'}
          data-x-portal-dropdown="" data-testid="campo-de-data-painel"
          // O clique no painel não tira o foco do campo: a digitação e as setas continuam valendo.
          onMouseDown={(pEvento) => pEvento.preventDefault()}
          className="fixed flex bg-brand-surface text-brand-text-primary border border-border rounded-lg shadow-lg overflow-hidden"
          style={{
            zIndex: camada,
            top: posicao.top,
            bottom: posicao.bottom,
            left: posicao.left,
            visibility: posicao.medido ? undefined : 'hidden',
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          {temCalendario && (
            <XCalendario
              valor={dataDoValor(valor)} foco={foco} hoje={dataDeHoje()} minimo={minimo} maximo={maximo}
              aoFocar={setFoco} aoEscolher={escolherDia} aoLimpar={limpar}
            />
          )}
          {tipo !== 'data' && (
            <div className={temCalendario ? 'border-l border-border-light' : ''}>
              <XSeletorDeHora valor={horaDoValor(valor)} aoMudar={escolherHora} altura={temCalendario ? 'h-60' : 'h-48'} />
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
