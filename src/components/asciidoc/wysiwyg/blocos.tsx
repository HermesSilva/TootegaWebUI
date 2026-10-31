/**
 * RENDERIZADORES dos blocos na vista visual. Cada bloco é um componente memoizado por identidade do objeto: como o
 * documento é imutável, só o bloco editado re-renderiza.
 *
 * Folhas (texto editável) são `[data-folha]` com `<span data-ini>` por trecho e `[data-atomo]` por átomo — o
 * contrato que `mapeamentoDOM.ts` lê. ILHAS (`[data-ilha]`, `contentEditable={false}`) são regiões com controles
 * próprios (editor de código, textarea de bloco bruto): o que acontece dentro delas não chega ao contenteditable.
 */

import { memo, useMemo, type JSX, type ReactNode } from 'react';
import { Anchor, CircleAlert, FileText, Image, Info, Lightbulb, ListTree, Music, OctagonAlert, TriangleAlert, Video } from 'lucide-react';
import { XEditorDeCodigo } from '../codigo/XEditorDeCodigo';
import { XHint, hintEmphasis } from '../../ui/XHint';
import { XTextoFormatado } from '../XTextoFormatado';
import { LINGUAGENS } from '../codigo/linguagens';
import type { Atomo, Bloco, EspecieDeAdmonicao, Inline, Marca } from '../modelo/tipos';
import { useVista } from './contexto';

// ============================================================================
// Inline
// ============================================================================

const CLASSE_DA_MARCA: Record<Marca['tipo'], string> = {
  negrito: 'adc-negrito',
  italico: 'adc-italico',
  mono: 'adc-mono',
  realce: 'adc-realce',
  sobrescrito: 'adc-sobrescrito',
  subscrito: 'adc-subscrito',
  sublinhado: 'adc-sublinhado',
  tachado: 'adc-tachado',
  link: 'adc-link',
  papel: '',
};

function rotuloDoAtomo(pAtomo: Atomo): string {
  const d = pAtomo.dados;
  switch (pAtomo.especie) {
    case 'imagem':
      return d.alt || d.alvo || 'imagem';
    case 'referencia':
      return d.texto || `[${d.alvo}]`;
    case 'ancora':
      return d.id;
    case 'notaDeRodape':
      return d.texto ? `[${d.texto.length > 40 ? `${d.texto.slice(0, 40)}…` : d.texto}]` : '[nota]';
    case 'tecla':
      return d.texto;
    case 'botao':
      return d.texto;
    case 'menu':
      return d.texto ? `${d.alvo} › ${d.texto.replace(/\s*>\s*/g, ' › ')}` : d.alvo;
    case 'atributo':
      return `{${d.nome}}`;
    case 'quebraDeLinha':
      return '';
    case 'passagem':
      return d.texto;
    case 'bruto':
      return d.texto;
    default:
      return '';
  }
}

function dicaDoAtomo(pAtomo: Atomo): string {
  const d = pAtomo.dados;
  switch (pAtomo.especie) {
    case 'imagem':
      return `Imagem: ${d.alvo}`;
    case 'referencia':
      return `Referência a ${d.alvo}`;
    case 'ancora':
      return `Âncora ${d.id}`;
    case 'notaDeRodape':
      return `Nota de rodapé${d.id ? ` ${d.id}` : ''}: ${d.texto ?? ''}`;
    case 'tecla':
      return 'Tecla';
    case 'botao':
      return 'Botão';
    case 'menu':
      return 'Menu';
    case 'atributo':
      return `Atributo ${d.nome}`;
    case 'passagem':
      return 'Passagem (sai sem substituições)';
    case 'bruto':
      return 'Macro guardada como veio';
    default:
      return '';
  }
}

