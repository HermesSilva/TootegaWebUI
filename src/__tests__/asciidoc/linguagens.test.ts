/**
 * LINGUAGENS do realce de código — os ganchos e caminhos que o tokenizador genérico oferece por linguagem: regex
 * literal e JSX/decorador no TypeScript, string multilinha com estado, pré-processador e atributo do C#, variáveis do
 * SQL/Shell/PowerShell, chave de JSON, decorador do Python, opções de comando — e o tokenizador do próprio AsciiDoc.
 */
import { describe, expect, it } from 'vitest';
import { linguagemPorNome } from '@core/components/asciidoc/codigo/linguagens';
import { lerString, linguagemGenerica } from '@core/components/asciidoc/codigo/linguagens/generica';
import { CacheDeTokens } from '@core/components/asciidoc/codigo/cache';
import { ColetorDeTokens } from '@core/components/asciidoc/codigo/tokens';

function tipos(pLinguagem: string, pLinha: string, pEstado = ''): string[] {
  return linguagemPorNome(pLinguagem).tokenizarLinha(pLinha, pEstado).tokens.map((pT) => `${pT.tipo}:${pLinha.slice(pT.ini, pT.fim)}`);
}

describe('tokenizador genérico', () => {
  it('string multilinha guarda o estado e fecha na linha seguinte (template literal do TypeScript)', () => {
    const ts = linguagemPorNome('ts');
    const abre = ts.tokenizarLinha('const s = `abre', '');
    expect(abre.estadoFinal).toBe('s:`:\\:texto');
    const meio = ts.tokenizarLinha('ainda dentro', abre.estadoFinal);
    expect(meio.tokens).toEqual([{ ini: 0, fim: 12, tipo: 'texto' }]);
    expect(meio.estadoFinal).toBe(abre.estadoFinal);
    const fecha = ts.tokenizarLinha('fim` + 1', abre.estadoFinal);
    expect(fecha.tokens.map((pT) => pT.tipo)).toEqual(['texto', 'operador', 'numero']);
    expect(fecha.estadoFinal).toBe('');
  });

  it('comentário de bloco fechado na mesma linha não muda o estado', () => {
    expect(tipos('ts', 'a /* x */ b')).toEqual(['normal:a', 'comentario:/* x */', 'normal:b']);
  });

  it('escape dentro de string, propriedade depois de ponto e embutida', () => {
    expect(tipos('ts', 'console.log("a\\"b")')).toEqual(['funcao:console', 'operador:.', 'funcao:log', 'pontuacao:(', 'texto:"a\\"b"', 'pontuacao:)']);
    expect(tipos('ts', 'x.y')).toEqual(['normal:x', 'operador:.', 'propriedade:y']);
    expect(lerString('abc"', 0, '"', '', false)).toEqual({ fim: 4, fechou: true });
    expect(lerString('abc', 0, '"', '', true)).toEqual({ fim: 3, fechou: false });
  });

  it('caractere que nenhuma regra reconhece sai como normal', () => {
    expect(tipos('ts', '§')).toEqual(['normal:§']);
  });

  it('definição mínima: sem comentário de linha, sem strings, com caixa ignorada', () => {
    const minima = linguagemGenerica({ nome: 'mini', apelidos: [], rotulo: 'Mini', palavrasChave: ['Se'], ignorarCaixa: true });
    expect(minima.comentarioDeLinha).toBeUndefined();
    expect(minima.tokenizarLinha('SE x', '').tokens.map((pT) => pT.tipo)).toEqual(['palavraChave', 'normal']);
  });

  it('o coletor funde vizinhos do mesmo tipo e ignora intervalos vazios', () => {
    const coletor = new ColetorDeTokens();
    coletor.adicionar(0, 0, 'normal');
    coletor.adicionar(0, 2, 'texto');
    coletor.adicionar(2, 4, 'texto');
    coletor.adicionar(4, 5, 'numero');
    expect(coletor.tokens).toEqual([
      { ini: 0, fim: 4, tipo: 'texto' },
      { ini: 4, fim: 5, tipo: 'numero' },
    ]);
  });
});

