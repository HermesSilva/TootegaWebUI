/**
 * PARSER E SERIALIZADOR — os caminhos que o round-trip do documento de exemplo não exercita: cabeçalho sem título,
 * atributo multilinha, pendências órfãs, avisos de nível, parágrafo com estilo, tabelas CSV/DSV e escapadas,
 * descrição e sublistas de outro tipo, atributos com aspas e atalhos, inline (e-mail, âncora, passagem, macros) e
 * as escapadas do serializador.
 */
import { describe, expect, it } from 'vitest';
import { analisarAsciiDoc } from '@core/components/asciidoc/parser/blocos';
import { analisarInline } from '@core/components/asciidoc/parser/inline';
import { escreverAtributos, lerAtributos } from '@core/components/asciidoc/parser/atributos';
import { escaparTexto, serializarDocumento, serializarInline } from '@core/components/asciidoc/serializador/serializar';
import { textoPuro } from '@core/components/asciidoc/modelo/documento';
import { avaliarModelo, esqueletoDoModelo, garantirEspacoDasSecoes, secoesTravadas, violacaoDoModelo, type ModeloDeDocumento } from '@core/components/asciidoc/modelo/modeloDeDocumento';
import { MODELO_DECISAO, MODELO_INCIDENTE, MODELOS_DE_EXEMPLO } from '@core/components/asciidoc/exemplo/modelosDeExemplo';
import type { Bloco, Documento, Tabela } from '@core/components/asciidoc/modelo/tipos';

function doc(pTexto: string): Documento {
  return analisarAsciiDoc(pTexto).documento;
}

function tipos(pBlocos: Bloco[]): string[] {
  return pBlocos.map((pB) => pB.tipo);
}

function ida(pTexto: string): string {
  return serializarDocumento(doc(pTexto));
}

describe('cabeçalho do documento', () => {
  it('atributos e comentário antes do título entram no cabeçalho; atributos sem título também são cabeçalho', () => {
    const d = doc('// comentário\n:a: 1\n= Título\nAutor\n:b: dois \\\ncontinua\n// outro\n\ntexto');
    // A barra de continuação sai, o espaço antes dela fica: o valor é "dois \ncontinua".
    expect(d.cabecalho?.atributos).toEqual([
      { nome: 'a', valor: '1' },
      { nome: 'b', valor: 'dois \ncontinua' },
    ]);
    expect(d.cabecalho?.autores).toBe('Autor');
    expect(d.cabecalho?.revisao).toBeUndefined();
    expect(serializarDocumento(d)).toBe('= Título\nAutor\n:a: 1\n:b: dois  \\\ncontinua\n\ntexto');

    const semTitulo = doc(':toc:\n\ntexto');
    expect(semTitulo.cabecalho).toEqual({ atributos: [{ nome: 'toc', valor: '' }] });
    expect(serializarDocumento(semTitulo)).toBe(':toc:\n\ntexto');
    expect(doc('texto').cabecalho).toBeUndefined();
    expect(serializarDocumento({ cabecalho: { titulo: [{ tipo: 'texto', texto: 'T', marcas: [] }], atributos: [] }, blocos: [] })).toBe('= T');
  });
});

