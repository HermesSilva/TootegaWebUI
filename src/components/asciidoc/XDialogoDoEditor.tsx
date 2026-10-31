/**
 * XDialogoDoEditor — os diálogos do editor (link, imagem, tabela, referência, nota de rodapé, atributo, tecla,
 * âncora). Todos CONTIDOS na área do editor (`XModalShell` inline — skill tootega-front §1); nenhum cobre a página.
 * Validação completa: cada campo recusado mostra o motivo embaixo, de uma vez. Textos do catálogo (`useTextos`).
 */

import { useMemo, useState, type FormEvent, type JSX } from 'react';
import { XModalShell } from '../templates/XModalShell';
import { Button } from '../ui/Button';
import type { PedidoDeDialogo } from './wysiwyg/XVistaWYSIWYG';
import type { Bloco, Documento, Imagem, NotacaoDeFormula } from './modelo/tipos';
import { atomo, atributoDoCabecalho, encontrarBloco, fatiarInline, folhaPorID, notacaoEfetiva, novoID, textoPuro } from './modelo/documento';
import { XFormula } from './wysiwyg/XFormula';
import { ordenarSelecao, type Selecao } from './editor/selecao';
import { alternarMarca, atualizarBloco, inserirAtomo, inserirBlocosNaSelecao, inserirTexto, novaTabela, type Resultado } from './editor/transacoes';
import { useTextos } from './textos';

export interface XDialogoDoEditorProps {
  pedido: PedidoDeDialogo;
  documento: Documento;
  selecao: Selecao | null;
  aoFechar: () => void;
  aoAplicar: (pResultado: Resultado) => void;
  /**
   * Modo Código (2026-10-31): em vez de uma transação no modelo, o diálogo entrega a SINTAXE AsciiDoc do que foi
   * pedido; `pEmBloco` diz se o trecho ocupa linhas próprias (imagem, tabela, atributo) ou entra na linha.
   */
  aoInserirTexto?: (pTexto: string, pEmBloco: boolean) => void;
  /** Texto selecionado no código, para preencher o campo de texto do link/referência. */
  textoInicial?: string;
}

/** A sintaxe AsciiDoc de cada pedido, a partir dos campos do diálogo (modo Código). */
export function textoDoPedido(pTipo: PedidoDeDialogo['tipo'], pCampos: Record<string, string>): { texto: string; emBloco: boolean } {
  const c = (pNome: string): string => (pCampos[pNome] ?? '').trim();
  switch (pTipo) {
    case 'link': {
      const alvo = c('alvo');
      const texto = pCampos.texto ?? '';
      const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(alvo);
      if (comEsquema)
        return { texto: texto ? `${alvo}[${texto}]` : alvo, emBloco: false };
      return { texto: `link:${alvo}[${texto}]`, emBloco: false };
    }
    case 'imagem': {
      const partes = [c('alt'), c('largura'), c('altura')];
      while (partes.length > 0 && partes[partes.length - 1] === '')
        partes.pop();
      return { texto: `image::${c('alvo')}[${partes.join(',')}]`, emBloco: true };
    }
    case 'tabela': {
      const linhas = Math.max(1, Number(c('linhas')) || 1);
      const colunas = Math.max(1, Number(c('colunas')) || 1);
      const cabecalho = pCampos.cabecalho !== 'nao';
      const linha = (): string => Array.from({ length: colunas }, () => '| ').join('');
      const corpo: string[] = [];
      if (cabecalho) {
        corpo.push(linha().trimEnd(), '');
        for (let i = 1; i < linhas; i++)
          corpo.push(linha().trimEnd());
      } else
        for (let i = 0; i < linhas; i++)
          corpo.push(linha().trimEnd());
      return { texto: `|===\n${corpo.join('\n')}\n|===`, emBloco: true };
    }
    case 'referencia':
      return { texto: c('texto') ? `<<${c('id')},${c('texto')}>>` : `<<${c('id')}>>`, emBloco: false };
    case 'notaDeRodape':
      return { texto: `footnote:${c('id')}[${pCampos.texto ?? ''}]`, emBloco: false };
    case 'atributo':
      return { texto: `:${c('nome')}: ${pCampos.valor ?? ''}`.trimEnd(), emBloco: true };
    case 'tecla': {
      const especie = pCampos.especie === 'botao' ? 'btn' : pCampos.especie === 'menu' ? 'menu' : 'kbd';
      return { texto: especie === 'menu' ? `menu:${c('alvo')}[${c('texto')}]` : `${especie}:[${c('texto')}]`, emBloco: false };
    }
    case 'ancora':
      return { texto: c('texto') ? `[[${c('id')},${c('texto')}]]` : `[[${c('id')}]]`, emBloco: false };
    case 'formula': {
      const notacao = c('notacao') || 'stem';
      const texto = c('texto');
      if (pCampos.forma === 'bloco')
        return { texto: `[${notacao}]\n++++\n${texto}\n++++`, emBloco: true };
      return { texto: `${notacao}:[${texto}]`, emBloco: false };
    }
    default:
      return { texto: '', emBloco: false };
  }
}

