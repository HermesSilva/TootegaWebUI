/**
 * TRANSAÇÕES do editor AsciiDoc — a segunda metade: apagar para a frente e unir com o anterior em cada espécie de
 * folha, dividir item/termo/chamada/célula, limpar marcas, tipo de bloco, embrulhar em container, listas (estilo,
 * tarefas, recuo nos dois sentidos), tabela (linhas, colunas, alinhamento), inserção e colagem de blocos, e os
 * utilitários de percurso imutável (filhos de container, remoção de folha, bloco vazio garantido).
 */
import { describe, expect, it } from 'vitest';
import { analisarAsciiDoc, documentoVazio } from '@core/components/asciidoc/parser/blocos';
import { serializarDocumento } from '@core/components/asciidoc/serializador/serializar';
import { atomo, folhasDoDocumento, textoPuro } from '@core/components/asciidoc/modelo/documento';
import { posicao, selecaoColapsada, type Selecao } from '@core/components/asciidoc/editor/selecao';
import {
  alinharColunaDaTabela,
  alternarLista,
  alternarMarca,
  alternarTarefa,
  apagarIntervalo,
  apagarParaFrente,
  apagarParaTras,
  atualizarBloco,
  colarBlocos,
  definirTipoDeBloco,
  dividirBloco,
  elevarItemAParagrafo,
  embrulharEmContainer,
  garantirEditavel,
  inserirAtomo,
  inserirBlocosAntes,
  inserirBlocosApos,
  inserirBlocosNaSelecao,
  inserirColunaNaTabela,
  inserirLinhaNaTabela,
  inserirTexto,
  limparMarcas,
  mapearConteudoDaFolha,
  novaTabela,
  paragrafoVazio,
  recuarItem,
  removerBloco,
  removerColunaDaTabela,
  removerFolha,
  removerLinhaDaTabela,
  selecaoTemMarca,
  substituirConteudo,
} from '@core/components/asciidoc/editor/transacoes';
import type { Documento, Lista, Tabela } from '@core/components/asciidoc/modelo/tipos';

function doc(pTexto: string): Documento {
  return analisarAsciiDoc(pTexto).documento;
}

function folha(pDocumento: Documento, pIndice: number): string {
  return folhasDoDocumento(pDocumento)[pIndice].folha.id;
}

function ser(pDocumento: Documento): string {
  return serializarDocumento(pDocumento);
}