describe('TypeScript e JavaScript', () => {
  it('regex literal só onde um operando pode começar', () => {
    expect(tipos('ts', 'x = /ab+c/gi;')).toEqual(['normal:x', 'operador:=', 'texto:/ab+c/gi', 'pontuacao:;']);
    expect(tipos('ts', 'return /[/]\\/x/;')).toEqual(['palavraChave:return', 'texto:/[/]\\/x/', 'pontuacao:;']);
    // Depois de um identificador é divisão, não regex.
    expect(tipos('js', 'a / b')).toEqual(['normal:a', 'operador:/', 'normal:b']);
    // Regex sem fechamento não é regex.
    expect(tipos('js', 'x = /aberta')).toEqual(['normal:x', 'operador:=', 'operador:/', 'normal:aberta']);
  });

  it('decorador e etiqueta JSX', () => {
    expect(tipos('ts', '@Component()')).toEqual(['macro:@Component', 'pontuacao:()']);
    expect(tipos('tsx', '<Div className="x">')).toEqual(['etiqueta:<Div', 'normal:className', 'operador:=', 'texto:"x"', 'operador:>']);
    expect(tipos('tsx', 'x = </Div>')).toEqual(['normal:x', 'operador:=', 'etiqueta:</Div', 'operador:>']);
    // Depois de um identificador (inclusive `return`), `<` é comparação — apurado em 2026-10-30.
    expect(tipos('ts', 'a <b')).toEqual(['normal:a', 'operador:<', 'normal:b']);
    expect(tipos('tsx', 'return <Div>')).toEqual(['palavraChave:return', 'operador:<', 'normal:Div', 'operador:>']);
  });
});

describe('C#, SQL, JSON, Python, Shell e PowerShell', () => {
  it('C#: pré-processador colore a linha inteira; atributo só no início da linha', () => {
    expect(tipos('cs', '#region Nome')).toEqual(['macro:#region Nome']);
    expect(tipos('cs', 'x = [1]')).toEqual(['normal:x', 'operador:=', 'pontuacao:[', 'numero:1', 'pontuacao:]']);
    expect(tipos('cs', '[Fact sem fim')).toEqual(['pontuacao:[', 'normal:Fact', 'normal:sem', 'normal:fim']);
  });

  it('SQL: variável @x, identificador entre colchetes e aspas duplas', () => {
    expect(tipos('sql', 'select @x from [Tabela] "col"')).toEqual(['palavraChave:select', 'variavel:@x', 'palavraChave:from', 'variavel:[Tabela]', 'variavel:"col"']);
  });

  it('JSON: chave e valor saem como texto (as strings são lidas antes do gancho de chave — apurado em 2026-10-30)', () => {
    expect(tipos('json', '{ "a": "b", "c": 1 }')).toEqual(['pontuacao:{', 'texto:"a"', 'operador::', 'texto:"b"', 'pontuacao:,', 'texto:"c"', 'operador::', 'numero:1', 'pontuacao:}']);
    expect(tipos('jsonc', '// nota\n'.trim())).toEqual(['comentario:// nota']);
    expect(tipos('json', 'null')).toEqual(['constante:null']);
  });

  it('Python: decorador, string tripla multilinha e constantes', () => {
    expect(tipos('py', '@dataclass')).toEqual(['macro:@dataclass']);
    expect(tipos('py', 'x = None')).toEqual(['normal:x', 'operador:=', 'constante:None']);
    const tripla = linguagemPorNome('python').tokenizarLinha('s = """abre', '');
    expect(tripla.estadoFinal.startsWith('s:"""')).toBe(true);
    expect(tipos('py', 'x @ y')).toEqual(['normal:x', 'normal:@', 'normal:y']);
  });

  it('Shell: variáveis, opções e comandos embutidos', () => {
    expect(tipos('sh', 'ls -la --all $HOME ${X} $1')).toEqual(['funcao:ls', 'atributo:-la', 'atributo:--all', 'variavel:$HOME', 'variavel:${X}', 'variavel:$1']);
    // `-` sem espaço antes não é opção (vira operador entre dois identificadores); no início da linha também não.
    expect(tipos('bash', 'a-b')).toEqual(['normal:a', 'operador:-', 'normal:b']);
    expect(tipos('bash', '-x')).toEqual(['operador:-', 'normal:x']);
  });

  it('PowerShell: cmdlet Verbo-Nome, parâmetro, variável e constante', () => {
    expect(tipos('ps1', 'Get-Item -Path $x')).toEqual(['funcao:Get-Item', 'atributo:-Path', 'variavel:$x']);
    // `$true` casa primeiro com a regra de variável (ela vem antes das constantes) — apurado em 2026-10-30.
    expect(tipos('pwsh', 'if ($true) { }')).toEqual(['palavraChave:if', 'pontuacao:(', 'variavel:$true', 'pontuacao:)', 'pontuacao:{', 'pontuacao:}']);
    expect(tipos('ps', 'xGet-Item')).toEqual(['normal:xGet', 'operador:-', 'normal:Item']);
  });

  it('texto puro: tudo é normal, sem número nem operador', () => {
    expect(tipos('texto', 'a 1 + b')).toEqual(['normal:a', 'normal:1', 'normal:+', 'normal:b']);
    expect(linguagemPorNome(undefined).nome).toBe('texto');
  });
});

