/**
 * Cabeçalho do painel, estreito: onde estou (os níveis — migalhas › título › níveis abaixo), o selo, o estado com a
 * régua do tempo decorrido e, à direita, o seletor "como estava em" e as ações (opcionais). O título é o nível ATIVO:
 * marcado pelo peso (negrito) e por `aria-current`, não só pela cor (WCAG 1.4.1). Uma linha só, e nome e título NUNCA
 * se encurtam nem quebram (dono, 2026-10-25): têm a largura do próprio texto. Faltando espaço, quem cede são os
 * minipainéis (`extras`), que rolam na horizontal dentro da sua caixa. As ações usam a paleta semântica do Core
 * (`XBUTTON_PALETTE`): "Criar" é o verde do "Novo" em qualquer App.
 */

import type { JSX, ReactNode } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { XBUTTON_PALETTE } from '@core/lib';
import { XButtonColor } from '@core/types';
import type { XAcaoDoPainel, XEscolhaNoCabecalho, XMigalhaDoPainel, XStatusDoPainel } from '../elementos/tipos';
import { XMenuSuspenso } from '../elementos/XMenuSuspenso';
import { PASTILHA_DO_TOM, PONTO_DO_TOM } from '../elementos/tons';
import { XIndicadorDeStatus } from '../elementos/XIndicadorDeStatus';

interface XCabecalhoDoPainelProps {
  migalhas: XMigalhaDoPainel[];
  titulo: string;
  /** Selo discreto ao lado do título (ex.: "Rascunho", "Arquivado"). */
  selo?: string;
  /** O estado do objeto. Ausente => sem pastilha de estado. */
  status?: XStatusDoPainel;
  seletorDeData?: ReactNode;
  acoes?: XAcaoDoPainel[];
  /** O botão "mais" (⋯), já montado por quem usa o painel. */
  maisAcoes?: ReactNode;
  /** À direita, antes do seletor: os minipainéis que a sub-App manda para cá (`XNoPainel linha={1}`). */
  extras?: ReactNode;
  /** Logo depois do estado: a faixa "precisa de você", compacta (dono, 2026-10-25). Cede espaço antes do título. */
  atencao?: ReactNode;
  /** A seta ao lado do título abre a lista para trocar de objeto (de projeto, por exemplo). */
  escolhaDoTitulo?: XEscolhaDoTitulo;
  /** Clicar no título faz algo (ex.: abre o objeto). Ausente ⇒ o título é texto — o caso do nível ativo do AppX. */
  aoAbrirTitulo?: () => void;
  /**
   * Os níveis ABAIXO do ativo que já têm registro (ex.: o projeto, quando o AppX está no nível da Empresa), depois do
   * título: clicar no nome desce ao nível; a seta troca o registro dele.
   */
  abaixo?: XMigalhaDoPainel[];
  /** Volta pelo caminho percorrido dentro do AppX (RX-7). Ausente ⇒ sem o botão (não há para onde voltar). */
  aoVoltar?: () => void;
  /** Abre a busca de comando do AppX (RI-5; também por Ctrl+K). Ausente ⇒ sem o botão. */
  aoBuscar?: () => void;
}

/** A escolha do objeto pelo título do cabeçalho. */
export type XEscolhaDoTitulo = XEscolhaNoCabecalho;

/**
 * Um nome do cabeçalho com as duas portas SEPARADAS (dono, 2026-10-25): clicar no NOME vai ao objeto (no AppX, ao nível
 * dele); só a SETA ao lado abre a lista para trocar de objeto. Sem `aoAbrir`, o nome é texto; sem `escolha`, não há
 * seta.
 */
function NomeDoCabecalho({ texto, aoAbrir, escolha }: { texto: string; aoAbrir?: () => void; escolha?: XEscolhaNoCabecalho }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-0.5">
      {aoAbrir ? (
        <button
          type="button"
          onClick={aoAbrir}
          title={`Ir para ${texto}`}
          className="-mx-1 px-1 py-0.5 rounded-md hover:bg-hover hover:underline underline-offset-2 transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {texto}
        </button>
      ) : (
        <span>{texto}</span>
      )}
      {escolha && (
        <XMenuSuspenso
          rotuloAcessivel={escolha.rotuloAcessivel}
          opcoes={escolha.opcoes}
          selecionada={escolha.selecionada}
          vazio={escolha.vazio}
          aoEscolher={escolha.aoEscolher}
          classeDoGatilho="ml-0.5 p-0.5 flex items-center rounded-md hover:bg-hover transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          gatilho={<ChevronDown size={14} className="text-brand-text-muted" aria-hidden="true" />}
        />
      )}
    </span>
  );
}

const COR_DO_PAPEL: Record<XAcaoDoPainel['papel'], string> = {
  criar: XBUTTON_PALETTE[XButtonColor.Create],
  neutro: 'bg-brand-surface hover:bg-hover text-brand-text-primary border border-border',
  leitura: XBUTTON_PALETTE[XButtonColor.Read],
};