describe('apagar e unir', () => {
  it('apagar intervalo numa folha só; seleção para folha inexistente é devolvida como veio', () => {
    const d = doc('abcdef');
    const r = apagarIntervalo(d, { ancora: posicao(folha(d, 0), 1), foco: posicao(folha(d, 0), 4) });
    expect(ser(r.documento)).toBe('aef');
    const inexistente: Selecao = selecaoColapsada('nao-existe', 0);
    expect(apagarIntervalo(d, { ancora: inexistente.ancora, foco: posicao(folha(d, 0), 1) }).documento).toBe(d);
    expect(apagarParaTras(d, inexistente).documento).toBe(d);
    expect(apagarParaFrente(d, inexistente).documento).toBe(d);
  });

  it('Delete apaga o caractere à frente e, no fim da folha, puxa a folha seguinte', () => {
    const d = doc('ab\n\ncd');
    expect(ser(apagarParaFrente(d, selecaoColapsada(folha(d, 0), 0)).documento)).toBe('b\n\ncd');
    expect(ser(apagarParaFrente(d, selecaoColapsada(folha(d, 0), 2)).documento)).toBe('abcd');
    // No fim do documento não há o que puxar.
    expect(apagarParaFrente(d, selecaoColapsada(folha(d, 1), 2)).documento).toBe(d);
    // Célula não se funde com a vizinha.
    const t = doc('|===\n|a |b\n|===');
    expect(apagarParaFrente(t, selecaoColapsada(folha(t, 0), 1)).documento).toBe(t);
  });

  it('Backspace no início: título vira parágrafo; item aninhado avança; item de primeiro nível vira parágrafo', () => {
    const titulo = doc('== Título');
    const r = apagarParaTras(titulo, selecaoColapsada(folha(titulo, 0), 0));
    expect(r.documento.blocos[0].tipo).toBe('paragrafo');
    expect(ser(r.documento)).toBe('Título');

    const aninhada = doc('* a\n** b');
    const avancado = apagarParaTras(aninhada, selecaoColapsada(folha(aninhada, 1), 0));
    expect(ser(avancado.documento)).toBe('* a\n* b');

    const simples = doc('* a\n* b');
    const elevado = apagarParaTras(simples, selecaoColapsada(folha(simples, 1), 0));
    expect(ser(elevado.documento)).toBe('* a\n\nb');
  });

  it('Backspace no início de termo ou chamada vazios os remove; de termo com texto só move o cursor; célula nunca some', () => {
    // O AsciiDoc não escreve um termo vazio: ele nasce de uma transação (Enter numa descrição), então se monta à mão.
    const d: Documento = { blocos: [{ id: 'p', tipo: 'paragrafo', conteudo: [{ tipo: 'texto', texto: 'x', marcas: [] }] }, { id: 'd', tipo: 'descricao', itens: [{ id: 't', conteudo: [], filhos: [] }] }] };
    const removido = apagarParaTras(d, selecaoColapsada('t', 0));
    expect(removido.documento.blocos.map((pB) => pB.tipo)).toEqual(['paragrafo']);
    expect(removido.selecao).toEqual(selecaoColapsada('p', 1));

    const chamada = doc('<1> ');
    const semChamada = apagarParaTras(chamada, selecaoColapsada(folha(chamada, 0), 0));
    expect(semChamada.documento.blocos[0].tipo).toBe('paragrafo');
    expect(semChamada.selecao).toBeNull();

    const comTexto = doc('p\n\na:: x');
    const termo = folhasDoDocumento(comTexto).find((pF) => pF.especie === 'termo')!;
    const movido = apagarParaTras(comTexto, selecaoColapsada(termo.folha.id, 0));
    expect(movido.documento).toBe(comTexto);
    expect(movido.selecao?.ancora.folha).toBe(folha(comTexto, 0));

    const tabela = doc('|===\n|a |b\n|===');
    const celula = apagarParaTras(tabela, selecaoColapsada(folha(tabela, 1), 0));
    expect(celula.documento).toBe(tabela);
    expect(celula.selecao?.ancora.folha).toBe(folha(tabela, 0));
  });

  it('Backspace no primeiro parágrafo de um container tira o parágrafo do container', () => {
    const d = doc('====\num\n\ndois\n====');
    const r = apagarParaTras(d, selecaoColapsada(folha(d, 0), 0));
    expect(r.documento.blocos[0].tipo).toBe('paragrafo');
    expect(r.documento.blocos[1].tipo).toBe('container');
    expect(ser(r.documento)).toBe('um\n\n====\ndois\n====');
    // Container com um filho só: o container some.
    const unico = doc('====\num\n====');
    expect(ser(apagarParaTras(unico, selecaoColapsada(folha(unico, 0), 0)).documento)).toBe('um');
    // Primeiro parágrafo do documento: nada muda.
    const primeiro = doc('um');
    expect(apagarParaTras(primeiro, selecaoColapsada(folha(primeiro, 0), 0)).documento).toBe(primeiro);
  });

  it('Backspace no início de parágrafo depois de célula/termo só move o cursor para o fim da anterior', () => {
    const d = doc('|===\n|a\n|===\n\npar');
    const par = folhasDoDocumento(d).find((pF) => pF.especie === 'paragrafo')!;
    const r = apagarParaTras(d, selecaoColapsada(par.folha.id, 0));
    expect(r.documento).toBe(d);
    expect(r.selecao).toEqual(selecaoColapsada(folha(d, 0), 1));
  });

  it('apagar intervalo que atravessa célula só apara as pontas, sem fundir', () => {
    const d = doc('|===\n|abc |def\n|===');
    const r = apagarIntervalo(d, { ancora: posicao(folha(d, 0), 1), foco: posicao(folha(d, 1), 1) });
    const tabela = r.documento.blocos[0] as Tabela;
    expect(textoPuro(tabela.linhas[0].celulas[0].conteudo)).toBe('a');
    expect(textoPuro(tabela.linhas[0].celulas[1].conteudo)).toBe('ef');
  });
});