describe('blocos', () => {
  it('pendências órfãs (título, âncora, atributos sem bloco) viram bloco bruto e voltam intactas', () => {
    const texto = '[[anc]]\n[role=x]\n.Título solto\n\npar\n\n.Outro no fim';
    const d = doc(texto);
    expect(tipos(d.blocos)).toEqual(['bruto', 'paragrafo', 'bruto']);
    expect(serializarDocumento(d)).toBe(texto);
  });

  it('título de nível 0 no corpo e além do nível 5 geram aviso; título discreto e âncora sobrevivem', () => {
    const { documento, avisos } = analisarAsciiDoc('texto\n\n= Zero\n\n###### Seis\n\n[discrete]\n== Solto\n\n[[id]]\n== Com âncora');
    expect(avisos.map((pA) => pA.texto)).toEqual([expect.stringContaining('nível 0'), expect.stringContaining('além do nível 5')]);
    const titulos = documento.blocos.filter((pB) => pB.tipo === 'titulo');
    expect(titulos.map((pB) => (pB.tipo === 'titulo' ? pB.nivel : 0))).toEqual([1, 5, 1, 1]);
    expect(titulos[2].tipo === 'titulo' && titulos[2].discreto).toBe(true);
    expect(titulos[3].ancora).toBe('id');
    expect(serializarDocumento(documento)).toContain('[discrete]\n== Solto');
    expect(serializarDocumento(documento)).toContain('[[id]]\n== Com âncora');
  });

  it('atributo do documento no corpo com valor em várias linhas', () => {
    const d = doc('texto\n\n:nome: um \\\ndois');
    const atributo = d.blocos[1];
    expect(atributo.tipo === 'atributo' && atributo.valor).toBe('um \ndois');
    expect(serializarDocumento(d)).toBe('texto\n\n:nome: um  \\\ndois');
  });

  it('parágrafo com estilo: source, literal, admonição, quote, verse, sidebar, example, comment e pass', () => {
    expect(ida('[source,ts]\ncódigo')).toBe('[source,ts]\n----\ncódigo\n----');
    expect(ida('[literal]\nlit')).toBe('....\nlit\n....');
    expect(ida('[listing]\nlist')).toBe('----\nlist\n----');
    expect(ida('[NOTE]\nnota')).toBe('NOTE: nota');
    expect(ida('[quote, Autor, Fonte]\nfrase')).toBe('[quote,Autor,Fonte]\n____\nfrase\n____');
    expect(ida('[verse, Poeta]\nverso')).toBe('[verse,Poeta]\n____\nverso\n____');
    expect(ida('[sidebar]\nlado')).toBe('****\nlado\n****');
    expect(ida('[example]\nex')).toBe('====\nex\n====');
    expect(ida('[comment]\ncom')).toBe('//com');
    expect(ida('[pass]\n<b>x</b>')).toBe('++++\n<b>x</b>\n++++');
    expect(ida('[.lead.outro]\nabre')).toBe('[.outro]\n[.lead]\nabre');
    expect(doc('[.lead]\nabre').blocos[0]).toMatchObject({ tipo: 'paragrafo', estilo: 'lead' });
    expect(doc('[.lead]\nabre').blocos[0].papeis).toBeUndefined();
  });

  it('parágrafo literal indentado e listagem com [source] sem linguagem', () => {
    const literal = doc('  a\n   b');
    expect(literal.blocos[0]).toMatchObject({ tipo: 'codigo', estilo: 'literal', codigo: 'a\n b' });
    expect(ida('[source]\n----\nx\n----')).toBe('[source]\n----\nx\n----');
    expect(ida('[source,ts]\n--\nx\n--')).toBe('[source,ts]\n----\nx\n----');
    expect(ida('[source,language=js]\n----\nx\n----')).toBe('[source,js]\n----\nx\n----');
    expect(ida('```\nx\n```')).toBe('[source]\n----\nx\n----');
  });

  it('containers delimitados: exemplo com título, barra lateral, citação com autor, bloco aberto e admonição em bloco', () => {
    expect(ida('.Exemplo\n====\nx\n====')).toBe('.Exemplo\n====\nx\n====');
    expect(ida('****\nx\n****')).toBe('****\nx\n****');
    expect(ida('[quote, A, F]\n____\nx\n____')).toBe('[quote,A,F]\n____\nx\n____');
    expect(ida('[verse]\n____\nx\n____')).toBe('[verse]\n____\nx\n____');
    expect(ida('--\nx\n--')).toBe('--\nx\n--');
    expect(ida('[sidebar]\n--\nx\n--')).toBe('****\nx\n****');
    expect(ida('[TIP]\n====\num\n\ndois\n====')).toBe('[TIP]\n====\num\n\ndois\n====');
    // Delimitador que colide com o conteúdo cresce.
    expect(ida('[source]\n-----\n----\n-----')).toBe('[source]\n-----\n----\n-----');
  });

  it('citação em estilo Markdown com atribuição', () => {
    const d = doc('> frase\n> -- Autor, Fonte');
    const c = d.blocos[0];
    expect(c.tipo === 'container' && c.autor).toBe('Autor');
    expect(c.tipo === 'container' && c.fonte).toBe('Fonte');
    expect(serializarDocumento(d)).toBe('[quote,Autor,Fonte]\n____\nfrase\n____');
  });

  it('listas: marcadores com hífen, numerada, checklist por atributo, sublista de outro tipo e continuação depois de vazio', () => {
    expect(ida('- a\n- b')).toBe('* a\n* b');
    expect(ida('1. a\n2. b')).toBe('. a\n. b');
    expect(ida('[checklist]\n* a')).toBe('* [ ] a');
    // Marcador de OUTRO tipo sem linha vazia é sublista; o `* b` que segue entra ainda mais fundo (sublista de a1), e o
    // serializador escreve cada nível pela profundidade — apurado em 2026-10-30.
    const mista = doc('* a\n. a1\n* b');
    expect(tipos(mista.blocos)).toEqual(['lista']);
    expect(serializarDocumento(mista)).toBe('* a\n.. a1\n*** b');
    expect(ida('* a\n\n+\nanexo')).toBe('* a\n+\nanexo');
    // Lista seguida de outra lista de marcador diferente no mesmo nível vira dois blocos.
    expect(tipos(doc('* a\n\n. b').blocos)).toEqual(['lista', 'lista']);
  });

  it('descrição: termo com texto na linha seguinte, aninhada, e volta no round-trip', () => {
    expect(ida('termo::\ndesc')).toBe('termo:: desc');
    expect(ida('a:: 1\nb:: 2')).toBe('a:: 1\nb:: 2');
    const aninhada = doc('a:: 1\nb::: 2');
    expect(serializarDocumento(aninhada)).toBe('a:: 1\nb::: 2');
    const comBloco = doc('termo::\n+\n----\ncod\n----');
    expect(serializarDocumento(comBloco)).toBe('termo::\n+\n----\ncod\n----');
    expect(ida('* item\nx:: y')).toBe('* item\nx:: y');
  });

  it('chamadas: numerada, automática, e a linha seguinte é continuação da chamada (não outra chamada)', () => {
    expect(doc('<.> x').blocos[0]).toMatchObject({ tipo: 'chamadas', itens: [{ numero: 1 }] });
    expect(doc('<5> y').blocos[0]).toMatchObject({ tipo: 'chamadas', itens: [{ numero: 5 }] });
    // Linhas consecutivas são lidas como continuação do texto da chamada — apurado em 2026-10-30.
    const texto = '<1> um\n<.> dois\ncontinua';
    const d = doc(texto);
    expect(d.blocos[0].tipo === 'chamadas' && d.blocos[0].itens).toHaveLength(1);
    expect(serializarDocumento(d)).toBe(texto);
  });

  it('tabelas CSV, DSV e TSV; coluna por cols; rodapé e outros atributos; barra escapada', () => {
    const csv = doc(',===\na,"b, c"\n\n1,2\n,===');
    const t = csv.blocos[0] as Tabela;
    expect(t.numeroDeColunas).toBe(2);
    expect(t.cabecalho).toBe(true);
    expect(textoPuro(t.linhas[0].celulas[1].conteudo)).toBe('b, c');

    const dsv = doc(':===\na:b\n:===');
    expect((dsv.blocos[0] as Tabela).numeroDeColunas).toBe(2);
    const tsv = doc('[format=tsv]\n|===\na\tb\n|===');
    expect((tsv.blocos[0] as Tabela).numeroDeColunas).toBe(2);
    const aspas = doc(',===\n"a ""b""",c\n,===');
    expect(textoPuro((aspas.blocos[0] as Tabela).linhas[0].celulas[0].conteudo)).toBe('a "b"');

    const completa = doc('[cols="2*",options="footer",width=50%]\n|===\n|a |b\n|c |d\n|===');
    const tc = completa.blocos[0] as Tabela;
    expect(tc.rodape).toBe(true);
    expect(tc.outrosAtributos).toBe('[width=50%]');
    expect(serializarDocumento(completa)).toBe('[%footer,cols="2*",width=50%]\n|===\n|a |b\n|c |d\n|===');

    const escapada = doc('|===\n|a \\| b |c\n|===');
    expect(textoPuro((escapada.blocos[0] as Tabela).linhas[0].celulas[0].conteudo)).toBe('a | b');
    expect(serializarDocumento(escapada)).toBe('|===\n|a \\| b |c\n|===');

    // Linha incompleta fecha a tabela com o que tem; especificação de células: linhas, estilo, alinhamento.
    const parcial = doc('[cols="3*"]\n|===\n|a |b\n|===');
    expect((parcial.blocos[0] as Tabela).numeroDeColunas).toBe(3);
    expect((parcial.blocos[0] as Tabela).linhas[0].celulas).toHaveLength(2);
    // `cols=3` sem `*` é UMA coluna de largura 3: cada célula vira uma linha.
    expect((doc('[cols=3]\n|===\n|a |b\n|===').blocos[0] as Tabela).linhas).toHaveLength(2);
    const estilos = doc('|===\n.2+|a >s|b\n|===');
    const celulas = (estilos.blocos[0] as Tabela).linhas[0].celulas;
    expect(celulas[0].linhas).toBe(2);
    expect(celulas[1]).toMatchObject({ alinhamento: 'direita', estilo: 's' });
    expect(serializarDocumento(estilos)).toBe('|===\n.2+|a >s|b\n|===');
    expect(ida('[cols="1,2"]\n|===\n|a |b\n|===')).toBe('[cols="1,2"]\n|===\n|a |b\n|===');
  });

  it('imagem com largura, altura e outros atributos; mídia; sumário; quebras; comentário em bloco; passagem', () => {
    expect(ida('image::a.png[Alt,200,100,link=x]')).toBe('image::a.png[Alt,200,100,link=x]');
    expect(ida('image::a.png[]')).toBe('image::a.png[]');
    expect(ida('image::a.png[width=50]')).toBe('image::a.png[,50]');
    expect(ida('video::v.mp4[opts=autoplay]')).toBe('video::v.mp4[opts=autoplay]');
    expect(ida('audio::a.mp3[]')).toBe('audio::a.mp3[]');
    expect(ida('toc::[]')).toBe('toc::[]');
    expect(ida("<<<\n\n'''\n\n---")).toBe("<<<\n\n'''\n\n'''");
    expect(ida('////\ncom\n////')).toBe('////\ncom\n////');
    expect(ida('// a\n// b')).toBe('// a\n// b');
    expect(ida('++++\n<b>\n++++')).toBe('++++\n<b>\n++++');
    expect(ida('....\nlit\n....')).toBe('....\nlit\n....');
  });

  it('linha de atributos que o modelo não absorve fica em atributosBrutos', () => {
    const d = doc('[%hardbreaks,id=x,role=r]\npar');
    expect(d.blocos[0].ancora).toBe('x');
    expect(d.blocos[0].papeis).toEqual(['r']);
    expect(d.blocos[0].atributosBrutos).toEqual(['[%hardbreaks]']);
    expect(serializarDocumento(d)).toBe('[[x]]\n[%hardbreaks]\n[.r]\npar');
    // Estilo posicional que o parágrafo não conhece é descartado; o atributo nomeado fica.
    const duas = doc('[a]\n[b=1]\npar');
    expect(serializarDocumento(duas)).toBe('[b=1]\npar');
  });

  it('CRLF é normalizado', () => {
    expect(ida('a\r\n\r\nb')).toBe('a\n\nb');
  });
});