/** O conteúdo inline de uma folha, com o `data-ini` de cada trecho. */
export function renderizarInline(pConteudo: Inline[]): ReactNode[] {
  const saida: ReactNode[] = [];
  let posicao = 0;
  pConteudo.forEach((pParte, pIndice) => {
    const ini = posicao;
    if (pParte.tipo === 'atomo') {
      posicao += 1;
      if (pParte.especie === 'quebraDeLinha') {
        // Um `<br>` editável, não um invólucro não editável: a seta para cima/baixo precisa atravessá-lo linha a
        // linha, e um elemento `contenteditable=false` no caminho fazia o cursor saltar para a folha seguinte
        // (defeito observado em 2026-10-28). Continua um átomo (`data-atomo`) de uma posição para o mapeamento.
        saida.push(<br key={pIndice} data-ini={ini} data-atomo="quebraDeLinha" className="adc-quebra" />);
        return;
      }
      saida.push(
        <span key={pIndice} data-ini={ini} data-atomo={pParte.especie} className={`adc-atomo adc-atomo-${pParte.especie}`} contentEditable={false} title={dicaDoAtomo(pParte)}>
          {pParte.especie === 'imagem' && <Image size={14} className="adc-atomo-icone" aria-hidden="true" />}
          {pParte.especie === 'ancora' && <Anchor size={12} className="adc-atomo-icone" aria-hidden="true" />}
          {rotuloDoAtomo(pParte)}
        </span>,
      );
      return;
    }
    posicao += pParte.texto.length;
    // Quebra de linha simples dentro do parágrafo é ESPAÇO no AsciiDoc (só ` +` quebra). Fica `\n` no modelo, para
    // o round-trip devolver as linhas como o autor as escreveu, mas o visual mostra o parágrafo corrido — e o cursor
    // sobe e desce pelas linhas visuais sem tropeçar numa quebra literal (defeito observado em 2026-10-28).
    const textoVisivel = pParte.texto.replace(/\n/g, ' ');
    const classes = pParte.marcas.map((pM) => CLASSE_DA_MARCA[pM.tipo]).filter(Boolean).join(' ');
    const papel = pParte.marcas.find((pM) => pM.tipo === 'papel');
    const link = pParte.marcas.find((pM) => pM.tipo === 'link');
    const classe = `${classes}${papel ? ` adc-papel adc-papel-${papel.valor}` : ''}`.trim();
    if (link)
      saida.push(
        <a key={pIndice} data-ini={ini} className={classe} href={link.valor} title={link.valor} onClick={(pE) => pE.preventDefault()}>
          {textoVisivel}
        </a>,
      );
    else
      saida.push(
        <span key={pIndice} data-ini={ini} className={classe || undefined}>
          {textoVisivel}
        </span>,
      );
  });
  return saida;
}

interface FolhaProps {
  id: string;
  conteudo: Inline[];
  etiqueta: 'p' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'dt' | 'td' | 'th';
  className?: string;
  placeholder?: string;
  style?: Record<string, string | number>;
  colSpan?: number;
  rowSpan?: number;
}

/** Uma folha editável. A versão vem do contexto: relida do DOM, a folha remonta com chave nova. */
export const Folha = memo(function Folha({ id, conteudo, etiqueta, className, placeholder, style, colSpan, rowSpan }: FolhaProps): JSX.Element {
  const { versaoDaFolha, folhaTravada } = useVista();
  const versao = versaoDaFolha(id);
  const secao = folhaTravada(id);
  const travada = secao !== null;
  const Etiqueta = etiqueta;
  const filhos = useMemo(() => (conteudo.length === 0 ? <br data-vazio="" /> : renderizarInline(conteudo)), [conteudo]);
  const elemento = (
    <Etiqueta
      key={`${id}:${versao}`}
      data-folha={id}
      className={`adc-folha ${className ?? ''}${travada ? ' adc-folha-travada' : ''}`.trim()}
      data-placeholder={conteudo.length === 0 ? placeholder : undefined}
      style={style}
      colSpan={colSpan}
      rowSpan={rowSpan}
      contentEditable={travada ? false : undefined}
    >
      {filhos}
    </Etiqueta>
  );
  if (!secao)
    return elemento;
  // Título fixo do modelo: a dica é o XHint da plataforma (painel estreito, com destaque), não o `title` nativo.
  return (
    <XHint
      label={secao.obrigatoria ? 'Seção obrigatória do modelo' : 'Seção opcional do modelo'}
      tone={secao.obrigatoria ? 'warning' : 'info'}
      placement="bottom"
      className="w-full"
      body={
        <span className="flex flex-col gap-1 adc-texto-formatado">
          <XTextoFormatado texto={secao.explicacao} />
          {secao.exemplo && (
            <span className={hintEmphasis.muted}>
              <span className={hintEmphasis.strong}>Exemplo: </span>
              <XTextoFormatado texto={secao.exemplo} />
            </span>
          )}
          <span className={hintEmphasis.muted}>O título não se edita; escreva abaixo dele.</span>
        </span>
      }
    >
      {elemento}
    </XHint>
  );
});