describe('dividir (Enter)', () => {
  it('item vazio aninhado avança; item de tarefa novo nasce desmarcado', () => {
    const aninhada = doc('* a\n** ');
    const r = dividirBloco(aninhada, selecaoColapsada(folha(aninhada, 1), 0));
    expect(ser(r.documento)).toBe('* a\n* ');

    const tarefas = doc('* [x] feito');
    const novo = dividirBloco(tarefas, selecaoColapsada(folha(tarefas, 0), 5));
    const lista = novo.documento.blocos[0] as Lista;
    expect(lista.itens[1].marcado).toBe(false);
    expect(ser(novo.documento)).toBe('* [x] feito\n* [ ] ');
  });

  it('Enter no termo vai para a descrição existente ou cria o parágrafo dela', () => {
    const comDescricao = doc('termo:: texto');
    const termo = folhasDoDocumento(comDescricao)[0];
    const r = dividirBloco(comDescricao, selecaoColapsada(termo.folha.id, 5));
    expect(r.documento).toBe(comDescricao);
    expect(r.selecao?.ancora.folha).toBe(folha(comDescricao, 1));

    const semDescricao = doc('termo::');
    const criado = dividirBloco(semDescricao, selecaoColapsada(folha(semDescricao, 0), 5));
    expect(folhasDoDocumento(criado.documento)).toHaveLength(2);
    expect(criado.selecao?.ancora.folha).toBe(folha(criado.documento, 1));
  });

  it('Enter numa chamada cria a chamada seguinte numerada; numa célula insere quebra de linha', () => {
    const d = doc('<1> um dois');
    const r = dividirBloco(d, selecaoColapsada(folha(d, 0), 3));
    expect(ser(r.documento)).toBe('<1> um \n<2> dois');

    const t = doc('|===\n|ab\n|===');
    const q = dividirBloco(t, selecaoColapsada(folha(t, 0), 1));
    expect(ser(q.documento)).toContain('a +');
  });

  it('seleção inválida devolve o documento intacto', () => {
    const d = doc('x');
    expect(dividirBloco(d, selecaoColapsada('nao', 0)).documento).toBe(d);
  });
});

describe('marcas', () => {
  it('limpar marcas tira tudo do trecho e mantém o resto; a seleção só com átomo não tem marca', () => {
    const d = doc('*a* _b_ c');
    const limpo = limparMarcas(d, { ancora: posicao(folha(d, 0), 0), foco: posicao(folha(d, 0), 3) });
    expect(ser(limpo.documento)).toBe('a b c');
    const atomico = doc('x kbd:[A] y');
    expect(selecaoTemMarca(atomico, { ancora: posicao(folha(atomico, 0), 2), foco: posicao(folha(atomico, 0), 3) }, 'negrito')).toBe(false);
    expect(selecaoTemMarca(atomico, selecaoColapsada('nao', 0), 'negrito')).toBe(false);
  });

  it('alternar marca com seleção colapsada numa das folhas não toca essa folha; forçar aplica o estado pedido', () => {
    const d = doc('ab\n\ncd');
    const r = alternarMarca(d, { ancora: posicao(folha(d, 0), 2), foco: posicao(folha(d, 1), 1) }, { tipo: 'italico' });
    // Colado ao `d`, o par constrained não valeria: sai unconstrained.
    expect(ser(r.documento)).toBe('ab\n\n__c__d');
    const link = alternarMarca(d, { ancora: posicao(folha(d, 0), 0), foco: posicao(folha(d, 0), 2) }, { tipo: 'link', valor: 'https://x.org' }, true);
    expect(ser(link.documento)).toBe('https://x.org[ab]\n\ncd');
  });

  it('inserir átomo e substituir o conteúdo da folha', () => {
    const d = doc('ab');
    const r = inserirAtomo(d, selecaoColapsada(folha(d, 0), 1), atomo('tecla', { texto: 'Ctrl' }));
    expect(ser(r.documento)).toBe('akbd:[Ctrl]b');
    expect(r.selecao?.ancora.deslocamento).toBe(2);
    const s = substituirConteudo(d, folha(d, 0), [{ tipo: 'texto', texto: 'novo', marcas: [] }], 99);
    expect(ser(s.documento)).toBe('novo');
    expect(s.selecao?.ancora.deslocamento).toBe(4);
    expect(inserirAtomo(d, selecaoColapsada('nao', 0), atomo('tecla')).documento).toBe(d);
  });
});