describe('atributos', () => {
  it('lê posicionais, nomeados com aspas e vírgula, atalhos de id, papel e opção', () => {
    expect(lerAtributos('')).toEqual({ posicionais: [], nomeados: {}, papeis: [], opcoes: [] });
    const lidos = lerAtributos('#meu-id.p1.p2%op, segundo, nome="a, b", role=r1 r2, id=outro, options="x,y"');
    expect(lidos.id).toBe('outro');
    expect(lidos.papeis).toEqual(['p1', 'p2', 'r1', 'r2']);
    expect(lidos.opcoes).toEqual(['op', 'x', 'y']);
    expect(lidos.posicionais).toEqual(['', 'segundo']);
    expect(lidos.nomeados.nome).toBe('a, b');
    expect(lerAtributos("x='a,b'").nomeados.x).toBe('a,b');
    expect(lerAtributos('a"b').posicionais).toEqual(['a"b']);
  });

  it('escreve a lista de volta, com aspas só quando o valor pede', () => {
    expect(escreverAtributos(['a', ''], { b: '1', c: 'x,y', d: 'co"m' })).toBe('a,b=1,c="x,y",d="co\\"m"');
    expect(escreverAtributos([], {})).toBe('');
  });
});

describe('inline', () => {
  it('e-mail automático, âncora inline, papel com id, passagens e macros anchor/pass/footnote', () => {
    const partes = analisarInline('fale com a@b.com hoje [[anc,Rótulo]] [#id.x]#texto# ++literal++ +simples+ anchor:a1[r] pass:[<b>] footnote:n1[nota] menu:Arquivo[Salvar] btn:[OK] image:i.png[alt] xref:x.adoc[y] link:docs/g.html[Guia] mailto:x@y.z[Fale] icon:ok[]');
    const atomos = partes.filter((pP) => pP.tipo === 'atomo').map((pP) => (pP.tipo === 'atomo' ? `${pP.especie}:${JSON.stringify(pP.dados)}` : ''));
    expect(atomos).toEqual([
      'ancora:{"id":"anc","texto":"Rótulo"}',
      'ancora:{"id":"id"}',
      'passagem:{"texto":"literal","forma":"++"}',
      'ancora:{"id":"a1","texto":"r"}',
      'passagem:{"texto":"<b>","forma":"pass"}',
      'notaDeRodape:{"id":"n1","texto":"nota"}',
      'menu:{"alvo":"Arquivo","texto":"Salvar"}',
      'botao:{"texto":"OK"}',
      'imagem:{"alvo":"i.png","alt":"alt","atributos":"alt"}',
      'referencia:{"alvo":"x.adoc","texto":"y"}',
      'bruto:{"texto":"icon:ok[]"}',
    ]);
    const textos = partes.filter((pP) => pP.tipo === 'texto');
    const email = textos.find((pP) => pP.tipo === 'texto' && pP.texto === 'a@b.com');
    expect(email?.tipo === 'texto' && email.marcas).toEqual([{ tipo: 'link', valor: 'mailto:a@b.com' }]);
    const papel = textos.find((pP) => pP.tipo === 'texto' && pP.texto === 'texto');
    expect(papel?.tipo === 'texto' && papel.marcas).toEqual([{ tipo: 'papel', valor: 'x' }]);
    const guia = textos.find((pP) => pP.tipo === 'texto' && pP.texto === 'Guia');
    expect(guia?.tipo === 'texto' && guia.marcas).toEqual([{ tipo: 'link', valor: 'docs/g.html' }]);
    const fale = textos.find((pP) => pP.tipo === 'texto' && pP.texto === 'Fale');
    expect(fale?.tipo === 'texto' && fale.marcas).toEqual([{ tipo: 'link', valor: 'mailto:x@y.z' }]);
    expect(textoPuro(partes)).toContain(' simples ');
  });

  it('pares que não fecham são texto; escape dentro do par; URL com pontuação final e com rótulo vazio', () => {
    expect(textoPuro(analisarInline('*aberto'))).toBe('*aberto');
    expect(textoPuro(analisarInline('a*b*'))).toBe('a*b*');
    expect(textoPuro(analisarInline('* x*'))).toBe('* x*');
    expect(textoPuro(analisarInline('*x\\*y*'))).toBe('x*y');
    const url = analisarInline('veja https://x.org/a. e https://y.org[]');
    expect(textoPuro(url)).toBe('veja https://x.org/a. e https://y.org');
    expect(analisarInline('')).toEqual([]);
    expect(textoPuro(analisarInline('^a b^ ~x'))).toBe('^a b^ ~x');
    expect(textoPuro(analisarInline('[.p]#sem fim'))).toBe('[.p]#sem fim');
  });
});