function Campo({ rotulo, erro, children }: { rotulo: string; erro?: string; children: JSX.Element }): JSX.Element {
  return (
    <label className="adc-dialogo-campo">
      <span>{rotulo}</span>
      {children}
      {erro && <span className="adc-dialogo-erro">{erro}</span>}
    </label>
  );
}

/** Ids disponíveis para referência: âncoras de bloco e âncoras inline. */
function idsDoDocumento(pDocumento: Documento): string[] {
  const ids = new Set<string>();
  const visitar = (pBlocos: Bloco[]): void => {
    for (const bloco of pBlocos) {
      if (bloco.ancora)
        ids.add(bloco.ancora);
      if ('conteudo' in bloco)
        for (const parte of bloco.conteudo)
          if (parte.tipo === 'atomo' && parte.especie === 'ancora' && parte.dados.id)
            ids.add(parte.dados.id);
      if (bloco.tipo === 'lista' || bloco.tipo === 'descricao')
        for (const item of bloco.itens)
          visitar(item.filhos);
      if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
        visitar(bloco.filhos);
    }
  };
  visitar(pDocumento.blocos);
  return [...ids];
}

export function XDialogoDoEditor({ pedido, documento, selecao, aoFechar, aoAplicar, aoInserirTexto, textoInicial }: XDialogoDoEditorProps): JSX.Element {
  const t = useTextos().dialogo;
  const textoSelecionado = useMemo(() => {
    if (aoInserirTexto)
      return textoInicial ?? '';
    if (!selecao)
      return '';
    const { inicio, fim } = ordenarSelecao(documento, selecao);
    if (inicio.folha !== fim.folha)
      return '';
    const folha = folhaPorID(documento, inicio.folha);
    return folha ? textoPuro(fatiarInline(folha.folha.conteudo, inicio.deslocamento, fim.deslocamento)) : '';
  }, [documento, selecao]);

  const blocoEditado = pedido.blocoID ? encontrarBloco(documento.blocos, pedido.blocoID) : undefined;
  const imagemEditada = blocoEditado && blocoEditado.tipo === 'imagem' ? (blocoEditado as Imagem) : undefined;

  const [campos, setCampos] = useState<Record<string, string>>(() => ({
    alvo: imagemEditada?.alvo ?? '',
    texto: textoSelecionado,
    alt: imagemEditada?.alt ?? '',
    largura: imagemEditada?.largura ?? '',
    altura: imagemEditada?.altura ?? '',
    linhas: '3',
    colunas: '3',
    cabecalho: 'sim',
    id: '',
    nome: '',
    valor: '',
    especie: 'tecla',
    notacao: 'stem',
    forma: 'inline',
  }));
  const [erros, setErros] = useState<Record<string, string>>({});
  const campo = (pNome: string) => ({
    value: campos[pNome] ?? '',
    onChange: (pE: { target: { value: string } }) => setCampos((pC) => ({ ...pC, [pNome]: pE.target.value })),
  });

  const ids = useMemo(() => idsDoDocumento(documento), [documento]);
  const selecaoValida = selecao ?? null;

  const confirmar = (pEvento: FormEvent): void => {
    pEvento.preventDefault();
    const novosErros: Record<string, string> = {};
    const exigir = (pNome: string, pMensagem: string): void => {
      if ((campos[pNome] ?? '').trim() === '')
        novosErros[pNome] = pMensagem;
    };

    switch (pedido.tipo) {
      case 'link':
        exigir('alvo', t.erros.informeEndereco);
        break;
      case 'imagem':
        exigir('alvo', t.erros.informeImagem);
        if (campos.largura && !/^\d+%?$/.test(campos.largura))
          novosErros.largura = t.erros.larguraNumero;
        if (campos.altura && !/^\d+$/.test(campos.altura))
          novosErros.altura = t.erros.alturaNumero;
        break;
      case 'tabela':
        if (!/^\d+$/.test(campos.linhas) || Number(campos.linhas) < 1 || Number(campos.linhas) > 200)
          novosErros.linhas = t.erros.linhasEntre;
        if (!/^\d+$/.test(campos.colunas) || Number(campos.colunas) < 1 || Number(campos.colunas) > 30)
          novosErros.colunas = t.erros.colunasEntre;
        break;
      case 'referencia':
        exigir('id', t.erros.informeIdDestino);
        break;
      case 'notaDeRodape':
        exigir('texto', t.erros.escrevaNota);
        break;
      case 'atributo':
        exigir('nome', t.erros.informeNomeAtributo);
        if (campos.nome && !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(campos.nome))
          novosErros.nome = t.erros.nomeAtributoFormato;
        break;
      case 'tecla':
        exigir('texto', campos.especie === 'menu' ? t.erros.informeItensMenu : t.erros.informeTexto);
        if (campos.especie === 'menu')
          exigir('alvo', t.erros.informeMenuRaiz);
        break;
      case 'ancora':
        exigir('id', t.erros.informeIdAncora);
        if (campos.id && !/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(campos.id))
          novosErros.id = t.erros.idAncoraFormato;
        break;
      case 'formula':
        exigir('texto', t.erros.informeFormula);
        break;
      default:
        break;
    }
    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    if (aoInserirTexto) {
      const { texto, emBloco } = textoDoPedido(pedido.tipo, campos);
      aoInserirTexto(texto, emBloco);
      aoFechar();
      return;
    }

    let resultado: Resultado | null = null;
    switch (pedido.tipo) {
      case 'link': {
        if (!selecaoValida)
          break;
        const alvo = campos.alvo.trim();
        const texto = campos.texto;
        const { inicio, fim } = ordenarSelecao(documento, selecaoValida);
        const haSelecao = !(inicio.folha === fim.folha && inicio.deslocamento === fim.deslocamento);
        if (haSelecao && texto === textoSelecionado)
          resultado = alternarMarca(documento, selecaoValida, { tipo: 'link', valor: alvo }, true);
        else {
          const inserido = inserirTexto(documento, selecaoValida, texto || alvo, [{ tipo: 'link', valor: alvo }]);
          resultado = inserido;
        }
        break;
      }
      case 'imagem': {
        const bloco: Imagem = { id: imagemEditada?.id ?? novoID(), tipo: 'imagem', alvo: campos.alvo.trim() };
        if (campos.alt.trim())
          bloco.alt = campos.alt.trim();
        if (campos.largura)
          bloco.largura = campos.largura;
        if (campos.altura)
          bloco.altura = campos.altura;
        if (imagemEditada) {
          const { titulo, ancora, papeis, atributosBrutos, outrosAtributos } = imagemEditada;
          resultado = { documento: atualizarBloco(documento, imagemEditada.id, { ...bloco, titulo, ancora, papeis, atributosBrutos, outrosAtributos, largura: bloco.largura, altura: bloco.altura, alt: bloco.alt }), selecao };
        } else if (selecaoValida)
          resultado = inserirBlocosNaSelecao(documento, selecaoValida, [bloco]);
        break;
      }
      case 'tabela':
        if (selecaoValida)
          resultado = inserirBlocosNaSelecao(documento, selecaoValida, [novaTabela(Number(campos.linhas), Number(campos.colunas), campos.cabecalho === 'sim')]);
        break;
      case 'referencia':
        if (selecaoValida)
          resultado = inserirAtomo(documento, selecaoValida, atomo('referencia', campos.texto.trim() ? { alvo: campos.id.trim(), texto: campos.texto.trim() } : { alvo: campos.id.trim() }));
        break;
      case 'notaDeRodape':
        if (selecaoValida)
          resultado = inserirAtomo(documento, selecaoValida, atomo('notaDeRodape', campos.id.trim() ? { id: campos.id.trim(), texto: campos.texto } : { texto: campos.texto }));
        break;
      case 'atributo':
        if (selecaoValida)
          resultado = inserirBlocosNaSelecao(documento, selecaoValida, [{ id: novoID(), tipo: 'atributo', nome: campos.nome.trim(), valor: campos.valor }]);
        break;
      case 'tecla':
        if (selecaoValida) {
          const especie = campos.especie === 'botao' ? 'botao' : campos.especie === 'menu' ? 'menu' : 'tecla';
          resultado = inserirAtomo(documento, selecaoValida, atomo(especie, especie === 'menu' ? { alvo: campos.alvo.trim(), texto: campos.texto.trim() } : { texto: campos.texto.trim() }));
        }
        break;
      case 'ancora':
        if (selecaoValida)
          resultado = inserirAtomo(documento, selecaoValida, atomo('ancora', campos.texto.trim() ? { id: campos.id.trim(), texto: campos.texto.trim() } : { id: campos.id.trim() }));
        break;
      case 'formula':
        if (selecaoValida) {
          const notacao = (campos.notacao || 'stem') as NotacaoDeFormula;
          const texto = campos.texto.trim();
          resultado =
            campos.forma === 'bloco'
              ? inserirBlocosNaSelecao(documento, selecaoValida, [{ id: novoID(), tipo: 'formula', notacao, texto }])
              : inserirAtomo(documento, selecaoValida, atomo('formula', { notacao, texto }));
        }
        break;
      default:
        break;
    }
    if (resultado)
      aoAplicar(resultado);
    aoFechar();
  };

  const titulo: Record<PedidoDeDialogo['tipo'], string> = {
    link: t.titulos.link,
    imagem: imagemEditada ? t.titulos.editarImagem : t.titulos.imagem,
    tabela: t.titulos.tabela,
    referencia: t.titulos.referencia,
    notaDeRodape: t.titulos.notaDeRodape,
    atributo: t.titulos.atributo,
    tecla: t.titulos.tecla,
    ancora: t.titulos.ancora,
    formula: t.titulos.formula,
  };

  const semPosicao = !selecaoValida && !imagemEditada && !aoInserirTexto;
  const idDoFormulario = 'adc-dialogo-formulario';

  return (
    <XModalShell
      title={titulo[pedido.tipo]}
      closeLabel={t.cancelar}
      onClose={aoFechar}
      size="sm"
      footer={
        <div className="adc-dialogo-rodape">
          <Button type="button" variant="secondary" onClick={aoFechar}>
            {t.cancelar}
          </Button>
          <Button type="submit" form={idDoFormulario} disabled={semPosicao}>
            {pedido.tipo === 'imagem' && imagemEditada ? t.aplicar : t.inserir}
          </Button>
        </div>
      }
    >
      <form id={idDoFormulario} onSubmit={confirmar} className="adc-dialogo-campos">
        {semPosicao && <p className="adc-dialogo-erro">{t.semPosicao}</p>}
        {pedido.tipo === 'link' && (
          <>
            <Campo rotulo={t.endereco} erro={erros.alvo}>
              <input autoFocus placeholder={t.enderecoPlaceholder} {...campo('alvo')} />
            </Campo>
            <Campo rotulo={t.textoVazioUsaEndereco}>
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'imagem' && (
          <>
            <Campo rotulo={t.caminhoOuURL} erro={erros.alvo}>
              <input autoFocus placeholder={t.imagemPlaceholder} {...campo('alvo')} />
            </Campo>
            <Campo rotulo={t.textoAlternativo}>
              <input {...campo('alt')} />
            </Campo>
            <div className="adc-dialogo-linha">
              <Campo rotulo={t.largura} erro={erros.largura}>
                <input inputMode="numeric" placeholder={t.px} {...campo('largura')} />
              </Campo>
              <Campo rotulo={t.altura} erro={erros.altura}>
                <input inputMode="numeric" placeholder={t.px} {...campo('altura')} />
              </Campo>
            </div>
          </>
        )}
        {pedido.tipo === 'tabela' && (
          <>
            <div className="adc-dialogo-linha">
              <Campo rotulo={t.linhas} erro={erros.linhas}>
                <input autoFocus inputMode="numeric" {...campo('linhas')} />
              </Campo>
              <Campo rotulo={t.colunas} erro={erros.colunas}>
                <input inputMode="numeric" {...campo('colunas')} />
              </Campo>
            </div>
            <Campo rotulo={t.primeiraLinha}>
              <select {...campo('cabecalho')}>
                <option value="sim">{t.eCabecalho}</option>
                <option value="nao">{t.eDado}</option>
              </select>
            </Campo>
          </>
        )}
        {pedido.tipo === 'referencia' && (
          <>
            <Campo rotulo={t.idDoDestino} erro={erros.id}>
              <input autoFocus list="adc-ids" placeholder={t.idDoDestinoPlaceholder} {...campo('id')} />
            </Campo>
            <datalist id="adc-ids">
              {ids.map((pID) => (
                <option key={pID} value={pID} />
              ))}
            </datalist>
            <Campo rotulo={t.textoVazioUsaTitulo}>
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'notaDeRodape' && (
          <>
            <Campo rotulo={t.textoDaNota} erro={erros.texto}>
              <textarea autoFocus rows={3} {...campo('texto')} />
            </Campo>
            <Campo rotulo={t.idParaReutilizar}>
              <input {...campo('id')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'atributo' && (
          <>
            <Campo rotulo={t.nome} erro={erros.nome}>
              <input autoFocus placeholder={t.nomePlaceholder} {...campo('nome')} />
            </Campo>
            <Campo rotulo={t.valor}>
              <input {...campo('valor')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'tecla' && (
          <>
            <Campo rotulo={t.elemento}>
              <select autoFocus {...campo('especie')}>
                <option value="tecla">{t.teclaKbd}</option>
                <option value="botao">{t.botaoBtn}</option>
                <option value="menu">{t.menuMenu}</option>
              </select>
            </Campo>
            {campos.especie === 'menu' && (
              <Campo rotulo={t.menuRaiz} erro={erros.alvo}>
                <input placeholder={t.menuRaizPlaceholder} {...campo('alvo')} />
              </Campo>
            )}
            <Campo rotulo={campos.especie === 'menu' ? t.itensSepareCom : t.texto} erro={erros.texto}>
              <input placeholder={campos.especie === 'menu' ? t.menuPlaceholder : campos.especie === 'botao' ? t.botaoPlaceholder : t.teclaPlaceholder} {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'ancora' && (
          <>
            <Campo rotulo={t.id} erro={erros.id}>
              <input autoFocus placeholder={t.ancoraPlaceholder} {...campo('id')} />
            </Campo>
            <Campo rotulo={t.rotuloOpcional}>
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'formula' && (
          <>
            <Campo rotulo={t.notacao}>
              <select autoFocus {...campo('notacao')}>
                <option value="stem">{t.notacaoStem}</option>
                <option value="latexmath">{t.notacaoLatex}</option>
                <option value="asciimath">{t.notacaoAsciimath}</option>
              </select>
            </Campo>
            <Campo rotulo={t.fonteDaFormula} erro={erros.texto}>
              <textarea rows={3} placeholder={t.formulaPlaceholder} spellCheck={false} {...campo('texto')} />
            </Campo>
            <Campo rotulo={t.forma}>
              <select {...campo('forma')}>
                <option value="inline">{t.formaInline}</option>
                <option value="bloco">{t.formaBloco}</option>
              </select>
            </Campo>
            {campos.texto.trim() !== '' && (
              <div className="adc-dialogo-previa" aria-label={t.previa}>
                <XFormula fonte={campos.texto} notacao={notacaoEfetiva((campos.notacao || 'stem') as NotacaoDeFormula, atributoDoCabecalho(documento, 'stem'))} bloco={campos.forma === 'bloco'} />
              </div>
            )}
          </>
        )}
      </form>
    </XModalShell>
  );
}