describe('tipo de bloco e containers', () => {
  it('parágrafo vira título, literal, citação, código e volta a parágrafo', () => {
    const d = doc('texto');
    const sel = selecaoColapsada(folha(d, 0), 2);
    expect(ser(definirTipoDeBloco(d, sel, 'titulo2').documento)).toBe('=== texto');
    expect(ser(definirTipoDeBloco(d, sel, 'literal').documento)).toBe('[literal]\ntexto');
    expect(ser(definirTipoDeBloco(d, sel, 'citacao').documento)).toBe('[quote]\n____\ntexto\n____');
    const codigo = definirTipoDeBloco(d, sel, 'codigo');
    expect(ser(codigo.documento)).toBe('[source]\n----\ntexto\n----');
    expect(codigo.selecao).toBeNull();
    const titulo = doc('== t');
    expect(ser(definirTipoDeBloco(titulo, selecaoColapsada(folha(titulo, 0), 0), 'paragrafo').documento)).toBe('t');
  });

  it('item vira parágrafo antes de mudar de tipo; célula não muda de tipo; seleção inválida não muda nada', () => {
    const lista = doc('* a\n* b');
    const r = definirTipoDeBloco(lista, selecaoColapsada(folha(lista, 1), 0), 'titulo1');
    expect(ser(r.documento)).toBe('* a\n\n== b');
    const tabela = doc('|===\n|a\n|===');
    expect(definirTipoDeBloco(tabela, selecaoColapsada(folha(tabela, 0), 0), 'titulo1').documento).toBe(tabela);
    expect(definirTipoDeBloco(tabela, selecaoColapsada('nao', 0), 'titulo1').documento).toBe(tabela);
  });

  it('código preserva quebra de linha forçada e embrulhar cria admonição ou container', () => {
    const d = doc('a +\nb');
    const codigo = definirTipoDeBloco(d, selecaoColapsada(folha(d, 0), 0), 'codigo');
    expect(ser(codigo.documento)).toBe('[source]\n----\na\nb\n----');
    const nota = embrulharEmContainer(d, selecaoColapsada(folha(d, 0), 0), { tipo: 'admonicao', especie: 'NOTE' });
    expect(ser(nota.documento)).toBe('NOTE: a +\nb');
    const exemplo = embrulharEmContainer(d, selecaoColapsada(folha(d, 0), 0), { tipo: 'container', especie: 'exemplo' });
    expect(ser(exemplo.documento)).toBe('====\na +\nb\n====');
    expect(embrulharEmContainer(d, selecaoColapsada('nao', 0), { tipo: 'container', especie: 'exemplo' }).documento).toBe(d);
  });
});

