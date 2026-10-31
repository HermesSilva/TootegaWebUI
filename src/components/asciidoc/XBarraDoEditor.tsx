/**
 * XBarraDoEditor — a barra de ferramentas do editor AsciiDoc, em grupos: histórico, tipo de bloco, formatação,
 * listas, inserção, tabela, ferramentas e modo. Todo botão tem nome acessível, dica e atalho; o estado da seleção
 * sai por `aria-pressed`. Os botões não roubam o foco do editor (`onMouseDown` previne o padrão).
 * Os textos vêm do catálogo (`useTextos`), pt-BR por padrão.
 */

import { type JSX, type ReactNode } from 'react';
import {
  Bold,
  Braces,
  ChevronDown,
  Code,
  Columns2,
  Eye,
  FileText,
  Hash,
  Highlighter,
  Image,
  Info,
  Italic,
  Link,
  List,
  ListChecks,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTree,
  Minus,
  PanelLeft,
  PenLine,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Rows3,
  Search,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash,
  Underline,
  Undo2,
} from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { XMenuSuspenso } from '../painel/elementos/XMenuSuspenso';
import type { EstiloDeLista, TipoDeMarca } from './modelo/tipos';
import type { TipoDeBlocoDeTexto } from './editor/transacoes';
import { useTextos } from './textos';

// ============================================================================
// Tipos
// ============================================================================

export type ModoDoEditor = 'visual' | 'codigo' | 'dividido';

export type ComandoDaBarra =
  | `marca:${TipoDeMarca}`
  | 'limparMarcas'
  | `bloco:${TipoDeBlocoDeTexto}`
  | `lista:${EstiloDeLista}`
  | 'lista:descricao'
  | 'recuar'
  | 'avancar'
  | 'inserir:link'
  | 'inserir:imagem'
  | 'inserir:tabela'
  | 'inserir:codigo'
  | 'inserir:admonicao:NOTE'
  | 'inserir:admonicao:TIP'
  | 'inserir:admonicao:IMPORTANT'
  | 'inserir:admonicao:WARNING'
  | 'inserir:admonicao:CAUTION'
  | 'inserir:exemplo'
  | 'inserir:barraLateral'
  | 'inserir:citacao'
  | 'inserir:notaDeRodape'
  | 'inserir:referencia'
  | 'inserir:ancora'
  | 'inserir:tecla'
  | 'inserir:quebraDeLinha'
  | 'inserir:quebraTematica'
  | 'inserir:quebraDePagina'
  | 'inserir:sumario'
  | 'inserir:atributo'
  | 'inserir:comentario'
  | 'inserir:formula'
  | 'tabela:linhaAntes'
  | 'tabela:linhaDepois'
  | 'tabela:colunaAntes'
  | 'tabela:colunaDepois'
  | 'tabela:removerLinha'
  | 'tabela:removerColuna'
  | 'tabela:cabecalho'
  | 'tabela:remover'
  | 'tabela:alinharEsquerda'
  | 'tabela:alinharCentro'
  | 'tabela:alinharDireita'
  | 'busca';

export interface EstadoDaBarra {
  marcas: ReadonlySet<TipoDeMarca>;
  tipoDeBloco: TipoDeBlocoDeTexto | null;
  lista: EstiloDeLista | 'descricao' | null;
  emTabela: boolean;
  cabecalhoDaTabela: boolean;
  /** Alinhamento da célula corrente (`esquerda` quando não há marca). */
  alinhamentoDaCelula: 'esquerda' | 'centro' | 'direita';
}

export interface XBarraDoEditorProps {
  modo: ModoDoEditor;
  aoMudarModo: (pModo: ModoDoEditor) => void;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  aoDesfazer: () => void;
  aoRefazer: () => void;
  estado: EstadoDaBarra;
  aoComando: (pComando: ComandoDaBarra) => void;
  somenteLeitura: boolean;
  estruturaAberta: boolean;
  aoAlternarEstrutura: () => void;
  /** Os controles de formatação só valem no modo visual com seleção. */
  formatacaoAtiva: boolean;
}

// ============================================================================
// Peças
// ============================================================================

function Grupo({ children, rotulo }: { children: ReactNode; rotulo: string }): JSX.Element {
  return (
    <div className="adc-barra-grupo" role="group" aria-label={rotulo}>
      {children}
    </div>
  );
}

