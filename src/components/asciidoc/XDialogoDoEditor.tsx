/**
 * XDialogoDoEditor — os diálogos do editor (link, imagem, tabela, referência, nota de rodapé, atributo, tecla,
 * âncora). Todos CONTIDOS na área do editor (`XModalShell` inline — skill tootega-front §1); nenhum cobre a página.
 * Validação completa: cada campo recusado mostra o motivo embaixo, de uma vez.
 */

import { useMemo, useState, type FormEvent, type JSX } from 'react';
import { XModalShell } from '../templates/XModalShell';
import { Button } from '../ui/Button';
import type { PedidoDeDialogo } from './wysiwyg/XVistaWYSIWYG';
import type { Bloco, Documento, Imagem } from './modelo/tipos';
import { atomo, encontrarBloco, fatiarInline, folhaPorID, novoID, textoPuro } from './modelo/documento';
import { ordenarSelecao, type Selecao } from './editor/selecao';
import { alternarMarca, atualizarBloco, inserirAtomo, inserirBlocosNaSelecao, inserirTexto, novaTabela, type Resultado } from './editor/transacoes';

export interface XDialogoDoEditorProps {
  pedido: PedidoDeDialogo;
  documento: Documento;
  selecao: Selecao | null;
  aoFechar: () => void;
  aoAplicar: (pResultado: Resultado) => void;
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

export function XDialogoDoEditor({ pedido, documento, selecao, aoFechar, aoAplicar }: XDialogoDoEditorProps): JSX.Element {
  const textoSelecionado = useMemo(() => {
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
        exigir('alvo', 'Informe o endereço do link (https://…, mailto:… ou um caminho).');
        break;
      case 'imagem':
        exigir('alvo', 'Informe o caminho ou a URL da imagem.');
        if (campos.largura && !/^\d+%?$/.test(campos.largura))
          novosErros.largura = 'A largura é um número de pixels (ou percentual).';
        if (campos.altura && !/^\d+$/.test(campos.altura))
          novosErros.altura = 'A altura é um número de pixels.';
        break;
      case 'tabela':
        if (!/^\d+$/.test(campos.linhas) || Number(campos.linhas) < 1 || Number(campos.linhas) > 200)
          novosErros.linhas = 'Entre 1 e 200 linhas.';
        if (!/^\d+$/.test(campos.colunas) || Number(campos.colunas) < 1 || Number(campos.colunas) > 30)
          novosErros.colunas = 'Entre 1 e 30 colunas.';
        break;
      case 'referencia':
        exigir('id', 'Informe o id do destino (uma âncora ou seção do documento).');
        break;
      case 'notaDeRodape':
        exigir('texto', 'Escreva o texto da nota.');
        break;
      case 'atributo':
        exigir('nome', 'Informe o nome do atributo.');
        if (campos.nome && !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(campos.nome))
          novosErros.nome = 'O nome usa letras, números, hífen e sublinhado, sem espaços.';
        break;
      case 'tecla':
        exigir('texto', campos.especie === 'menu' ? 'Informe os itens do menu (ex.: Salvar como).' : 'Informe o texto.');
        if (campos.especie === 'menu')
          exigir('alvo', 'Informe o menu raiz (ex.: Arquivo).');
        break;
      case 'ancora':
        exigir('id', 'Informe o id da âncora.');
        if (campos.id && !/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(campos.id))
          novosErros.id = 'O id começa com letra e usa letras, números, ponto, hífen e sublinhado.';
        break;
      default:
        break;
    }
    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
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
      default:
        break;
    }
    if (resultado)
      aoAplicar(resultado);
    aoFechar();
  };

  const titulo: Record<PedidoDeDialogo['tipo'], string> = {
    link: 'Link',
    imagem: imagemEditada ? 'Editar imagem' : 'Imagem',
    tabela: 'Nova tabela',
    referencia: 'Referência cruzada',
    notaDeRodape: 'Nota de rodapé',
    atributo: 'Atributo do documento',
    tecla: 'Tecla, botão ou menu',
    ancora: 'Âncora',
  };

  const semPosicao = !selecaoValida && !imagemEditada;
  const idDoFormulario = 'adc-dialogo-formulario';