describe('listas', () => {
  it('alternar lista: mesmo estilo volta a parágrafo; outro estilo muda a lista; tarefas marcam falso', () => {
    const d = doc('* a\n* b');
    const volta = alternarLista(d, selecaoColapsada(folha(d, 0), 0), 'marcadores');
    expect(ser(volta.documento)).toBe('a\n\n* b');
    const numerada = alternarLista(d, selecaoColapsada(folha(d, 0), 0), 'numerada');
    expect(ser(numerada.documento)).toBe('. a\n. b');
    const tarefas = alternarLista(d, selecaoColapsada(folha(d, 0), 0), 'tarefas');
    expect(ser(tarefas.documento)).toBe('* [ ] a\n* [ ] b');
    const titulo = doc('== t');
    expect(ser(alternarLista(titulo, selecaoColapsada(folha(titulo, 0), 0), 'tarefas').documento)).toBe('* [ ] t');
    const tabela = doc('|===\n|a\n|===');
    expect(alternarLista(tabela, selecaoColapsada(folha(tabela, 0), 0), 'marcadores').documento).toBe(tabela);
    expect(alternarLista(tabela, selecaoColapsada('nao', 0), 'marcadores').documento).toBe(tabela);
  });

  it('listas vizinhas se fundem também dentro de containers e de itens', () => {
    const d = doc('====\n* a\n\npar\n====');
    const par = folhasDoDocumento(d).find((pF) => pF.especie === 'paragrafo')!;
    const r = alternarLista(d, selecaoColapsada(par.folha.id, 0), 'marcadores');
    expect(ser(r.documento)).toBe('====\n* a\n* par\n====');
    const aninhado = doc('* a\n+\n* b\n+\npar');
    const item = folhasDoDocumento(aninhado).find((pF) => pF.especie === 'paragrafo')!;
    const fundido = alternarLista(aninhado, selecaoColapsada(item.folha.id, 0), 'marcadores');
    expect(ser(fundido.documento)).not.toContain('\n\n');
  });

  it('elevar item do meio parte a lista em duas; recuar o primeiro ou avançar sem mãe não muda nada', () => {
    const d = doc('* a\n* b\n* c');
    const meio = elevarItemAParagrafo(d, folhasDoDocumento(d)[1]);
    expect(ser(meio.documento)).toBe('* a\n\nb\n\n* c');
    expect(recuarItem(d, folhasDoDocumento(d)[0], 1).documento).toBe(d);
    expect(recuarItem(d, folhasDoDocumento(d)[0], -1).documento).toBe(d);
    const par = doc('p');
    expect(recuarItem(par, folhasDoDocumento(par)[0], 1).documento).toBe(par);
  });

  it('recuar funde com a sublista existente; avançar leva os irmãos seguintes como filhos', () => {
    const d = doc('* a\n** a1\n* b');
    const recuado = recuarItem(d, folhasDoDocumento(d)[2], 1);
    expect(ser(recuado.documento)).toBe('* a\n** a1\n** b');
    const aninhada = doc('* a\n** x\n** y\n** z');
    const avancado = recuarItem(aninhada, folhasDoDocumento(aninhada)[2], -1);
    expect(ser(avancado.documento)).toBe('* a\n** x\n* y\n** z');
  });

  it('alternar tarefa inverte a marca do item e não toca outras listas', () => {
    const d = doc('* [ ] a\n* [x] b');
    const lista = d.blocos[0] as Lista;
    const r = alternarTarefa(d, lista.itens[0].id);
    expect(ser(r)).toBe('* [x] a\n* [x] b');
    expect(alternarTarefa(d, 'nao')).toBe(d);
  });
});

