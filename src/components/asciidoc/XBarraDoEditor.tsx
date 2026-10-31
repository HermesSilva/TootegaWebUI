/**
 * XBarraDoEditor — a barra de ferramentas do editor AsciiDoc, em grupos: histórico, tipo de bloco, formatação,
 * listas, inserção, tabela, ferramentas e modo. Todo botão tem nome acessível, dica e atalho; o estado da seleção
 * sai por `aria-pressed`. Os botões não roubam o foco do editor (`onMouseDown` previne o padrão).
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

const ROTULO_DO_BLOCO: Record<TipoDeBlocoDeTexto, string> = {
  paragrafo: 'Parágrafo',
  titulo1: 'Título 1',
  titulo2: 'Título 2',
  titulo3: 'Título 3',
  titulo4: 'Título 4',
  titulo5: 'Título 5',
  literal: 'Literal',
  citacao: 'Citação',
  codigo: 'Código',
};

// ============================================================================
// A barra
// ============================================================================

export function XBarraDoEditor({ modo, aoMudarModo, podeDesfazer, podeRefazer, aoDesfazer, aoRefazer, estado, aoComando, somenteLeitura, estruturaAberta, aoAlternarEstrutura, formatacaoAtiva }: XBarraDoEditorProps): JSX.Element {
  const inativo = somenteLeitura || !formatacaoAtiva;
  const marca = (pTipo: TipoDeMarca): boolean => estado.marcas.has(pTipo);

  return (
    <div className="adc-barra" role="toolbar" aria-label="Ferramentas do editor AsciiDoc">
      <Grupo rotulo="Histórico">
        <Botao rotulo="Desfazer" atalho="Ctrl+Z" icone={<Undo2 size={16} />} desabilitado={somenteLeitura || !podeDesfazer} aoClicar={aoDesfazer} />
        <Botao rotulo="Refazer" atalho="Ctrl+Y" icone={<Redo2 size={16} />} desabilitado={somenteLeitura || !podeRefazer} aoClicar={aoRefazer} />
      </Grupo>

      <Grupo rotulo="Tipo de bloco">
        <XMenuSuspenso
          gatilho={
            <span className="adc-barra-gatilho">
              <Pilcrow size={14} aria-hidden="true" />
              <span>{estado.tipoDeBloco ? ROTULO_DO_BLOCO[estado.tipoDeBloco] : 'Bloco'}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel="Tipo de bloco"
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          selecionada={estado.tipoDeBloco ?? undefined}
          opcoes={[
            { id: 'paragrafo', rotulo: 'Parágrafo', detalhe: 'Ctrl+Shift+0' },
            { id: 'titulo1', rotulo: 'Título 1', detalhe: 'Ctrl+Shift+1' },
            { id: 'titulo2', rotulo: 'Título 2', detalhe: 'Ctrl+Shift+2' },
            { id: 'titulo3', rotulo: 'Título 3', detalhe: 'Ctrl+Shift+3' },
            { id: 'titulo4', rotulo: 'Título 4', detalhe: 'Ctrl+Shift+4' },
            { id: 'titulo5', rotulo: 'Título 5', detalhe: 'Ctrl+Shift+5' },
            { id: 'literal', rotulo: 'Literal', detalhe: 'Texto como está, em fonte fixa' },
            { id: 'citacao', rotulo: 'Citação', detalhe: 'Bloco de citação' },
            { id: 'codigo', rotulo: 'Código', detalhe: 'Vira bloco de código' },
          ]}
          aoEscolher={(pID) => {
            if (!inativo)
              aoComando(`bloco:${pID as TipoDeBlocoDeTexto}`);
          }}
        />
      </Grupo>

      <Grupo rotulo="Formatação">
        <Botao rotulo="Negrito" atalho="Ctrl+B" icone={<Bold size={16} />} ligado={marca('negrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:negrito')} />
        <Botao rotulo="Itálico" atalho="Ctrl+I" icone={<Italic size={16} />} ligado={marca('italico')} desabilitado={inativo} aoClicar={() => aoComando('marca:italico')} />
        <Botao rotulo="Monoespaçado" atalho="Ctrl+E" icone={<Code size={16} />} ligado={marca('mono')} desabilitado={inativo} aoClicar={() => aoComando('marca:mono')} />
        <Botao rotulo="Realce" atalho="Ctrl+H" icone={<Highlighter size={16} />} ligado={marca('realce')} desabilitado={inativo} aoClicar={() => aoComando('marca:realce')} />
        <Botao rotulo="Sublinhado" atalho="Ctrl+U" icone={<Underline size={16} />} ligado={marca('sublinhado')} desabilitado={inativo} aoClicar={() => aoComando('marca:sublinhado')} />
        <Botao rotulo="Tachado" atalho="Ctrl+Shift+X" icone={<Strikethrough size={16} />} ligado={marca('tachado')} desabilitado={inativo} aoClicar={() => aoComando('marca:tachado')} />
        <Botao rotulo="Sobrescrito" icone={<Superscript size={16} />} ligado={marca('sobrescrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:sobrescrito')} />
        <Botao rotulo="Subscrito" icone={<Subscript size={16} />} ligado={marca('subscrito')} desabilitado={inativo} aoClicar={() => aoComando('marca:subscrito')} />
        <Botao rotulo="Limpar formatação" dica="Tira todas as marcas do trecho selecionado" icone={<RemoveFormatting size={16} />} desabilitado={inativo} aoClicar={() => aoComando('limparMarcas')} />
      </Grupo>

      <Grupo rotulo="Listas">
        <Botao rotulo="Lista com marcadores" atalho="Ctrl+Shift+8" icone={<List size={16} />} ligado={estado.lista === 'marcadores'} desabilitado={inativo} aoClicar={() => aoComando('lista:marcadores')} />
        <Botao rotulo="Lista numerada" atalho="Ctrl+Shift+7" icone={<ListOrdered size={16} />} ligado={estado.lista === 'numerada'} desabilitado={inativo} aoClicar={() => aoComando('lista:numerada')} />
        <Botao rotulo="Lista de tarefas" atalho="Ctrl+Shift+9" icone={<ListChecks size={16} />} ligado={estado.lista === 'tarefas'} desabilitado={inativo} aoClicar={() => aoComando('lista:tarefas')} />
        <Botao rotulo="Lista de descrição" dica="Termo e definição" icone={<ListTree size={16} />} ligado={estado.lista === 'descricao'} desabilitado={inativo} aoClicar={() => aoComando('lista:descricao')} />
        <Botao rotulo="Aumentar recuo" atalho="Tab" icone={<ListIndentIncrease size={16} />} desabilitado={inativo || estado.lista === null || estado.lista === 'descricao'} aoClicar={() => aoComando('recuar')} />
        <Botao rotulo="Diminuir recuo" atalho="Shift+Tab" icone={<ListIndentDecrease size={16} />} desabilitado={inativo || estado.lista === null || estado.lista === 'descricao'} aoClicar={() => aoComando('avancar')} />
      </Grupo>

      <Grupo rotulo="Inserir">
        <Botao rotulo="Link" atalho="Ctrl+K" icone={<Link size={16} />} ligado={marca('link')} desabilitado={inativo} aoClicar={() => aoComando('inserir:link')} />
        <Botao rotulo="Imagem" icone={<Image size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:imagem')} />
        <Botao rotulo="Tabela" icone={<Table size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:tabela')} />
        <Botao rotulo="Bloco de código" icone={<Braces size={16} />} desabilitado={inativo} aoClicar={() => aoComando('inserir:codigo')} />
        <XMenuSuspenso
          gatilho={
            <span className="adc-barra-gatilho">
              <Info size={14} aria-hidden="true" />
              <span>Admonição</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel="Inserir admonição"
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          opcoes={[
            { id: 'NOTE', rotulo: 'Nota', detalhe: 'NOTE' },
            { id: 'TIP', rotulo: 'Dica', detalhe: 'TIP' },
            { id: 'IMPORTANT', rotulo: 'Importante', detalhe: 'IMPORTANT' },
            { id: 'WARNING', rotulo: 'Atenção', detalhe: 'WARNING' },
            { id: 'CAUTION', rotulo: 'Cuidado', detalhe: 'CAUTION' },
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
              <span>Mais</span>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          }
          rotuloAcessivel="Inserir outros elementos"
          classeDoGatilho={`adc-barra-seletor${inativo ? ' adc-barra-seletor-inativo' : ''}`}
          opcoes={[
            { id: 'exemplo', rotulo: 'Bloco de exemplo', detalhe: '====' },
            { id: 'barraLateral', rotulo: 'Barra lateral', detalhe: '****' },
            { id: 'citacao', rotulo: 'Citação', detalhe: '____' },
            { id: 'notaDeRodape', rotulo: 'Nota de rodapé', detalhe: 'footnote:[]' },
            { id: 'referencia', rotulo: 'Referência cruzada', detalhe: '<<id>>' },
            { id: 'ancora', rotulo: 'Âncora', detalhe: '[[id]]' },
            { id: 'tecla', rotulo: 'Tecla, botão ou menu', detalhe: 'kbd:[] btn:[] menu:[]' },
            { id: 'quebraDeLinha', rotulo: 'Quebra de linha', detalhe: 'Shift+Enter' },
            { id: 'quebraTematica', rotulo: 'Quebra temática', detalhe: "'''" },
            { id: 'quebraDePagina', rotulo: 'Quebra de página', detalhe: '<<<' },
            { id: 'sumario', rotulo: 'Sumário', detalhe: 'toc::[]' },
            { id: 'atributo', rotulo: 'Atributo do documento', detalhe: ':nome: valor' },
            { id: 'comentario', rotulo: 'Comentário', detalhe: '//' },
          ]}
          aoEscolher={(pID) => {
            if (!inativo)
              aoComando(`inserir:${pID}` as ComandoDaBarra);
          }}
        />
      </Grupo>

      {estado.emTabela && (
        <Grupo rotulo="Tabela">
          <Botao rotulo="Linha acima" icone={<Rows3 size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:linhaAntes')} />
          <Botao rotulo="Linha abaixo" icone={<Rows3 size={16} className="rotate-180" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:linhaDepois')} />
          <Botao rotulo="Coluna à esquerda" icone={<Columns2 size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:colunaAntes')} />
          <Botao rotulo="Coluna à direita" icone={<Columns2 size={16} className="rotate-180" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:colunaDepois')} />
          <Botao rotulo="Remover linha" icone={<Minus size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:removerLinha')} />
          <Botao rotulo="Remover coluna" icone={<Minus size={16} className="rotate-90" />} desabilitado={inativo} aoClicar={() => aoComando('tabela:removerColuna')} />
          <Botao rotulo="Alinhar coluna à esquerda" dica="Vale para a coluna inteira" icone={<TextAlignStart size={16} />} ligado={estado.alinhamentoDaCelula === 'esquerda'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharEsquerda')} />
          <Botao rotulo="Centralizar coluna" dica="Vale para a coluna inteira" icone={<TextAlignCenter size={16} />} ligado={estado.alinhamentoDaCelula === 'centro'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharCentro')} />
          <Botao rotulo="Alinhar coluna à direita" dica="Vale para a coluna inteira" icone={<TextAlignEnd size={16} />} ligado={estado.alinhamentoDaCelula === 'direita'} desabilitado={inativo} aoClicar={() => aoComando('tabela:alinharDireita')} />
          <Botao rotulo="Primeira linha é cabeçalho" icone={<Hash size={16} />} ligado={estado.cabecalhoDaTabela} desabilitado={inativo} aoClicar={() => aoComando('tabela:cabecalho')} />
          <Botao rotulo="Remover tabela" icone={<Trash size={16} />} desabilitado={inativo} aoClicar={() => aoComando('tabela:remover')} />
        </Grupo>
      )}

      <Grupo rotulo="Ferramentas">
        <Botao rotulo="Localizar e substituir" atalho="Ctrl+F" dica="No modo Código" icone={<Search size={16} />} desabilitado={modo === 'visual'} aoClicar={() => aoComando('busca')} />
        <Botao rotulo="Estrutura" dica="Painel com os títulos do documento" icone={<PanelLeft size={16} />} ligado={estruturaAberta} aoClicar={aoAlternarEstrutura} />
      </Grupo>

      <Grupo rotulo="Modo">
        <Botao rotulo="Visual" dica="Edição WYSIWYG" icone={<PenLine size={16} />} ligado={modo === 'visual'} aoClicar={() => aoMudarModo('visual')} />
        <Botao rotulo="Código" dica="O AsciiDoc com realce" icone={<Code size={16} />} ligado={modo === 'codigo'} aoClicar={() => aoMudarModo('codigo')} />
        <Botao rotulo="Dividido" dica="Código à esquerda, visual ao vivo à direita" icone={<Eye size={16} />} ligado={modo === 'dividido'} aoClicar={() => aoMudarModo('dividido')} />
      </Grupo>
    </div>
  );
}
