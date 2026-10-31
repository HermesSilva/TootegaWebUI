/**
 * XEditorAsciiDoc — o editor AsciiDoc completo: barra de ferramentas, três modos (Visual, Código, Dividido),
 * painel de estrutura, diálogos contidos, barra de status e histórico. Entra texto AsciiDoc, sai texto AsciiDoc.
 *
 * Quem guarda o estado é este componente: o documento (modelo) no modo visual, o texto no modo código; a troca de
 * modo converte um no outro. As transações do modo visual passam por aqui (`aplicar`), que registra o histórico e
 * emite o texto serializado (com um pequeno atraso, para a digitação não pagar a serialização a cada tecla).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type PointerEvent as PointerEventDoReact } from 'react';
import './asciidoc.css';
import { XBarraDoEditor, type ComandoDaBarra, type EstadoDaBarra, type ModoDoEditor } from './XBarraDoEditor';
import { XDialogoDoEditor } from './XDialogoDoEditor';
import { XExplicacaoDoModelo } from './XExplicacaoDoModelo';
import { avaliarModelo, garantirEspacoDasSecoes, secoesTravadas, violacaoDoModelo, type ModeloDeDocumento } from './modelo/modeloDeDocumento';
import { XEditorDeCodigo, type PosicaoNoCodigo } from './codigo/XEditorDeCodigo';
import { XVistaWYSIWYG, type PedidoDeDialogo } from './wysiwyg/XVistaWYSIWYG';
import { analisarAsciiDoc, documentoVazio } from './parser/blocos';
import { serializarDocumento } from './serializador/serializar';
import { folhaPorID, marcasNaPosicao, novoID, textoDoDocumento, textoPuro } from './modelo/documento';
import type { AvisoDoParser, Bloco, Documento, EspecieDeAdmonicao, EstiloDeLista, Marca, Tabela, TipoDeMarca } from './modelo/tipos';
import { Historico } from './editor/historico';
import { ajustarSelecao, estaColapsada, selecaoColapsada, type Selecao } from './editor/selecao';
import {
  alinharColunaDaTabela,
  alternarLista,
  alternarMarca,
  blocoDaFolha,
  definirTipoDeBloco,
  elevarItemAParagrafo,
  embrulharEmContainer,
  inserirAtomo,
  inserirBlocosNaSelecao,
  inserirColunaNaTabela,
  inserirLinhaNaTabela,
  limparMarcas,
  paragrafoVazio,
  recuarItem,
  removerBloco,
  removerColunaDaTabela,
  removerLinhaDaTabela,
  selecaoTemMarca,
  substituirBloco,
  type Resultado,
  type TipoDeBlocoDeTexto,
} from './editor/transacoes';
import { atomo } from './modelo/documento';
import { MARCAS_SIMPLES } from './modelo/tipos';

// ============================================================================
// Tipos
// ============================================================================

export interface XEditorAsciiDocProps {
  valor: string;
  aoMudar: (pValor: string) => void;
  modoInicial?: ModoDoEditor;
  somenteLeitura?: boolean;
  /** `preencher` ocupa a altura do pai (o pai precisa ter altura); número = altura fixa em px. */
  altura?: 'preencher' | number;
  rotuloAcessivel?: string;
  className?: string;
  /** Mostra o painel de estrutura aberto de início. */
  estruturaAberta?: boolean;
  /** O modelo a que o documento está sujeito: explicação não editável no topo e pendências na barra de status. */
  modelo?: ModeloDeDocumento;
}

const ATRASO_DE_EMISSAO_MS = 150;
const CHAVE_DA_PROPORCAO = 'tootega.editorAsciiDoc.proporcao';
const PROPORCAO_MINIMA = 0.15;
const PASSO_DO_TECLADO = 0.05;
/** Largura do painel de estrutura (a mesma do CSS `.adc-estrutura`), descontada no cálculo do arrasto. */
const LARGURA_DA_ESTRUTURA = 256;