  return (
    <XModalShell
      title={titulo[pedido.tipo]}
      closeLabel="Cancelar"
      onClose={aoFechar}
      size="sm"
      footer={
        <div className="adc-dialogo-rodape">
          <Button type="button" variant="secondary" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form={idDoFormulario} disabled={semPosicao}>
            {pedido.tipo === 'imagem' && imagemEditada ? 'Aplicar' : 'Inserir'}
          </Button>
        </div>
      }
    >
      <form id={idDoFormulario} onSubmit={confirmar} className="adc-dialogo-campos">
        {semPosicao && <p className="adc-dialogo-erro">Coloque o cursor no texto antes de inserir: o diálogo não sabe onde o elemento entra.</p>}
        {pedido.tipo === 'link' && (
          <>
            <Campo rotulo="Endereço" erro={erros.alvo}>
              <input autoFocus placeholder="https://… ou mailto:…" {...campo('alvo')} />
            </Campo>
            <Campo rotulo="Texto (vazio usa o endereço)">
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'imagem' && (
          <>
            <Campo rotulo="Caminho ou URL" erro={erros.alvo}>
              <input autoFocus placeholder="imagens/figura.png" {...campo('alvo')} />
            </Campo>
            <Campo rotulo="Texto alternativo (acessibilidade)">
              <input {...campo('alt')} />
            </Campo>
            <div className="adc-dialogo-linha">
              <Campo rotulo="Largura" erro={erros.largura}>
                <input inputMode="numeric" placeholder="px" {...campo('largura')} />
              </Campo>
              <Campo rotulo="Altura" erro={erros.altura}>
                <input inputMode="numeric" placeholder="px" {...campo('altura')} />
              </Campo>
            </div>
          </>
        )}
        {pedido.tipo === 'tabela' && (
          <>
            <div className="adc-dialogo-linha">
              <Campo rotulo="Linhas" erro={erros.linhas}>
                <input autoFocus inputMode="numeric" {...campo('linhas')} />
              </Campo>
              <Campo rotulo="Colunas" erro={erros.colunas}>
                <input inputMode="numeric" {...campo('colunas')} />
              </Campo>
            </div>
            <Campo rotulo="Primeira linha">
              <select {...campo('cabecalho')}>
                <option value="sim">É cabeçalho</option>
                <option value="nao">É dado</option>
              </select>
            </Campo>
          </>
        )}
        {pedido.tipo === 'referencia' && (
          <>
            <Campo rotulo="Id do destino" erro={erros.id}>
              <input autoFocus list="adc-ids" placeholder="secao-ou-ancora" {...campo('id')} />
            </Campo>
            <datalist id="adc-ids">
              {ids.map((pID) => (
                <option key={pID} value={pID} />
              ))}
            </datalist>
            <Campo rotulo="Texto (vazio usa o título do destino)">
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'notaDeRodape' && (
          <>
            <Campo rotulo="Texto da nota" erro={erros.texto}>
              <textarea autoFocus rows={3} {...campo('texto')} />
            </Campo>
            <Campo rotulo="Id (para reutilizar a nota)">
              <input {...campo('id')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'atributo' && (
          <>
            <Campo rotulo="Nome" erro={erros.nome}>
              <input autoFocus placeholder="versao" {...campo('nome')} />
            </Campo>
            <Campo rotulo="Valor">
              <input {...campo('valor')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'tecla' && (
          <>
            <Campo rotulo="Elemento">
              <select autoFocus {...campo('especie')}>
                <option value="tecla">Tecla (kbd)</option>
                <option value="botao">Botão (btn)</option>
                <option value="menu">Menu (menu)</option>
              </select>
            </Campo>
            {campos.especie === 'menu' && (
              <Campo rotulo="Menu raiz" erro={erros.alvo}>
                <input placeholder="Arquivo" {...campo('alvo')} />
              </Campo>
            )}
            <Campo rotulo={campos.especie === 'menu' ? 'Itens (separe com >)' : 'Texto'} erro={erros.texto}>
              <input placeholder={campos.especie === 'menu' ? 'Salvar como > PDF' : campos.especie === 'botao' ? 'OK' : 'Ctrl+S'} {...campo('texto')} />
            </Campo>
          </>
        )}
        {pedido.tipo === 'ancora' && (
          <>
            <Campo rotulo="Id" erro={erros.id}>
              <input autoFocus placeholder="minha-ancora" {...campo('id')} />
            </Campo>
            <Campo rotulo="Rótulo (opcional)">
              <input {...campo('texto')} />
            </Campo>
          </>
        )}
      </form>
    </XModalShell>
  );
}