describe('serializador', () => {
  it('escapa só o que o parser leria como formatação', () => {
    expect(escaparTexto('a\\b', undefined)).toBe('a\\\\b');
    expect(escaparTexto('**x', undefined)).toBe('\\*\\*x');
    expect(escaparTexto('x *y', undefined)).toBe('x \\*y');
    expect(escaparTexto('a^b^', undefined)).toBe('a\\^b^');
    expect(escaparTexto('{attr} e {-x}', undefined)).toBe('\\{attr} e {-x}');
    expect(escaparTexto('<<a>> [[b]] [c]#d#', undefined)).toBe('\\<<a>> \\[[b]] \\[c]\\#d#');
    expect(escaparTexto('kbd:[x] e https://a.b', undefined)).toBe('\\kbd:[x] e \\https://a.b');
    expect(escaparTexto('fim +', undefined)).toBe('fim \\+');
    expect(escaparTexto('fim +\nlinha', undefined)).toBe('fim \\+\nlinha');
    // Depois de letra, o `*` não abre par: não se escapa.
    expect(escaparTexto('a*b', undefined)).toBe('a*b');
  });

  it('átomos: âncora com rótulo, bruto, mailto nu e link dentro de link', () => {
    expect(serializarInline([{ tipo: 'atomo', especie: 'ancora', dados: { id: 'a', texto: 'r' } }])).toBe('[[a,r]]');
    expect(serializarInline([{ tipo: 'atomo', especie: 'bruto', dados: { texto: 'x::y[]' } }])).toBe('x::y[]');
    expect(serializarInline([{ tipo: 'atomo', especie: 'bruto', dados: {} }])).toBe('');
    expect(serializarInline([{ tipo: 'texto', texto: 'a@b.com', marcas: [{ tipo: 'link', valor: 'mailto:a@b.com' }] }])).toBe('a@b.com');
    expect(serializarInline([{ tipo: 'texto', texto: 'x]y', marcas: [{ tipo: 'link', valor: 'docs/a' }] }])).toBe('link:docs/a[x\\]y]');
    // Colado à letra seguinte, o primeiro par sai unconstrained (`##`); o segundo, no fim, constrained.
    expect(serializarInline([{ tipo: 'texto', texto: 'a', marcas: [{ tipo: 'sublinhado' }] }, { tipo: 'texto', texto: 'b', marcas: [{ tipo: 'tachado' }] }])).toBe('[.underline]##a##[.line-through]#b#');
  });

  it('marca que atravessa trechos abre uma vez; marca aninhada fecha antes da externa', () => {
    const partes = analisarInline('*a _b_ c*');
    expect(serializarInline(partes)).toBe('*a _b_ c*');
    const quebra = analisarInline('*a* kbd:[x] *b*');
    expect(serializarInline(quebra)).toBe('*a* kbd:[x] *b*');
  });

  it('bloco: descrição cujo primeiro filho não é parágrafo simples; imagem só com altura', () => {
    const d: Documento = {
      blocos: [
        { id: 'd', tipo: 'descricao', itens: [{ id: 'i', conteudo: [{ tipo: 'texto', texto: 't', marcas: [] }], filhos: [{ id: 'c', tipo: 'codigo', estilo: 'listagem', codigo: 'x' }, { id: 'p', tipo: 'paragrafo', conteudo: [{ tipo: 'texto', texto: 'y', marcas: [] }] }] }] },
        { id: 'img', tipo: 'imagem', alvo: 'a.png', altura: '10' },
        { id: 'img2', tipo: 'imagem', alvo: 'b.png', alt: 'B', outrosAtributos: 'link=x' },
      ],
    };
    expect(serializarDocumento(d)).toBe('t::\n+\n----\nx\n----\n+\ny\n\nimage::a.png[,,10]\n\nimage::b.png[B,link=x]');
  });
});