describe('tabela', () => {
  it('nova tabela, linhas e colunas', () => {
    const tabela = novaTabela(2, 3, true);
    expect(tabela.linhas).toHaveLength(2);
    expect(tabela.numeroDeColunas).toBe(3);
    const d: Documento = { blocos: [tabela] };
    const maisColuna = inserirColunaNaTabela(d, tabela.id, 1).documento.blocos[0] as Tabela;
    expect(maisColuna.numeroDeColunas).toBe(4);
    expect(maisColuna.linhas[0].celulas).toHaveLength(4);
    const menosColuna = removerColunaDaTabela(d, tabela.id, 0).documento.blocos[0] as Tabela;
    expect(menosColuna.numeroDeColunas).toBe(2);
    const menosLinha = removerLinhaDaTabela(d, tabela.id, 0).documento.blocos[0] as Tabela;
    expect(menosLinha.linhas).toHaveLength(1);
    // Fora dos limites, a linha nova vai para o fim.
    expect((inserirLinhaNaTabela(d, tabela.id, 99).documento.blocos[0] as Tabela).linhas).toHaveLength(3);
  });

  it('remover a última linha ou a última coluna remove a tabela, e o documento continua editável', () => {
    const d: Documento = { blocos: [novaTabela(1, 1, false)] };
    const semLinha = removerLinhaDaTabela(d, d.blocos[0].id, 0).documento;
    expect(semLinha.blocos[0].tipo).toBe('paragrafo');
    const semColuna = removerColunaDaTabela(d, d.blocos[0].id, 0).documento;
    expect(semColuna.blocos[0].tipo).toBe('paragrafo');
  });

  it('alinhar a coluna inteira e voltar ao padrão', () => {
    const d = doc('|===\n|a |b\n|c |d\n|===');
    const id = d.blocos[0].id;
    const centrado = alinharColunaDaTabela(d, id, 1, 'centro').blocos[0] as Tabela;
    expect(centrado.linhas.map((pL) => pL.celulas[1].alinhamento)).toEqual(['centro', 'centro']);
    expect(centrado.linhas[0].celulas[0].alinhamento).toBeUndefined();
    const padrao = alinharColunaDaTabela({ blocos: [centrado] }, id, 1, undefined).blocos[0] as Tabela;
    expect(padrao.linhas[0].celulas[1].alinhamento).toBeUndefined();
    expect(ser({ blocos: [centrado] })).toContain('^|');
  });
});

describe('inserção e colagem de blocos', () => {
  it('parágrafo vazio é substituído; parágrafo com texto empurra; sem folha vai para o fim', () => {
    const vazio = documentoVazio();
    const r = inserirBlocosNaSelecao(vazio, selecaoColapsada(folha(vazio, 0), 0), [{ id: 'q', tipo: 'quebraTematica' }, paragrafoVazio()]);
    expect(r.documento.blocos[0].tipo).toBe('quebraTematica');
    expect(r.selecao?.ancora.folha).toBe(r.documento.blocos[1].id);

    const cheio = doc('texto');
    const s = inserirBlocosNaSelecao(cheio, selecaoColapsada(folha(cheio, 0), 0), [{ id: 's', tipo: 'sumario' }]);
    expect(s.documento.blocos.map((pB) => pB.tipo)).toEqual(['paragrafo', 'sumario']);
    expect(s.selecao).toEqual(selecaoColapsada(folha(cheio, 0), 0));

    const semFolha = inserirBlocosNaSelecao(cheio, selecaoColapsada('nao', 0), [{ id: 'x', tipo: 'quebraDePagina' }]);
    expect(semFolha.documento.blocos[1].tipo).toBe('quebraDePagina');
  });

  it('colar um parágrafo entra inline; colar vários blocos parte a folha e entra no meio', () => {
    const d = doc('ab');
    const um = colarBlocos(d, selecaoColapsada(folha(d, 0), 1), doc('*x*').blocos);
    expect(ser(um.documento)).toBe('a**x**b');
    expect(um.selecao?.ancora.deslocamento).toBe(2);
    const varios = colarBlocos(d, selecaoColapsada(folha(d, 0), 1), doc('== T\n\np').blocos);
    expect(ser(varios.documento)).toBe('a\n\n== T\n\np\n\nb');
    expect(colarBlocos(d, selecaoColapsada('nao', 0), doc('x\n\ny').blocos).documento).toBe(d);
  });

  it('inserir antes/depois, atualizar e remover bloco; remover a última folha deixa um parágrafo', () => {
    const d = doc('a\n\nb');
    const [a, b] = d.blocos;
    expect(ser(inserirBlocosAntes(d, b.id, [{ id: 'q', tipo: 'quebraTematica' }]))).toBe("a\n\n'''\n\nb");
    expect(ser(inserirBlocosApos(d, a.id, [{ id: 'q', tipo: 'quebraTematica' }]))).toBe("a\n\n'''\n\nb");
    expect(ser(atualizarBloco(d, a.id, { titulo: 'T' }))).toBe('.T\na\n\nb');
    const so = doc('a');
    const vazio = removerBloco(so, so.blocos[0].id);
    expect(vazio.blocos).toHaveLength(1);
    expect(vazio.blocos[0].tipo).toBe('paragrafo');
  });
});