function contarPalavras(pTexto: string): number {
  const m = pTexto.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

function contarBlocos(pBlocos: Bloco[]): number {
  let total = 0;
  for (const bloco of pBlocos) {
    total += 1;
    if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
      for (const item of bloco.itens)
        total += contarBlocos(item.filhos);
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      total += contarBlocos(bloco.filhos);
  }
  return total;
}

interface Titulo {
  id: string;
  nivel: number;
  texto: string;
}

function titulosDoDocumento(pBlocos: Bloco[], pSaida: Titulo[] = []): Titulo[] {
  for (const bloco of pBlocos) {
    if (bloco.tipo === 'titulo')
      pSaida.push({ id: bloco.id, nivel: bloco.nivel, texto: textoPuro(bloco.conteudo) || '(sem texto)' });
    if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
      for (const item of bloco.itens)
        titulosDoDocumento(item.filhos, pSaida);
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      titulosDoDocumento(bloco.filhos, pSaida);
  }
  return pSaida;
}

// ============================================================================
// O editor
// ============================================================================

export function XEditorAsciiDoc({ valor, aoMudar, modoInicial = 'visual', somenteLeitura = false, altura = 'preencher', rotuloAcessivel = 'Editor AsciiDoc', className = '', estruturaAberta: estruturaInicial = false, modelo }: XEditorAsciiDocProps): JSX.Element {
  const [modo, setModo] = useState<ModoDoEditor>(modoInicial);
  const [texto, setTexto] = useState(valor);
  const analiseInicial = useMemo(() => analisarAsciiDoc(valor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [documento, setDocumento] = useState<Documento>(() => (analiseInicial.documento.blocos.length === 0 ? { ...analiseInicial.documento, blocos: documentoVazio().blocos } : analiseInicial.documento));
  const [avisos, setAvisos] = useState<AvisoDoParser[]>(analiseInicial.avisos);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [marcasPendentes, setMarcasPendentes] = useState<Marca[] | null>(null);
  const [blocoSelecionado, setBlocoSelecionado] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<PedidoDeDialogo | null>(null);
  const [estruturaAberta, setEstruturaAberta] = useState(estruturaInicial);
  const [cursorNoCodigo, setCursorNoCodigo] = useState<PosicaoNoCodigo>({ linha: 1, coluna: 1 });
  const [pedidoDeBusca, setPedidoDeBusca] = useState(0);
  const [irParaLinha, setIrParaLinha] = useState<{ linha: number; n: number } | undefined>(undefined);
  // Modo dividido: a fração do corpo que o código ocupa (o resto é a prévia). Lembrada entre sessões.
  const [proporcao, setProporcao] = useState<number>(() => {
    const guardada = Number(window.localStorage.getItem(CHAVE_DA_PROPORCAO));
    return Number.isFinite(guardada) && guardada >= PROPORCAO_MINIMA && guardada <= 1 - PROPORCAO_MINIMA ? guardada : 0.5;
  });
  const [arrastando, setArrastando] = useState(false);
  // A recusa mais recente do modelo (some sozinha). Não é erro mudo: nomeia a seção e o motivo.
  const [recusaDoModelo, setRecusaDoModelo] = useState<string | null>(null);
  const temporizadorDaRecusa = useRef<number | null>(null);
  const modeloRef = useRef(modelo);
  modeloRef.current = modelo;
  const corpo = useRef<HTMLDivElement>(null);
  const [, forcar] = useState(0);
  const historico = useRef(new Historico());
  const ultimoEmitido = useRef(valor);
  const temporizador = useRef<number | null>(null);
  const documentoRef = useRef(documento);
  documentoRef.current = documento;

  // ------------------------------------------------- sincronismo com o valor

  /** Emite o texto do documento (com atraso), guardando o que emitiu para não reanalisar o próprio eco. */
  const emitirDocumento = useCallback(
    (pDocumento: Documento, pImediato = false) => {
      const emitir = (): void => {
        const serializado = serializarDocumento(pDocumento);
        if (serializado === ultimoEmitido.current)
          return;
        ultimoEmitido.current = serializado;
        setTexto(serializado);
        aoMudar(serializado);
      };
      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
        temporizador.current = null;
      }
      if (pImediato)
        emitir();
      else
        temporizador.current = window.setTimeout(() => {
          temporizador.current = null;
          emitir();
        }, ATRASO_DE_EMISSAO_MS);
    },
    [aoMudar],
  );

  useEffect(() => () => {
    if (temporizador.current !== null)
      window.clearTimeout(temporizador.current);
  }, []);

  // Valor novo vindo de fora (não o nosso eco): reanalisa.
  useEffect(() => {
    if (valor === ultimoEmitido.current)
      return;
    ultimoEmitido.current = valor;
    setTexto(valor);
    const analise = analisarAsciiDoc(valor);
    setDocumento(analise.documento.blocos.length === 0 ? { ...analise.documento, blocos: documentoVazio().blocos } : analise.documento);
    setAvisos(analise.avisos);
    setSelecao(null);
    historico.current.limpar();
  }, [valor]);

  // ------------------------------------------------------------ transações

  const aplicar = useCallback(
    (pResultado: Resultado, pGrupo: string | null) => {
      const antes = documentoRef.current;
      if (pResultado.documento === antes && pResultado.selecao !== undefined) {
        setSelecao(ajustarSelecao(pResultado.documento, pResultado.selecao));
        return;
      }
      // O modelo manda: transação que mexe numa seção fixa é recusada inteira, com o motivo na barra de status.
      const modeloCorrente = modeloRef.current;
      if (modeloCorrente) {
        const violacao = violacaoDoModelo(antes, pResultado.documento, modeloCorrente);
        if (violacao) {
          setRecusaDoModelo(violacao);
          if (temporizadorDaRecusa.current !== null)
            window.clearTimeout(temporizadorDaRecusa.current);
          temporizadorDaRecusa.current = window.setTimeout(() => setRecusaDoModelo(null), 4000);
          // Reafirma a seleção corrente para o DOM voltar ao estado do modelo.
          setSelecao((pS) => (pS ? { ...pS } : pS));
          forcar((pN) => pN + 1);
          return;
        }
      }
      historico.current.registrar({ documento: antes, selecao }, pGrupo);
      const documentoFinal = modeloCorrente ? garantirEspacoDasSecoes(pResultado.documento, modeloCorrente) : pResultado.documento;
      documentoRef.current = documentoFinal;
      setDocumento(documentoFinal);
      setSelecao(ajustarSelecao(documentoFinal, pResultado.selecao));
      setMarcasPendentes(null);
      emitirDocumento(documentoFinal);
      forcar((pN) => pN + 1);
    },
    [emitirDocumento, selecao],
  );

  // Documento com modelo: toda seção fixa tem um lugar editável logo abaixo, também ao carregar.
  useEffect(() => {
    if (!modelo)
      return;
    const comEspaco = garantirEspacoDasSecoes(documentoRef.current, modelo);
    if (comEspaco !== documentoRef.current) {
      documentoRef.current = comEspaco;
      setDocumento(comEspaco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, valor]);

  const desfazer = useCallback(() => {
    const anterior = historico.current.desfazer({ documento: documentoRef.current, selecao });
    if (!anterior)
      return;
    documentoRef.current = anterior.documento;
    setDocumento(anterior.documento);
    setSelecao(ajustarSelecao(anterior.documento, anterior.selecao));
    emitirDocumento(anterior.documento);
  }, [emitirDocumento, selecao]);

  const refazer = useCallback(() => {
    const proximo = historico.current.refazer({ documento: documentoRef.current, selecao });
    if (!proximo)
      return;
    documentoRef.current = proximo.documento;
    setDocumento(proximo.documento);
    setSelecao(ajustarSelecao(proximo.documento, proximo.selecao));
    emitirDocumento(proximo.documento);
  }, [emitirDocumento, selecao]);

  const alternarMarcaNaSelecao = useCallback(
    (pTipo: TipoDeMarca) => {
      if (!selecao || somenteLeitura)
        return;
      if (estaColapsada(selecao)) {
        const folha = folhaPorID(documento, selecao.foco.folha);
        const base = marcasPendentes ?? (folha ? marcasNaPosicao(folha.folha.conteudo, selecao.foco.deslocamento) : []);
        const tem = base.some((pM) => pM.tipo === pTipo);
        setMarcasPendentes(tem ? base.filter((pM) => pM.tipo !== pTipo) : [...base, { tipo: pTipo }]);
        return;
      }
      aplicar(alternarMarca(documento, selecao, { tipo: pTipo }), null);
    },
    [aplicar, documento, marcasPendentes, selecao, somenteLeitura],
  );

  // ------------------------------------------------------------------- modos

  const mudarModo = useCallback(
    (pModo: ModoDoEditor) => {
      if (pModo === modo)
        return;
      if (modo === 'visual') {
        // Sai do visual: o texto passa a mandar.
        emitirDocumento(documentoRef.current, true);
      } else if (pModo === 'visual') {
        // Entra no visual: reanalisa o texto corrente.
        const analise = analisarAsciiDoc(texto);
        const doc = analise.documento.blocos.length === 0 ? { ...analise.documento, blocos: documentoVazio().blocos } : analise.documento;
        documentoRef.current = doc;
        setDocumento(doc);
        setAvisos(analise.avisos);
        setSelecao(null);
        historico.current.limpar();
      }
      setModo(pModo);
      setBlocoSelecionado(null);
    },
    [emitirDocumento, modo, texto],
  );

  const aoMudarTexto = useCallback(
    (pTexto: string) => {
      setTexto(pTexto);
      ultimoEmitido.current = pTexto;
      aoMudar(pTexto);
    },
    [aoMudar],
  );

  // Pré-visualização do modo dividido (e a avaliação do modelo no modo código): reanalisa o texto com atraso.
  const [documentoDaPrevia, setDocumentoDaPrevia] = useState<Documento>(documento);
  useEffect(() => {
    if (modo === 'visual')
      return;
    const temporizadorDaPrevia = window.setTimeout(() => {
      const analise = analisarAsciiDoc(texto);
      setDocumentoDaPrevia(analise.documento);
      setAvisos(analise.avisos);
    }, 200);
    return () => window.clearTimeout(temporizadorDaPrevia);
  }, [modo, texto]);

  // ------------------------------------------------------------- comandos

  const folhaCorrente = selecao ? folhaPorID(documento, selecao.foco.folha) : undefined;
  const tabelaCorrente = folhaCorrente?.especie === 'celula' ? (blocoDaFolha(folhaCorrente) as Tabela) : null;

  const estadoDaBarra = useMemo<EstadoDaBarra>(() => {
    const marcas = new Set<TipoDeMarca>();
    if (selecao && folhaCorrente) {
      if (estaColapsada(selecao)) {
        for (const marca of marcasPendentes ?? marcasNaPosicao(folhaCorrente.folha.conteudo, selecao.foco.deslocamento))
          marcas.add(marca.tipo);
      } else
        for (const tipo of [...MARCAS_SIMPLES, 'link' as const])
          if (selecaoTemMarca(documento, selecao, tipo))
            marcas.add(tipo);
    }
    let tipoDeBloco: TipoDeBlocoDeTexto | null = null;
    let lista: EstiloDeLista | 'descricao' | null = null;
    if (folhaCorrente) {
      const bloco = blocoDaFolha(folhaCorrente);
      if (folhaCorrente.especie === 'paragrafo' && bloco.tipo === 'paragrafo')
        tipoDeBloco = bloco.estilo === 'literal' ? 'literal' : folhaCorrente.cadeia.some((pB) => pB.tipo === 'container' && pB.especie === 'citacao') ? 'citacao' : 'paragrafo';
      else if (folhaCorrente.especie === 'titulo' && bloco.tipo === 'titulo')
        tipoDeBloco = `titulo${bloco.nivel}` as TipoDeBlocoDeTexto;
      else if (folhaCorrente.especie === 'item' && bloco.tipo === 'lista') {
        tipoDeBloco = 'paragrafo';
        lista = bloco.estilo;
      } else if (folhaCorrente.especie === 'termo')
        lista = 'descricao';
    }
    const celula = folhaCorrente?.especie === 'celula' ? (folhaCorrente.item as { alinhamento?: 'esquerda' | 'centro' | 'direita' }) : undefined;
    return { marcas, tipoDeBloco, lista, emTabela: tabelaCorrente !== null, cabecalhoDaTabela: tabelaCorrente?.cabecalho ?? false, alinhamentoDaCelula: celula?.alinhamento ?? 'esquerda' };
  }, [documento, folhaCorrente, marcasPendentes, selecao, tabelaCorrente]);

  const executar = useCallback(
    (pComando: ComandoDaBarra) => {
      if (pComando === 'busca') {
        setPedidoDeBusca((pN) => pN + 1);
        return;
      }
      if (somenteLeitura || !selecao)
        return;
      const doc = documentoRef.current;
      if (pComando.startsWith('marca:')) {
        alternarMarcaNaSelecao(pComando.slice(6) as TipoDeMarca);
        return;
      }
      if (pComando === 'limparMarcas') {
        aplicar(limparMarcas(doc, selecao), null);
        setMarcasPendentes([]);
        return;
      }
      if (pComando.startsWith('bloco:')) {
        aplicar(definirTipoDeBloco(doc, selecao, pComando.slice(6) as TipoDeBlocoDeTexto), null);
        return;
      }
      if (pComando === 'lista:descricao') {
        const folha = folhaPorID(doc, selecao.foco.folha);
        if (!folha)
          return;
        if (folha.especie === 'termo') {
          // Volta a parágrafo: o termo vira parágrafo e a descrição o segue.
          const bloco = blocoDaFolha(folha);
          const item = folha.item as { id: string; filhos: Bloco[] };
          const resultado = substituirBloco(doc, bloco.id, (pB) => {
            const lista = pB as Bloco & { tipo: 'descricao' };
            const indice = lista.itens.findIndex((pI) => pI.id === item.id);
            const antes = lista.itens.slice(0, indice);
            const depois = lista.itens.slice(indice + 1);
            const saida: Bloco[] = [];
            if (antes.length > 0)
              saida.push({ ...lista, itens: antes });
            saida.push({ id: item.id, tipo: 'paragrafo', conteudo: folha.folha.conteudo }, ...item.filhos);
            if (depois.length > 0)
              saida.push({ ...lista, id: novoID(), itens: depois });
            return saida;
          });
          aplicar({ documento: resultado, selecao: selecaoColapsada(item.id, 0) }, null);
          return;
        }
        let base = doc;
        let alvo = folha;
        if (folha.especie === 'item') {
          const elevado = elevarItemAParagrafo(doc, folha);
          base = elevado.documento;
          const nova = elevado.selecao ? folhaPorID(base, elevado.selecao.foco.folha) : undefined;
          if (!nova)
            return;
          alvo = nova;
        }
        if (alvo.especie !== 'paragrafo' && alvo.especie !== 'titulo')
          return;
        const bloco = blocoDaFolha(alvo);
        const descricao = paragrafoVazio();
        const resultado = substituirBloco(base, bloco.id, () => ({ id: novoID(), tipo: 'descricao', itens: [{ id: alvo.folha.id, conteudo: alvo.folha.conteudo, filhos: [descricao] }] }));
        aplicar({ documento: resultado, selecao: selecaoColapsada(descricao.id, 0) }, null);
        return;
      }
      if (pComando.startsWith('lista:')) {
        aplicar(alternarLista(doc, selecao, pComando.slice(6) as EstiloDeLista), null);
        return;
      }
      if (pComando === 'recuar' || pComando === 'avancar') {
        const folha = folhaPorID(doc, selecao.foco.folha);
        if (folha)
          aplicar(recuarItem(doc, folha, pComando === 'recuar' ? 1 : -1), null);
        return;
      }
      if (pComando.startsWith('inserir:admonicao:')) {
        aplicar(embrulharEmContainer(doc, selecao, { tipo: 'admonicao', especie: pComando.slice(18) as EspecieDeAdmonicao }), null);
        return;
      }
      switch (pComando) {
        case 'inserir:link':
        case 'inserir:imagem':
        case 'inserir:tabela':
        case 'inserir:referencia':
        case 'inserir:notaDeRodape':
        case 'inserir:atributo':
        case 'inserir:tecla':
        case 'inserir:ancora':
          setDialogo({ tipo: pComando.slice(8) as PedidoDeDialogo['tipo'] });
          return;
        case 'inserir:codigo':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'codigo', estilo: 'fonte', codigo: '' }]), null);
          return;
        case 'inserir:exemplo':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'exemplo' }), null);
          return;
        case 'inserir:barraLateral':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'barraLateral' }), null);
          return;
        case 'inserir:citacao':
          aplicar(embrulharEmContainer(doc, selecao, { tipo: 'container', especie: 'citacao' }), null);
          return;
        case 'inserir:quebraDeLinha':
          aplicar(inserirAtomo(doc, selecao, atomo('quebraDeLinha')), null);
          return;
        case 'inserir:quebraTematica':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'quebraTematica' }, paragrafoVazio()]), null);
          return;
        case 'inserir:quebraDePagina':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'quebraDePagina' }, paragrafoVazio()]), null);
          return;
        case 'inserir:sumario':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'sumario' }, paragrafoVazio()]), null);
          return;
        case 'inserir:comentario':
          aplicar(inserirBlocosNaSelecao(doc, selecao, [{ id: novoID(), tipo: 'comentario', texto: '', emBloco: false }, paragrafoVazio()]), null);
          return;
        default:
          break;
      }
      if (pComando.startsWith('tabela:') && tabelaCorrente && folhaCorrente) {
        const linha = tabelaCorrente.linhas.findIndex((pL) => pL.celulas.some((pC) => pC.id === folhaCorrente.folha.id));
        const coluna = tabelaCorrente.linhas[linha]?.celulas.findIndex((pC) => pC.id === folhaCorrente.folha.id) ?? 0;
        switch (pComando) {
          case 'tabela:linhaAntes':
            aplicar(inserirLinhaNaTabela(doc, tabelaCorrente.id, linha), null);
            return;
          case 'tabela:linhaDepois':
            aplicar(inserirLinhaNaTabela(doc, tabelaCorrente.id, linha + 1), null);
            return;
          case 'tabela:colunaAntes':
            aplicar({ ...inserirColunaNaTabela(doc, tabelaCorrente.id, coluna), selecao }, null);
            return;
          case 'tabela:colunaDepois':
            aplicar({ ...inserirColunaNaTabela(doc, tabelaCorrente.id, coluna + 1), selecao }, null);
            return;
          case 'tabela:removerLinha':
            aplicar(removerLinhaDaTabela(doc, tabelaCorrente.id, linha), null);
            return;
          case 'tabela:removerColuna':
            aplicar(removerColunaDaTabela(doc, tabelaCorrente.id, coluna), null);
            return;
          case 'tabela:cabecalho':
            aplicar({ documento: substituirBloco(doc, tabelaCorrente.id, (pB) => ({ ...(pB as Tabela), cabecalho: !(pB as Tabela).cabecalho })), selecao }, null);
            return;
          case 'tabela:alinharEsquerda':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, undefined), selecao }, null);
            return;
          case 'tabela:alinharCentro':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, 'centro'), selecao }, null);
            return;
          case 'tabela:alinharDireita':
            aplicar({ documento: alinharColunaDaTabela(doc, tabelaCorrente.id, coluna, 'direita'), selecao }, null);
            return;
          case 'tabela:remover':
            aplicar({ documento: removerBloco(doc, tabelaCorrente.id), selecao: null }, null);
            return;
          default:
            return;
        }
      }
    },
    [alternarMarcaNaSelecao, aplicar, folhaCorrente, selecao, somenteLeitura, tabelaCorrente],
  );

  // ------------------------------------------------------------------ divisor

  const definirProporcao = useCallback((pProporcao: number) => {
    const limitada = Math.min(1 - PROPORCAO_MINIMA, Math.max(PROPORCAO_MINIMA, pProporcao));
    setProporcao(limitada);
    window.localStorage.setItem(CHAVE_DA_PROPORCAO, String(limitada));
  }, []);

  /** Arrasto com Pointer Events: captura o ponteiro no divisor, para o gesto continuar fora dele. */
  const iniciarArrasto = useCallback(
    (pEvento: PointerEventDoReact<HTMLDivElement>) => {
      if (pEvento.button !== 0)
        return;
      pEvento.preventDefault();
      const alvo = pEvento.currentTarget;
      alvo.setPointerCapture(pEvento.pointerId);
      setArrastando(true);
      const mover = (pMovimento: PointerEvent): void => {
        const caixa = corpo.current?.getBoundingClientRect();
        if (!caixa || caixa.width === 0)
          return;
        const esquerda = caixa.left + (estruturaAberta ? LARGURA_DA_ESTRUTURA : 0);
        definirProporcao((pMovimento.clientX - esquerda) / (caixa.right - esquerda));
      };
      const soltar = (): void => {
        setArrastando(false);
        alvo.removeEventListener('pointermove', mover);
        alvo.removeEventListener('pointerup', soltar);
        alvo.removeEventListener('pointercancel', soltar);
      };
      alvo.addEventListener('pointermove', mover);
      alvo.addEventListener('pointerup', soltar);
      alvo.addEventListener('pointercancel', soltar);
    },
    [definirProporcao, estruturaAberta],
  );

  // ----------------------------------------------------------------- estrutura

  const titulos = useMemo(() => titulosDoDocumento(modo === 'visual' ? documento.blocos : documentoDaPrevia.blocos), [documento, documentoDaPrevia, modo]);

  const irParaTitulo = useCallback(
    (pTitulo: Titulo) => {
      if (modo === 'visual') {
        setSelecao(selecaoColapsada(pTitulo.id, 0));
        return;
      }
      const linhas = texto.split('\n');
      const indice = linhas.findIndex((pL) => /^(={2,6}|#{1,6})\s+/.test(pL) && pL.replace(/^(={2,6}|#{1,6})\s+/, '').replace(/\s+=+$/, '').trim() === pTitulo.texto);
      if (indice !== -1)
        setIrParaLinha({ linha: indice + 1, n: Date.now() });
    },
    [modo, texto],
  );

  // ------------------------------------------------------------------ status

  const textoCorrente = modo === 'visual' ? textoDoDocumento(documento) : texto;
  const palavras = useMemo(() => contarPalavras(textoCorrente), [textoCorrente]);
  const caracteres = textoCorrente.length;
  const blocos = useMemo(() => contarBlocos((modo === 'visual' ? documento : documentoDaPrevia).blocos), [documento, documentoDaPrevia, modo]);
  const linhas = useMemo(() => (modo === 'visual' ? 0 : texto.split('\n').length), [modo, texto]);

  const documentoAvaliado = modo === 'visual' ? documento : documentoDaPrevia;
  const avaliacao = useMemo(() => (modelo ? avaliarModelo(documentoAvaliado, modelo) : null), [documentoAvaliado, modelo]);
  const folhasTravadas = useMemo(() => (modelo ? secoesTravadas(documento, modelo) : undefined), [documento, modelo]);
  const codigoSomenteLeitura = somenteLeitura || Boolean(modelo);
  const explicacao = modelo && avaliacao ? <XExplicacaoDoModelo modelo={modelo} avaliacao={avaliacao} /> : null;
  const pendencias = avaliacao ? [...avaliacao.faltantes.map((pS) => `"${pS.titulo}" falta`), ...avaliacao.vazias.map((pS) => `"${pS.titulo}" sem texto`), ...avaliacao.foraDeOrdem.map((pS) => `"${pS.titulo}" fora da ordem`)] : [];

  const estilo = altura === 'preencher' ? undefined : { height: altura };

  return (
    <div className={`adc-editor ${className}`.trim()} style={estilo} aria-label={rotuloAcessivel}>
      <XBarraDoEditor
        modo={modo}
        aoMudarModo={mudarModo}
        podeDesfazer={modo === 'visual' && historico.current.podeDesfazer}
        podeRefazer={modo === 'visual' && historico.current.podeRefazer}
        aoDesfazer={desfazer}
        aoRefazer={refazer}
        estado={estadoDaBarra}
        aoComando={executar}
        somenteLeitura={somenteLeitura}
        estruturaAberta={estruturaAberta}
        aoAlternarEstrutura={() => setEstruturaAberta((pA) => !pA)}
        formatacaoAtiva={modo === 'visual' && selecao !== null}
      />
      <div ref={corpo} className={`adc-editor-corpo${arrastando ? ' adc-editor-corpo-arrastando' : ''}`}>
        {estruturaAberta && (
          <nav className="adc-estrutura" aria-label="Estrutura do documento">
            <div className="adc-estrutura-titulo">Estrutura</div>
            {titulos.length === 0 && <div className="adc-estrutura-vazia">O documento ainda não tem títulos de seção.</div>}
            {titulos.map((pTitulo) => (
              <button key={pTitulo.id} type="button" className="adc-estrutura-item" style={{ paddingLeft: `${0.75 + (pTitulo.nivel - 1) * 0.75}rem` }} onClick={() => irParaTitulo(pTitulo)}>
                {pTitulo.texto}
              </button>
            ))}
          </nav>
        )}
        {(modo === 'codigo' || modo === 'dividido') && (
          <div className="adc-editor-painel" style={modo === 'dividido' ? { flex: `0 0 calc(${(proporcao * 100).toFixed(2)}% - ${estruturaAberta ? LARGURA_DA_ESTRUTURA * proporcao : 0}px)` } : undefined}>
            {modo === 'codigo' && explicacao && <div className="adc-modelo-no-codigo">{explicacao}</div>}
            <XEditorDeCodigo
              valor={texto}
              aoMudar={aoMudarTexto}
              linguagem="asciidoc"
              somenteLeitura={codigoSomenteLeitura}
              altura="preencher"
              rotuloAcessivel="Código AsciiDoc do documento"
              aoMoverCursor={setCursorNoCodigo}
              pedidoDeBusca={pedidoDeBusca}
              irParaLinha={irParaLinha}
              className="adc-editor-codigo"
            />
          </div>
        )}
        {modo === 'dividido' && (
          <div
            className="adc-divisor"
            role="separator"
            aria-orientation="vertical"
            aria-label="Divisor entre o código e a prévia"
            aria-valuemin={Math.round(PROPORCAO_MINIMA * 100)}
            aria-valuemax={Math.round((1 - PROPORCAO_MINIMA) * 100)}
            aria-valuenow={Math.round(proporcao * 100)}
            tabIndex={0}
            title="Arraste para redistribuir; duplo clique volta ao meio; setas ajustam"
            onPointerDown={iniciarArrasto}
            onDoubleClick={() => definirProporcao(0.5)}
            onKeyDown={(pE) => {
              if (pE.key === 'ArrowLeft')
                definirProporcao(proporcao - PASSO_DO_TECLADO);
              else if (pE.key === 'ArrowRight')
                definirProporcao(proporcao + PASSO_DO_TECLADO);
              else if (pE.key === 'Home')
                definirProporcao(PROPORCAO_MINIMA);
              else if (pE.key === 'End')
                definirProporcao(1 - PROPORCAO_MINIMA);
              else
                return;
              pE.preventDefault();
            }}
          >
            <span className="adc-divisor-alca" aria-hidden="true" />
          </div>
        )}
        {(modo === 'visual' || modo === 'dividido') && (
          <div className="adc-editor-painel">
            <div className="adc-rolagem">
              {explicacao && <div className="adc-modelo-no-documento">{explicacao}</div>}
              {modo === 'visual' ? (
                <XVistaWYSIWYG
                  documento={documento}
                  selecao={selecao}
                  somenteLeitura={somenteLeitura}
                  marcasPendentes={marcasPendentes}
                  aoAplicar={aplicar}
                  aoMudarSelecao={(pSel) => {
                    setSelecao(pSel);
                    setMarcasPendentes(null);
                  }}
                  aoDesfazer={desfazer}
                  aoRefazer={refazer}
                  aoAlternarMarca={alternarMarcaNaSelecao}
                  aoPedirDialogo={setDialogo}
                  blocoSelecionado={blocoSelecionado}
                  aoSelecionarBloco={setBlocoSelecionado}
                  folhasTravadas={folhasTravadas}
                />
              ) : (
                <XVistaWYSIWYG
                  documento={documentoDaPrevia}
                  selecao={null}
                  somenteLeitura
                  marcasPendentes={null}
                  aoAplicar={() => undefined}
                  aoMudarSelecao={() => undefined}
                  aoDesfazer={() => undefined}
                  aoRefazer={() => undefined}
                  aoAlternarMarca={() => undefined}
                  aoPedirDialogo={() => undefined}
                  blocoSelecionado={null}
                  aoSelecionarBloco={() => undefined}
                />
              )}
            </div>
          </div>
        )}
        {dialogo && modo === 'visual' && (
          <XDialogoDoEditor
            pedido={dialogo}
            documento={documento}
            selecao={selecao}
            aoFechar={() => setDialogo(null)}
            aoAplicar={(pResultado) => aplicar(pResultado, null)}
          />
        )}
      </div>
      <div className="adc-status" role="status">
        <span>{modo === 'visual' ? 'Visual' : modo === 'codigo' ? 'Código' : 'Dividido'}</span>
        <span>{palavras} palavras</span>
        <span>{caracteres} caracteres</span>
        <span>{blocos} blocos</span>
        {modo !== 'visual' && (
          <span>
            Linha {cursorNoCodigo.linha}, coluna {cursorNoCodigo.coluna} de {linhas} linhas
          </span>
        )}
        {recusaDoModelo && (
          <span className="adc-status-recusa" role="alert">
            {recusaDoModelo}
          </span>
        )}
        {modelo && modo !== 'visual' && <span>Código somente leitura: documento com modelo se edita no modo Visual</span>}
        {modelo && avaliacao && !recusaDoModelo && (
          <span className={avaliacao.completo ? 'adc-status-ok' : 'adc-status-aviso'} title={pendencias.join('\n')}>
            {avaliacao.completo ? `Modelo ${modelo.rotulo}: completo` : `Modelo ${modelo.rotulo}: ${pendencias.length === 1 ? pendencias[0] : `${pendencias.length} pendências (${pendencias[0]}…)`}`}
          </span>
        )}
        {avisos.length > 0 && (
          <span className="adc-status-aviso" title={avisos.map((pA) => `Linha ${pA.linha}: ${pA.texto}`).join('\n')}>
            {avisos.length === 1 ? `Aviso na linha ${avisos[0].linha}: ${avisos[0].texto}` : `${avisos.length} avisos do parser — o primeiro, na linha ${avisos[0].linha}: ${avisos[0].texto}`}
          </span>
        )}
        {somenteLeitura && <span>Somente leitura</span>}
      </div>
    </div>
  );
}
