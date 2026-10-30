/**
 * PAINEL DE TRABALHO — a moldura das telas de trabalho (dashboards) de qualquer SaaS (dono, 2026-10-25).
 *
 * De cima para baixo:
 *   1. cabeçalho, numa linha só: onde estou, em que estado, "precisa de você" (só quando há motivo, compacto, logo
 *      depois do estado — dono, 2026-10-25), "como estava em" e as ações (opcionais);
 *   2. abas;
 *   3. aviso (opcional): o que muda a leitura da tela inteira — consulta no passado, por exemplo;
 *   4. corpo (a aba ativa);
 *   5. rodapé (opcional): a atividade, que vale para qualquer aba.
 *
 * Ocupa a área da App inteira e rola por dentro; o cabeçalho e as abas ficam presos no topo. Não abre nada fora da
 * área da App (contenção, skill tootega-front §1).
 */

import { useEffect, useRef, useState, type JSX, type ReactNode, type RefObject } from 'react';
import { XAbasDoPainel } from './XAbasDoPainel';
import { XCabecalhoDoPainel, type XEscolhaDoTitulo } from './XCabecalhoDoPainel';
import { XFaixaDeAtencao } from './XFaixaDeAtencao';
import type { XAbaDoPainel, XAcaoDoPainel, XItemDeAtencao, XMigalhaDoPainel, XStatusDoPainel } from '../elementos/tipos';

export interface XPainelDeTrabalhoProps {
  migalhas: XMigalhaDoPainel[];
  titulo: string;
  selo?: string;
  status?: XStatusDoPainel;
  seletorDeData?: ReactNode;
  acoes?: XAcaoDoPainel[];
  maisAcoes?: ReactNode;
  abas: XAbaDoPainel[];
  abaAtiva: string;
  aoTrocarAba: (pID: string) => void;
  aviso?: ReactNode;
  atencao?: {
    titulo: string;
    itens: XItemDeAtencao[];
    aoAbrir: (pID: string) => void;
    /** Opcional: sem ele, os motivos não têm o "x" de dispensar. */
    aoDispensar?: (pID: string) => void;
  };
  rodape?: ReactNode;
  /** À direita da linha 1 (cabeçalho), antes do seletor: onde caem os minipainéis `XNoPainel linha={1}`. */
  extrasDaLinha1?: ReactNode;
  /** Na ponta direita da linha 2 (abas): onde caem os minipainéis `XNoPainel linha={2}`. */
  extrasDaLinha2?: ReactNode;
  /** A seta ao lado do título abre a lista para trocar de objeto (ver `XCabecalhoDoPainel`). */
  escolhaDoTitulo?: XEscolhaDoTitulo;
  /** Clicar no título faz algo (ver `XCabecalhoDoPainel`); no AppX o título é o nível ativo, e fica texto. */
  aoAbrirTitulo?: () => void;
  /** Os níveis abaixo do ativo que já têm registro, depois do título (ver `XCabecalhoDoPainel`). */
  migalhasAbaixo?: XMigalhaDoPainel[];
  /** Volta pelo caminho percorrido (RX-7). Ausente ⇒ sem o botão. */
  aoVoltar?: () => void;
  /** Abre a busca de comando (RI-5). Ausente ⇒ sem o botão no cabeçalho. */
  aoBuscar?: () => void;
  /** A caixa de busca aberta (`XBuscaDoPainel`), desenhada CONTIDA na área do painel, por cima dele. */
  busca?: ReactNode;
  children: ReactNode;
}

export function XPainelDeTrabalho({
  migalhas,
  titulo,
  selo,
  status,
  seletorDeData,
  acoes,
  maisAcoes,
  abas,
  abaAtiva,
  aoTrocarAba,
  aviso,
  atencao,
  rodape,
  extrasDaLinha1,
  extrasDaLinha2,
  escolhaDoTitulo,
  aoAbrirTitulo,
  migalhasAbaixo,
  aoVoltar,
  aoBuscar,
  busca,
  children,
}: XPainelDeTrabalhoProps): JSX.Element {
  const [rolagem, topo, alturaDaDobra] = useAlturaDaDobra();

  return (
    // O recipiente posicionado: a busca (e qualquer camada do painel) fica contida aqui, sem rolar junto.
    <div className="relative h-full">
    {busca}
    <div ref={rolagem} className="h-full overflow-y-auto scrollbar-thin bg-brand-background">
      <div ref={topo} className="sticky top-0 z-[5]">
        <XCabecalhoDoPainel
          migalhas={migalhas}
          titulo={titulo}
          selo={selo}
          status={status}
          seletorDeData={seletorDeData}
          acoes={acoes}
          maisAcoes={maisAcoes}
          extras={extrasDaLinha1}
          escolhaDoTitulo={escolhaDoTitulo}
          aoAbrirTitulo={aoAbrirTitulo}
          abaixo={migalhasAbaixo}
          aoVoltar={aoVoltar}
          aoBuscar={aoBuscar}
          atencao={atencao && (
            <XFaixaDeAtencao
              titulo={atencao.titulo}
              itens={atencao.itens}
              aoAbrir={atencao.aoAbrir}
              aoDispensar={atencao.aoDispensar}
              compacta
            />
          )}
        />
        <XAbasDoPainel
          abas={abas}
          ativa={abaAtiva}
          aoTrocar={aoTrocarAba}
          extras={extrasDaLinha2}
        />
      </div>

      <div className="px-4 sm:px-6 py-4 flex flex-col gap-4">
        {/* PRIMEIRA DOBRA (dono, 2026-10-25): o aviso e a aba ocupam no mínimo a área visível — o corpo vai até o pé
            da tela, e o rodapé fica abaixo da dobra, alcançado pela rolagem. */}
        <div className="flex flex-col gap-4" style={{ minHeight: alturaDaDobra }}>
          {aviso}
          <div role="tabpanel" className="flex-1 flex flex-col animate-in fade-in duration-200" key={abaAtiva}>
            {children}
          </div>
        </div>
        {rodape}
      </div>
    </div>
    </div>
  );
}

/** Folga do conteúdo (o `py-4` de cima e um respiro igual embaixo), em pixels. */
const FOLGA_DA_DOBRA = 32;

/**
 * A altura da primeira dobra: a área visível da rolagem menos o topo preso (cabeçalho + abas) e a folga. Acompanha
 * o redimensionamento; sem medida (aba escondida, ambiente de teste), não impõe altura.
 */
function useAlturaDaDobra(): [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>, number | undefined] {
  const rolagem = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | undefined>(undefined);

  useEffect(() => {
    const elementoDaRolagem = rolagem.current;
    const elementoDoTopo = topo.current;
    if (!elementoDaRolagem || !elementoDoTopo)
      return;
    const medir = (): void => {
      const disponivel = elementoDaRolagem.clientHeight - elementoDoTopo.offsetHeight - FOLGA_DA_DOBRA;
      setAltura(disponivel > 0 ? disponivel : undefined);
    };
    medir();
    if (typeof ResizeObserver === 'undefined')
      return;
    const observador = new ResizeObserver(medir);
    observador.observe(elementoDaRolagem);
    observador.observe(elementoDoTopo);
    return () => observador.disconnect();
  }, []);

  return [rolagem, topo, altura];
}