describe('percurso imutável', () => {
  it('editar folha dentro de container, item, chamada e célula devolve blocos novos só no caminho', () => {
    const d = doc('====\num\n====\n\n* item\n\n<1> chamada\n\n|===\n|cel\n|===');
    const folhas = folhasDoDocumento(d);
    for (const f of folhas) {
      const novo = mapearConteudoDaFolha(d, f.folha.id, (pC) => [...pC, { tipo: 'texto', texto: '!', marcas: [] }]);
      expect(novo).not.toBe(d);
      expect(textoPuro(folhasDoDocumento(novo).find((pF) => pF.folha.id === f.folha.id)!.folha.conteudo)).toMatch(/!$/);
      // Os blocos fora do caminho são os MESMOS objetos.
      const indice = d.blocos.findIndex((pB) => pB.id === f.cadeia[0].id);
      d.blocos.forEach((pB, pI) => {
        if (pI !== indice)
          expect(novo.blocos[pI]).toBe(pB);
      });
    }
    expect(mapearConteudoDaFolha(d, 'nao', (pC) => pC)).toBe(d);
  });

  it('remover folha: item sai da lista (lista vazia some), célula só esvazia, bloco some', () => {
    const d = doc('* a\n\n|===\n|cel\n|===\n\npar');
    const folhas = folhasDoDocumento(d);
    const semItem = removerFolha(d, folhas[0].folha.id);
    expect(semItem.blocos.map((pB) => pB.tipo)).toEqual(['tabela', 'paragrafo']);
    const celulaVazia = removerFolha(d, folhas[1].folha.id).blocos[1] as Tabela;
    expect(textoPuro(celulaVazia.linhas[0].celulas[0].conteudo)).toBe('');
    const semPar = removerFolha(d, folhas[2].folha.id);
    expect(semPar.blocos).toHaveLength(2);
    expect(removerFolha(d, 'nao')).toBe(d);
  });

  it('garantir editável repõe parágrafo em container vazio e apaga lista sem itens', () => {
    const d: Documento = {
      blocos: [
        { id: 'c', tipo: 'container', especie: 'exemplo', filhos: [] },
        { id: 'l', tipo: 'lista', estilo: 'marcadores', itens: [] },
      ],
    };
    const r = garantirEditavel(d);
    expect(r.blocos).toHaveLength(1);
    const container = r.blocos[0];
    expect(container.tipo === 'container' && container.filhos[0].tipo).toBe('paragrafo');
    const intacto = doc('x');
    expect(garantirEditavel(intacto)).toBe(intacto);
  });

  it('inserir texto herda as marcas, menos o link no fim dele', () => {
    const d = doc('https://x.org[ab] c');
    const dentro = inserirTexto(d, selecaoColapsada(folha(d, 0), 1), 'X');
    expect(ser(dentro.documento)).toBe('https://x.org[aXb] c');
    // No meio da folha o link ainda vale; só no FIM dela o texto novo sai do link.
    const meio = inserirTexto(d, selecaoColapsada(folha(d, 0), 2), 'X');
    expect(ser(meio.documento)).toBe('https://x.org[abX] c');
    const soLink = doc('https://x.org[ab]');
    const fim = inserirTexto(soLink, selecaoColapsada(folha(soLink, 0), 2), 'X');
    expect(ser(fim.documento)).toBe('https://x.org[ab]X');
    expect(inserirTexto(d, selecaoColapsada('nao', 0), 'X').documento).toBe(d);
  });
});