describe('AsciiDoc (o modo Código do editor)', () => {
  const adoc = linguagemPorNome('adoc');

  it('bloco delimitado: chamada <1> dentro da listagem e comentário em bloco', () => {
    const dentro = adoc.tokenizarLinha('const x = 1; <1>', 'd:----');
    expect(dentro.tokens.map((pT) => pT.tipo)).toEqual(['texto', 'constante']);
    expect(dentro.estadoFinal).toBe('d:----');
    const comentario = adoc.tokenizarLinha('qualquer coisa', 'd:////');
    expect(comentario.tokens[0].tipo).toBe('comentario');
    const cercado = adoc.tokenizarLinha('```', '');
    expect(cercado.estadoFinal).toBe('d:```');
  });

  it('tabela: linhas com | são pontuação, fecha em |===', () => {
    expect(tipos('asciidoc', '|a |*b*', 't')).toEqual(['pontuacao:|', 'pontuacao:|', 'forte:*b*']);
    expect(tipos('asciidoc', '2+^|mesclada', 't')).toEqual(['pontuacao:2+^|']);
    const fecha = adoc.tokenizarLinha('|===', 't');
    expect(fecha.tokens[0].tipo).toBe('delimitador');
    expect(fecha.estadoFinal).toBe('');
  });

  it('linhas estruturais: delimitador composto, comentário, atributo, linha de atributos, título de bloco, macro, quebras', () => {
    expect(tipos('asciidoc', '====')).toEqual(['delimitador:====']);
    expect(adoc.tokenizarLinha('--', '').estadoFinal).toBe('');
    expect(tipos('asciidoc', '// nota')).toEqual(['comentario:// nota']);
    expect(tipos('asciidoc', ':toc: left')).toEqual(['propriedade::toc:', 'texto: left']);
    expect(tipos('asciidoc', '[source,ts]')).toEqual(['atributo:[source,ts]']);
    expect(tipos('asciidoc', '.Título do bloco')).toEqual(['tipo:.Título do bloco']);
    expect(tipos('asciidoc', 'image::a.png[alt]')).toEqual(['macro:image::a.png[alt]']);
    expect(tipos('asciidoc', '<<<')).toEqual(['delimitador:<<<']);
    expect(tipos('asciidoc', "'''")).toEqual(["delimitador:'''"]);
  });

  it('admonição, listas, descrição, chamada e continuação', () => {
    expect(tipos('asciidoc', 'NOTE: *forte*')).toEqual(['palavraChave:NOTE:', 'forte:*forte*']);
    expect(tipos('asciidoc', '** [x] item _i_')).toEqual(['pontuacao:** [x] ', 'enfase:_i_']);
    expect(tipos('asciidoc', 'termo:: descrição')).toEqual(['forte:termo', 'pontuacao:::']);
    expect(tipos('asciidoc', '<1> explicação')).toEqual(['constante:<1>']);
    expect(tipos('asciidoc', '+')).toEqual(['pontuacao:+']);
    // URL com `::` no meio não é descrição.
    expect(tipos('asciidoc', 'https://x.org')).toEqual(['link:https://x.org']);
  });

  it('inline: escape, mono, realce, papel, macro, referência, atributo, sobrescrito e quebra forçada', () => {
    expect(tipos('asciidoc', 'a \\* `m` #r# [.p]#x# kbd:[A] <<id>> {attr} ^s^ +')).toEqual([
      'escape:\\*',
      'texto:`m`',
      'atributo:#r#',
      // O `#` de abertura do papel sai junto com `[.p]`; o `x#` que sobra não forma par.
      'atributo:[.p]#',
      'macro:kbd:[A]',
      'link:<<id>>',
      'variavel:{attr}',
      'enfase:^s^',
      'escape: +',
    ]);
  });
});

describe('cache de tokens', () => {
  it('trocar a linguagem invalida tudo; a mesma linguagem e as mesmas linhas não mudam nada', () => {
    const cache = new CacheDeTokens(linguagemPorNome('ts'));
    const linhas = ['const a = 1;', '// fim'];
    cache.definirLinhas(linhas);
    expect(cache.total).toBe(2);
    expect(cache.tokensDaLinha(1)[0].tipo).toBe('comentario');
    cache.definirLinguagem(linguagemPorNome('ts'));
    cache.definirLinhas(linhas);
    expect(cache.tokensDaLinha(1)[0].tipo).toBe('comentario');
    cache.definirLinguagem(linguagemPorNome('python'));
    // Em Python `//` não é comentário: a linha foi retokenizada.
    expect(cache.tokensDaLinha(1)[0].tipo).not.toBe('comentario');
    expect(cache.tokensDaLinha(-1)).toEqual([]);
    expect(cache.tokensDaLinha(99)).toEqual([]);
  });
});