interface BotaoProps {
  rotulo: string;
  dica?: string;
  atalho?: string;
  icone: ReactNode;
  ligado?: boolean;
  desabilitado?: boolean;
  aoClicar: () => void;
}

function Botao({ rotulo, dica, atalho, icone, ligado = false, desabilitado = false, aoClicar }: BotaoProps): JSX.Element {
  return (
    <IconButton
      aria-label={rotulo}
      hint={dica}
      shortcut={atalho}
      aria-pressed={ligado}
      disabled={desabilitado}
      className={`adc-barra-botao${ligado ? ' adc-ligado' : ''}`}
      onMouseDown={(pE) => pE.preventDefault()}
      onClick={aoClicar}
    >
      {icone}
    </IconButton>
  );
}

// ============================================================================
// A barra
// ============================================================================

export function XBarraDoEditor({ modo, aoMudarModo, podeDesfazer, podeRefazer, aoDesfazer, aoRefazer, estado, aoComando, somenteLeitura, estruturaAberta, aoAlternarEstrutura, formatacaoAtiva }: XBarraDoEditorProps): JSX.Element {
  const textos = useTextos();
  const t = textos.barra;
  const inativo = somenteLeitura || !formatacaoAtiva;
  const marca = (pTipo: TipoDeMarca): boolean => estado.marcas.has(pTipo);

  return (
    <div className="adc-barra" role="toolbar" aria-label={t.rotulo}>
      <Grupo rotulo={t.historico}>
        <Botao rotulo={t.desfazer} atalho="Ctrl+Z" icone={<Undo2 size={16} />} desabilitado={somenteLeitura || !podeDesfazer} aoClicar={aoDesfazer} />
        <Botao rotulo={t.refazer} atalho="Ctrl+Y" icone={<Redo2 size={16} />} desabilitado={somenteLeitura || !podeRefazer} aoClicar={aoRefazer} />
      </Grupo>

      <Grupo rotulo={t.tipoDeBloco}>
        <XMenuSuspenso
          gatilho={
            <span className="adc-barra-gatilho">
              <Pilcrow size={14} aria-hidden="true" />
              <span>{estado.tipoDeBloco ? t.blocos[estado.tipoDeBloco] : t.bloco}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel={t.tipoDeBloco}
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          selecionada={estado.tipoDeBloco ?? undefined}
          opcoes={[
            { id: 'paragrafo', rotulo: t.blocos.paragrafo, detalhe: 'Ctrl+Shift+0' },
            { id: 'titulo1', rotulo: t.blocos.titulo1, detalhe: 'Ctrl+Shift+1' },
            { id: 'titulo2', rotulo: t.blocos.titulo2, detalhe: 'Ctrl+Shift+2' },
            { id: 'titulo3', rotulo: t.blocos.titulo3, detalhe: 'Ctrl+Shift+3' },
            { id: 'titulo4', rotulo: t.blocos.titulo4, detalhe: 'Ctrl+Shift+4' },
            { id: 'titulo5', rotulo: t.blocos.titulo5, detalhe: 'Ctrl+Shift+5' },
            { id: 'literal', rotulo: t.blocos.literal, detalhe: t.literalDetalhe },
            { id: 'citacao', rotulo: t.blocos.citacao, detalhe: t.citacaoDetalhe },
            { id: 'codigo', rotulo: t.blocos.codigo, detalhe: t.codigoDetalhe },
          ]}
          aoEscolher={(pID) => {
            if (!inativo)
              aoComando(`bloco:${pID as TipoDeBlocoDeTexto}`);
          }}
        />
      </Grupo>

      <Grupo rotulo={t.formatacao}>
        <Botao rotulo={t.negrito} atalho="Ctrl+B" icone={<Bold size={16} />} ligado={marca('negrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:negrito')} />
        <Botao rotulo={t.italico} atalho="Ctrl+I" icone={<Italic size={16} />} ligado={marca('italico')} desabilitado={inativo} aoClicar={() => aoComando('marca:italico')} />
        <Botao rotulo={t.mono} atalho="Ctrl+E" icone={<Code size={16} />} ligado={marca('mono')} desabilitado={inativo} aoClicar={() => aoComando('marca:mono')} />
        <Botao rotulo={t.realce} atalho="Ctrl+H" icone={<Highlighter size={16} />} ligado={marca('realce')} desabilitado={inativo} aoClicar={() => aoComando('marca:realce')} />
        <Botao rotulo={t.sublinhado} atalho="Ctrl+U" icone={<Underline size={16} />} ligado={marca('sublinhado')} desabilitado={inativo} aoClicar={() => aoComando('marca:sublinhado')} />
        <Botao rotulo={t.tachado} atalho="Ctrl+Shift+X" icone={<Strikethrough size={16} />} ligado={marca('tachado')} desabilitado={inativo} aoClicar={() => aoComando('marca:tachado')} />
        <Botao rotulo={t.sobrescrito} icone={<Superscript size={16} />} ligado={marca('sobrescrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:sobrescrito')} />
        <Botao rotulo={t.subscrito} icone={<Subscript size={16} />} ligado={marca('subscrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:subscrito')} />
        <Botao rotulo={t.limparFormatacao} dica={t.limparFormatacaoDica} icone={<RemoveFormatting size={16} />} desabilitado={inativo} aoClicar={() => aoComando('limparMarcas')} />
      </Grupo>

      <Grupo rotulo={t.listas}>
        <Botao rotulo={t.listaMarcadores} atalho="Ctrl+Shift+8" icone={<List size={16} />} ligado={estado.lista === 'marcadores'} desabilitado={inativo} aoClicar={() => aoComando('lista:marcadores')} />
        <Botao rotulo={t.listaNumerada} atalho="Ctrl+Shift+7" icone={<ListOrdered size={16} />} ligado={estado.lista === 'numerada'} desabilitado={inativo} aoClicar={() => aoComando('lista:numerada')} />
        <Botao rotulo={t.listaTarefas} atalho="Ctrl+Shift+9" icone={<ListChecks size={16} />} ligado={estado.lista === 'tarefas'} desabilitado={inativo} aoClicar={() => aoComando('lista:tarefas')} />
        <Botao rotulo={t.listaDescricao} dica={t.listaDescricaoDica} icone={<ListTree size={16} />} ligado={estado.lista === 'descricao'} desabilitado={inativo} aoClicar={() => aoComando('lista:descricao')} />
        <Botao rotulo={t.aumentarRecuo} atalho="Tab" icone={<ListIndentIncrease size={16} />} desabilitado={inativo || estado.lista === null || estado.lista === 'descricao'} aoClicar={() => aoComando('recuar')} />
        <Botao rotulo={t.diminuirRecuo} atalho="Shift+Tab" icone={<ListIndentDecrease size={16} />} desabilitado={inativo || estado.lista === null || estado.lista === 'descricao'} aoClicar={() => aoComando('avancar')} />
      </Grupo>

      <Grupo rotulo={t.inserir}>
        <Botao rotulo={t.link} atalho="Ctrl+K" icone={<Link size={16} />} ligado={marca('link')} desabilitado={inativo} aoClicar={() => aoComando('inserir:link')} />
        <Botao rotulo={t.imagem} icone={<Image size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:imagem')} />
        <Botao rotulo={t.tabela} icone={<Table size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:tabela')} />
        <Botao rotulo={t.blocoDeCodigo} icone={<Braces size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:codigo')} />
        <XMenuSuspenso
          gatilho={
            <span className="adc-barra-gatilho">
              <Info size={14} aria-hidden="true" />
              <span>{t.admonicao}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel={t.inserirAdmonicao}
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          opcoes={[
            { id: 'NOTE', rotulo: textos.admonicoes.NOTE, detalhe: 'NOTE' },
            { id: 'TIP', rotulo: textos.admonicoes.TIP, detalhe: 'TIP' },
            { id: 'IMPORTANT', rotulo: textos.admonicoes.IMPORTANT, detalhe: 'IMPORTANT' },
            { id: 'WARNING', rotulo: textos.admonicoes.WARNING, detalhe: 'WARNING' },
            { id: 'CAUTION', rotulo: textos.admonicoes.CAUTION, detalhe: 'CAUTION' },
          ]}
          aoEscolher={(pID) => {
            if (!inativo)
              aoComando(`inserir:admonicao:${pID}` as ComandoDaBarra);
          }}
        />
        <XMenuSuspenso
          gatilho={
            <span className="adc-barra-gatilho">
              <FileText size={14} aria-hidden="true" />
              <span>{t.mais}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel={t.inserirOutros}
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          opcoes={[
            { id: 'exemplo', rotulo: t.itens.exemplo, detalhe: '====' },
            { id: 'barraLateral', rotulo: t.itens.barraLateral, detalhe: '****' },
            { id: 'citacao', rotulo: t.itens.citacao, detalhe: '____' },
            { id: 'notaDeRodape', rotulo: t.itens.notaDeRodape, detalhe: 'footnote:[]' },
            { id: 'referencia', rotulo: t.itens.referencia, detalhe: '<<id>>' },
            { id: 'ancora', rotulo: t.itens.ancora, detalhe: '[[id]]' },
            { id: 'tecla', rotulo: t.itens.tecla, detalhe: 'kbd:[] btn:[] menu:[]' },
            { id: 'quebraDeLinha', rotulo: t.itens.quebraDeLinha, detalhe: 'Shift+Enter' },
            { id: 'quebraTematica', rotulo: t.itens.quebraTematica, detalhe: "'''" },
            { id: 'quebraDePagina', rotulo: t.itens.quebraDePagina, detalhe: '<<<' },
            { id: 'sumario', rotulo: t.itens.sumario, detalhe: 'toc::[]' },
            { id: 'atributo', rotulo: t.itens.atributo, detalhe: ':nome: valor' },
            { id: 'comentario', rotulo: t.itens.comentario, detalhe: '//' },
            { id: 'formula', rotulo: t.itens.formula, detalhe: 'stem:[]' },
          ]}
          aoEscolher={(pID) => {
            if (!inativo)
              aoComando(`inserir:${pID}` as ComandoDaBarra);
          }}
        />
      </Grupo>

      {estado.emTabela && (
        <Grupo rotulo={t.tabelaGrupo}>
          <Botao rotulo={t.linhaAcima} icone={<Rows3 size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:linhaAntes')} />
          <Botao rotulo={t.linhaAbaixo} icone={<Rows3 size={16} className="rotate-180" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:linhaDepois')} />
          <Botao rotulo={t.colunaEsquerda} icone={<Columns2 size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:colunaAntes')} />
          <Botao rotulo={t.colunaDireita} icone={<Columns2 size={16} className="rotate-180" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:colunaDepois')} />
          <Botao rotulo={t.removerLinha} icone={<Minus size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:removerLinha')} />
          <Botao rotulo={t.removerColuna} icone={<Minus size={16} className="rotate-90" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:removerColuna')} />
          <Botao rotulo={t.alinharEsquerda} dica={t.valeColunaInteira} icone={<TextAlignStart size={16} />} ligado={estado.alinhamentoDaCelula === 'esquerda'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharEsquerda')} />
          <Botao rotulo={t.centralizarColuna} dica={t.valeColunaInteira} icone={<TextAlignCenter size={16} />} ligado={estado.alinhamentoDaCelula === 'centro'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharCentro')} />
          <Botao rotulo={t.alinharDireita} dica={t.valeColunaInteira} icone={<TextAlignEnd size={16} />} ligado={estado.alinhamentoDaCelula === 'direita'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharDireita')} />
          <Botao rotulo={t.primeiraLinhaCabecalho} icone={<Hash size={16} />} ligado={estado.cabecalhoDaTabela} desabilitado={inativo} aoClicar={() => aoComando('tabela:cabecalho')} />
          <Botao rotulo={t.removerTabela} icone={<Trash size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:remover')} />
        </Grupo>
      )}

      <Grupo rotulo={t.ferramentas}>
        <Botao rotulo={t.localizarESubstituir} atalho="Ctrl+F" dica={t.noModoCodigo} icone={<Search size={16} />} desabilitado={modo === 'visual'} aoClicar={() => aoComando('busca')} />
        <Botao rotulo={t.estrutura} dica={t.estruturaDica} icone={<PanelLeft size={16} />} ligado={estruturaAberta} aoClicar={aoAlternarEstrutura} />
      </Grupo>

      <Grupo rotulo={t.modo}>
        <Botao rotulo={t.visual} dica={t.visualDica} icone={<PenLine size={16} />} ligado={modo === 'visual'} aoClicar={() => aoMudarModo('visual')} />
        <Botao rotulo={t.codigo} dica={t.codigoDica} icone={<Code size={16} />} ligado={modo === 'codigo'} aoClicar={() => aoMudarModo('codigo')} />
        <Botao rotulo={t.dividido} dica={t.divididoDica} icone={<Eye size={16} />} ligado={modo === 'dividido'} aoClicar={() => aoMudarModo('dividido')} />
      </Grupo>
    </div>
  );
}