// ============================================================================
// Ilha (região não editável com controles)
// ============================================================================

interface IlhaProps {
  bloco: Bloco;
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
  className?: string;
}

function Ilha({ bloco, titulo, icone, children, className }: IlhaProps): JSX.Element {
  const { blocoSelecionado, selecionarBloco } = useVista();
  return (
    <div
      data-bloco={bloco.id}
      data-ilha=""
      contentEditable={false}
      className={`adc-ilha ${className ?? ''}${blocoSelecionado === bloco.id ? ' adc-bloco-selecionado' : ''}`.trim()}
      onMouseDown={(pE) => {
        if ((pE.target as HTMLElement).closest('textarea, input, select, button, [contenteditable="true"]'))
          return;
        selecionarBloco(bloco.id);
      }}
    >
      <div className="adc-ilha-cabecalho">
        {icone}
        <span>{titulo}</span>
        {bloco.titulo !== undefined && <span className="adc-ilha-titulo">· {bloco.titulo}</span>}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Blocos
// ============================================================================

const ICONE_DA_ADMONICAO: Record<EspecieDeAdmonicao, ReactNode> = {
  NOTE: <Info size={18} aria-hidden="true" />,
  TIP: <Lightbulb size={18} aria-hidden="true" />,
  IMPORTANT: <CircleAlert size={18} aria-hidden="true" />,
  WARNING: <TriangleAlert size={18} aria-hidden="true" />,
  CAUTION: <OctagonAlert size={18} aria-hidden="true" />,
};

const ROTULO_DA_ADMONICAO: Record<EspecieDeAdmonicao, string> = {
  NOTE: 'Nota',
  TIP: 'Dica',
  IMPORTANT: 'Importante',
  WARNING: 'Atenção',
  CAUTION: 'Cuidado',
};

export const ROTULOS_DE_ADMONICAO = ROTULO_DA_ADMONICAO;

function TituloDoBloco({ bloco }: { bloco: Bloco }): JSX.Element | null {
  if (bloco.titulo === undefined)
    return null;
  return (
    <div className="adc-titulo-do-bloco" contentEditable={false}>
      {bloco.titulo}
    </div>
  );
}

const BlocoDeCodigo = memo(function BlocoDeCodigo({ bloco }: { bloco: Bloco & { tipo: 'codigo' } }): JSX.Element {
  const { atualizarBloco, somenteLeitura } = useVista();
  const rotulo = bloco.estilo === 'literal' ? 'Literal' : bloco.estilo === 'listagem' ? 'Listagem' : 'Código';
  return (
    <Ilha bloco={bloco} titulo={rotulo} icone={<FileText size={14} aria-hidden="true" />} className="adc-bloco-codigo">
      {bloco.estilo === 'fonte' && (
        <select
          className="adc-ilha-seletor"
          value={LINGUAGENS.some((pL) => pL.nome === bloco.linguagem || pL.apelidos.includes(bloco.linguagem ?? '')) ? bloco.linguagem : bloco.linguagem ? 'outra' : ''}
          aria-label="Linguagem do código"
          disabled={somenteLeitura}
          onChange={(pE) => atualizarBloco(bloco.id, { linguagem: pE.target.value === '' ? undefined : pE.target.value } as Partial<Bloco>)}
        >
          <option value="">Sem linguagem</option>
          {LINGUAGENS.filter((pL) => pL.nome !== 'texto').map((pL) => (
            <option key={pL.nome} value={pL.nome}>
              {pL.rotulo}
            </option>
          ))}
          {bloco.linguagem && !LINGUAGENS.some((pL) => pL.nome === bloco.linguagem || pL.apelidos.includes(bloco.linguagem ?? '')) && <option value="outra">{bloco.linguagem}</option>}
        </select>
      )}
      <XEditorDeCodigo
        valor={bloco.codigo}
        aoMudar={(pValor) => atualizarBloco(bloco.id, { codigo: pValor } as Partial<Bloco>)}
        linguagem={bloco.estilo === 'fonte' ? bloco.linguagem : 'texto'}
        altura="auto"
        alturaMaxima={480}
        numerosDeLinha={bloco.estilo === 'fonte'}
        somenteLeitura={somenteLeitura}
        rotuloAcessivel={`${rotulo}${bloco.linguagem ? ` em ${bloco.linguagem}` : ''}`}
      />
    </Ilha>
  );
});

const BlocoDeTextoBruto = memo(function BlocoDeTextoBruto({ bloco, titulo, campo }: { bloco: Bloco; titulo: string; campo: 'texto' }): JSX.Element {
  const { atualizarBloco, somenteLeitura } = useVista();
  const valor = (bloco as unknown as Record<string, string>)[campo] ?? '';
  return (
    <Ilha bloco={bloco} titulo={titulo}>
      <textarea
        className="adc-ilha-textarea"
        value={valor}
        rows={Math.min(12, Math.max(2, valor.split('\n').length))}
        readOnly={somenteLeitura}
        aria-label={titulo}
        spellCheck={false}
        onChange={(pE) => atualizarBloco(bloco.id, { [campo]: pE.target.value } as Partial<Bloco>)}
      />
    </Ilha>
  );
});

const BlocoDeAtributo = memo(function BlocoDeAtributo({ bloco }: { bloco: Bloco & { tipo: 'atributo' } }): JSX.Element {
  const { atualizarBloco, somenteLeitura } = useVista();
  return (
    <Ilha bloco={bloco} titulo="Atributo do documento">
      <div className="adc-ilha-campos">
        <input className="adc-ilha-campo" value={bloco.nome} aria-label="Nome do atributo" readOnly={somenteLeitura} onChange={(pE) => atualizarBloco(bloco.id, { nome: pE.target.value } as Partial<Bloco>)} />
        <input className="adc-ilha-campo adc-ilha-campo-largo" value={bloco.valor} aria-label="Valor do atributo" readOnly={somenteLeitura} onChange={(pE) => atualizarBloco(bloco.id, { valor: pE.target.value } as Partial<Bloco>)} />
      </div>
    </Ilha>
  );
});

const BlocoDeImagem = memo(function BlocoDeImagem({ bloco }: { bloco: Bloco & { tipo: 'imagem' } }): JSX.Element {
  const { blocoSelecionado, selecionarBloco, editarBloco } = useVista();
  return (
    <figure
      data-bloco={bloco.id}
      data-ilha=""
      contentEditable={false}
      className={`adc-imagem${blocoSelecionado === bloco.id ? ' adc-bloco-selecionado' : ''}`}
      onMouseDown={() => selecionarBloco(bloco.id)}
      onDoubleClick={() => editarBloco(bloco.id)}
    >
      <img src={bloco.alvo} alt={bloco.alt ?? ''} width={bloco.largura ? Number(bloco.largura) || undefined : undefined} height={bloco.altura ? Number(bloco.altura) || undefined : undefined} />
      <figcaption>
        <Image size={14} aria-hidden="true" />
        <span>{bloco.titulo ?? bloco.alt ?? bloco.alvo}</span>
        <span className="adc-imagem-alvo">{bloco.alvo}</span>
      </figcaption>
    </figure>
  );
});

function Simples({ bloco, children, className }: { bloco: Bloco; children: ReactNode; className: string }): JSX.Element {
  const { blocoSelecionado, selecionarBloco } = useVista();
  return (
    <div data-bloco={bloco.id} data-ilha="" contentEditable={false} className={`${className}${blocoSelecionado === bloco.id ? ' adc-bloco-selecionado' : ''}`} onMouseDown={() => selecionarBloco(bloco.id)}>
      {children}
    </div>
  );
}

const CELULA_ALINHAMENTO: Record<string, string> = { esquerda: 'left', centro: 'center', direita: 'right' };

export const RenderizarBloco = memo(function RenderizarBloco({ bloco }: { bloco: Bloco }): JSX.Element | null {
  switch (bloco.tipo) {
    case 'paragrafo':
      return (
        <>
          <TituloDoBloco bloco={bloco} />
          <Folha id={bloco.id} conteudo={bloco.conteudo} etiqueta="p" className={`adc-paragrafo${bloco.estilo === 'literal' ? ' adc-literal' : ''}${bloco.estilo === 'lead' ? ' adc-lead' : ''}`} placeholder="Escreva aqui…" />
        </>
      );
    case 'titulo': {
      const etiqueta = (`h${Math.min(6, bloco.nivel + 1)}`) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <>
          <TituloDoBloco bloco={bloco} />
          <Folha id={bloco.id} conteudo={bloco.conteudo} etiqueta={etiqueta} className={`adc-titulo adc-titulo-${bloco.nivel}${bloco.discreto ? ' adc-titulo-discreto' : ''}`} placeholder={`Título de nível ${bloco.nivel}`} />
        </>
      );
    }
    case 'lista': {
      const Etiqueta = bloco.estilo === 'numerada' ? 'ol' : 'ul';
      return (
        <>
          <TituloDoBloco bloco={bloco} />
          <Etiqueta data-bloco={bloco.id} className={`adc-lista adc-lista-${bloco.estilo}`}>
            {bloco.itens.map((pItem) => (
              <li key={pItem.id} className="adc-item" data-item={pItem.id}>
                {bloco.estilo === 'tarefas' && <CaixaDeTarefa itemID={pItem.id} marcado={Boolean(pItem.marcado)} />}
                <Folha id={pItem.id} conteudo={pItem.conteudo} etiqueta="div" className="adc-item-texto" placeholder="Item" />
                {pItem.filhos.map((pFilho) => (
                  <RenderizarBloco key={pFilho.id} bloco={pFilho} />
                ))}
              </li>
            ))}
          </Etiqueta>
        </>
      );
    }
    case 'descricao':
      return (
        <>
          <TituloDoBloco bloco={bloco} />
          <dl data-bloco={bloco.id} className="adc-descricao">
            {bloco.itens.map((pItem) => (
              <div key={pItem.id} className="adc-descricao-item">
                <Folha id={pItem.id} conteudo={pItem.conteudo} etiqueta="dt" className="adc-termo" placeholder="Termo" />
                <dd className="adc-definicao">
                  {pItem.filhos.map((pFilho) => (
                    <RenderizarBloco key={pFilho.id} bloco={pFilho} />
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </>
      );
    case 'chamadas':
      return (
        <ol data-bloco={bloco.id} className="adc-chamadas">
          {bloco.itens.map((pItem) => (
            <li key={pItem.id} className="adc-chamada">
              <span className="adc-chamada-numero" contentEditable={false}>
                {pItem.numero}
              </span>
              <Folha id={pItem.id} conteudo={pItem.conteudo} etiqueta="div" className="adc-chamada-texto" placeholder="Explicação da chamada" />
            </li>
          ))}
        </ol>
      );
    case 'codigo':
      return <BlocoDeCodigo bloco={bloco} />;
    case 'admonicao':
      return (
        <aside data-bloco={bloco.id} className={`adc-admonicao adc-admonicao-${bloco.especie.toLowerCase()}`}>
          <div className="adc-admonicao-rotulo" contentEditable={false}>
            {ICONE_DA_ADMONICAO[bloco.especie]}
            <span>{ROTULO_DA_ADMONICAO[bloco.especie]}</span>
          </div>
          <div className="adc-admonicao-corpo">
            <TituloDoBloco bloco={bloco} />
            {bloco.filhos.map((pFilho) => (
              <RenderizarBloco key={pFilho.id} bloco={pFilho} />
            ))}
          </div>
        </aside>
      );
    case 'container': {
      const Etiqueta = bloco.especie === 'citacao' || bloco.especie === 'verso' ? 'blockquote' : bloco.especie === 'barraLateral' ? 'aside' : 'section';
      return (
        <Etiqueta data-bloco={bloco.id} className={`adc-container adc-container-${bloco.especie}`}>
          <TituloDoBloco bloco={bloco} />
          {bloco.filhos.map((pFilho) => (
            <RenderizarBloco key={pFilho.id} bloco={pFilho} />
          ))}
          {(bloco.autor || bloco.fonte) && (
            <footer className="adc-atribuicao" contentEditable={false}>
              — {bloco.autor}
              {bloco.fonte && <cite>, {bloco.fonte}</cite>}
            </footer>
          )}
        </Etiqueta>
      );
    }
    case 'tabela':
      return (
        <div data-bloco={bloco.id} className="adc-tabela-moldura">
          <TituloDoBloco bloco={bloco} />
          <table className="adc-tabela">
            {bloco.cabecalho && bloco.linhas.length > 0 && (
              <thead>
                <tr>
                  {bloco.linhas[0].celulas.map((pCelula) => (
                    <Folha key={pCelula.id} id={pCelula.id} conteudo={pCelula.conteudo} etiqueta="th" colSpan={pCelula.colunas} rowSpan={pCelula.linhas} style={pCelula.alinhamento ? { textAlign: CELULA_ALINHAMENTO[pCelula.alinhamento] } : undefined} />
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bloco.linhas.slice(bloco.cabecalho ? 1 : 0).map((pLinha) => (
                <tr key={pLinha.id}>
                  {pLinha.celulas.map((pCelula) => (
                    <Folha
                      key={pCelula.id}
                      id={pCelula.id}
                      conteudo={pCelula.conteudo}
                      etiqueta="td"
                      className={pCelula.estilo ? `adc-celula-${pCelula.estilo}` : undefined}
                      colSpan={pCelula.colunas}
                      rowSpan={pCelula.linhas}
                      style={pCelula.alinhamento ? { textAlign: CELULA_ALINHAMENTO[pCelula.alinhamento] } : undefined}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'imagem':
      return <BlocoDeImagem bloco={bloco} />;
    case 'midia':
      return (
        <Simples bloco={bloco} className="adc-midia">
          {bloco.especie === 'video' ? <Video size={16} aria-hidden="true" /> : <Music size={16} aria-hidden="true" />}
          <span>{bloco.especie === 'video' ? 'Vídeo' : 'Áudio'}</span>
          <span className="adc-midia-alvo">{bloco.alvo}</span>
          {bloco.atributos && <span className="adc-midia-atributos">[{bloco.atributos}]</span>}
        </Simples>
      );
    case 'quebraTematica':
      return (
        <Simples bloco={bloco} className="adc-quebra-tematica">
          <hr />
        </Simples>
      );
    case 'quebraDePagina':
      return (
        <Simples bloco={bloco} className="adc-quebra-de-pagina">
          <span>Quebra de página</span>
        </Simples>
      );
    case 'sumario':
      return (
        <Simples bloco={bloco} className="adc-sumario">
          <ListTree size={16} aria-hidden="true" />
          <span>Sumário (gerado na publicação)</span>
        </Simples>
      );
    case 'comentario':
      return <BlocoDeTextoBruto bloco={bloco} titulo={bloco.emBloco ? 'Comentário (bloco)' : 'Comentário'} campo="texto" />;
    case 'passagem':
      return <BlocoDeTextoBruto bloco={bloco} titulo="Passagem (sai como está)" campo="texto" />;
    case 'atributo':
      return <BlocoDeAtributo bloco={bloco} />;
    case 'bruto':
      return <BlocoDeTextoBruto bloco={bloco} titulo="AsciiDoc como veio" campo="texto" />;
    default:
      return null;
  }
});

function CaixaDeTarefa({ itemID, marcado }: { itemID: string; marcado: boolean }): JSX.Element {
  const { alternarTarefa, somenteLeitura } = useVista();
  return (
    <span className="adc-tarefa" contentEditable={false}>
      <input type="checkbox" checked={marcado} disabled={somenteLeitura} aria-label={marcado ? 'Tarefa concluída' : 'Tarefa pendente'} onChange={() => alternarTarefa(itemID)} />
    </span>
  );
}