export function XCabecalhoDoPainel({
  migalhas,
  titulo,
  selo,
  status,
  seletorDeData,
  acoes = [],
  maisAcoes,
  extras,
  atencao,
  escolhaDoTitulo,
  aoAbrirTitulo,
  abaixo = [],
  aoVoltar,
  aoBuscar,
}: XCabecalhoDoPainelProps): JSX.Element {
  const progresso = status?.progresso === undefined ? undefined : Math.min(1, Math.max(0, status.progresso));

  return (
    <header className="flex items-center gap-3 min-h-row px-4 sm:px-6 py-1.5 bg-brand-surface border-b border-border-light">
      {aoVoltar && (
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          title="Voltar"
          className="shrink-0 -ml-1.5 p-1 rounded-md text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
      )}
      <nav aria-label="Localização" className="flex items-center gap-1.5 shrink-0 whitespace-nowrap text-ui-sm">
        {migalhas.map((pMigalha, pI) => (
          <span key={`${pMigalha.rotulo}-${pI}`} className={`flex items-center gap-1.5 ${pI === 0 ? 'hidden md:flex' : ''}`}>
            {/* A migalha tem a cor do título (dono, 2026-10-25): a empresa e o projeto se leem igual; o peso é que
                diferencia — o título em negrito. */}
            <span className={`text-brand-text-primary ${pMigalha.codigo ? 'font-mono text-ui-xs tracking-tight' : ''}`}>
              <NomeDoCabecalho texto={pMigalha.rotulo} aoAbrir={pMigalha.aoAbrir} escolha={pMigalha.escolha} />
            </span>
            <ChevronRight size={12} className="shrink-0 text-brand-text-muted opacity-70" />
          </span>
        ))}
        <h1 className="font-semibold text-brand-text-primary" aria-current="location">
          <NomeDoCabecalho texto={titulo} aoAbrir={aoAbrirTitulo} escolha={escolhaDoTitulo} />
        </h1>
        {abaixo.map((pMigalha, pI) => (
          <span key={`abaixo-${pMigalha.rotulo}-${pI}`} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="shrink-0 text-brand-text-muted opacity-70" />
            <span className={`text-brand-text-primary ${pMigalha.codigo ? 'font-mono text-ui-xs tracking-tight' : ''}`}>
              <NomeDoCabecalho texto={pMigalha.rotulo} aoAbrir={pMigalha.aoAbrir} escolha={pMigalha.escolha} />
            </span>
          </span>
        ))}
      </nav>

      {selo && (
        <span className="hidden lg:inline shrink-0 whitespace-nowrap px-2 py-px rounded-full text-ui-xs border border-dashed border-border text-brand-text-muted">
          {selo}
        </span>
      )}

      {status && <span
        className={`shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3 py-0.5 rounded-full whitespace-nowrap text-ui-xs font-medium ${PASTILHA_DO_TOM[status.tom]}`}
        title={status.detalhe ? `${status.rotulo} · ${status.detalhe}` : status.rotulo}
      >
        <XIndicadorDeStatus tom={status.tom} />
        {status.rotulo}
        {status.detalhe && <span className="hidden sm:inline font-normal opacity-80">{status.detalhe}</span>}
        {progresso !== undefined && (
          <span className="hidden sm:block w-14 h-1 rounded-full bg-brand-surface/60 overflow-hidden" aria-hidden="true">
            <span
              className={`block h-full rounded-full ${PONTO_DO_TOM[status.tom]} transition-all duration-500`}
              style={{ width: `${Math.round(progresso * 100)}%` }}
            />
          </span>
        )}
      </span>}

      {/* A faixa rola dentro da própria caixa quando falta espaço: o título não cede (dono, 2026-10-25). */}
      {atencao && <div className="min-w-0 shrink-[100]">{atencao}</div>}

      <div className="ml-auto flex items-center gap-2 min-w-0">
        {extras && <div className="min-w-0 flex items-center overflow-x-auto scrollbar-hide">{extras}</div>}
        {seletorDeData}
        {acoes.map((pAcao) => {
          const Icone = pAcao.icone;
          return (
            <button
              key={pAcao.id}
              type="button"
              title={pAcao.dica}
              disabled={pAcao.desabilitada}
              onClick={pAcao.aoAcionar}
              className={`shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md whitespace-nowrap text-ui-xs font-medium transition-colors duration-150
                disabled:opacity-40 disabled:cursor-not-allowed ${COR_DO_PAPEL[pAcao.papel]}`}
            >
              {pAcao.iconeDoApp
                ? <img src={`/icons/${pAcao.iconeDoApp}.svg`} alt="" className="w-3.5 h-3.5" />
                : Icone && <Icone size={14} />}
              {pAcao.rotulo}
            </button>
          );
        })}
        {maisAcoes}
        {aoBuscar && (
          <button
            type="button"
            onClick={aoBuscar}
            aria-label="Ir para (Ctrl+K)"
            title="Ir para um nível, uma aba ou um registro (Ctrl+K)"
            className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border text-ui-xs text-brand-text-secondary whitespace-nowrap
              hover:bg-hover hover:text-brand-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Search size={14} aria-hidden="true" />
            <kbd className="hidden md:inline font-sans">Ctrl K</kbd>
          </button>
        )}
      </div>
    </header>
  );
}