describe('modelo de documento (casos restantes)', () => {
  it('esqueleto com título inicial; seção com código ou tabela conta como preenchida', () => {
    const modelo: ModeloDeDocumento = { ...MODELO_DECISAO, tituloInicial: 'Minha decisão' };
    const esqueleto = esqueletoDoModelo(modelo);
    expect(esqueleto.startsWith('= Minha decisão\n\n')).toBe(true);
    const [primeira] = modelo.secoes;
    const comCodigo = doc(`== ${primeira.titulo}\n\n----\ncod\n----`);
    expect(avaliarModelo(comCodigo, modelo).vazias.map((pS) => pS.titulo)).not.toContain(primeira.titulo);
    const comTabela = doc(`== ${primeira.titulo}\n\n|===\n|a\n|===`);
    expect(avaliarModelo(comTabela, modelo).vazias.map((pS) => pS.titulo)).not.toContain(primeira.titulo);
    const subtitulo = doc(`== ${primeira.titulo}\n\n=== Sub\n\ntexto`);
    expect(avaliarModelo(subtitulo, modelo).vazias.map((pS) => pS.titulo)).not.toContain(primeira.titulo);
    const seguidaDeOutra = doc(`== ${primeira.titulo}\n\n== Outra\n\ntexto`);
    expect(avaliarModelo(seguidaDeOutra, modelo).vazias.map((pS) => pS.titulo)).toContain(primeira.titulo);
  });

  it('título do modelo dentro de um container também é reconhecido; sem seção travada não há violação nem espaço a garantir', () => {
    const [primeira] = MODELO_INCIDENTE.secoes;
    const dentro = doc(`====\n== ${primeira.titulo}\n====`);
    expect(secoesTravadas(dentro, MODELO_INCIDENTE).size).toBe(1);
    const livre = doc('texto livre');
    expect(violacaoDoModelo(livre, doc('outro'), MODELO_INCIDENTE)).toBeNull();
    expect(garantirEspacoDasSecoes(livre, MODELO_INCIDENTE)).toBe(livre);
  });

  it('trocar a ordem de duas seções fixas é violação', () => {
    const [a, b] = MODELO_INCIDENTE.secoes;
    const antes = doc(`== ${a.titulo}\n\nx\n\n== ${b.titulo}\n\ny`);
    const trocado: Documento = { blocos: [antes.blocos[2], antes.blocos[3], antes.blocos[0], antes.blocos[1]] };
    expect(violacaoDoModelo(antes, trocado, MODELO_INCIDENTE)).toContain('ordem declarada');
    expect(MODELOS_DE_EXEMPLO).toHaveLength(3);
  });
});
