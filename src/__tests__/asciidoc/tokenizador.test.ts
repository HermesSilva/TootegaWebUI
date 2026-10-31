/**
 * TOKENIZADOR do editor de código: estado entre linhas (comentário de bloco, string multilinha), linguagens por
 * apelido e o cache incremental (recalcula só a partir da linha editada e para quando o estado converge).
 */
import { describe, expect, it } from 'vitest';
import { linguagemPorNome, LINGUAGENS } from '@core/components/asciidoc/codigo/linguagens';
import { CacheDeTokens } from '@core/components/asciidoc/codigo/cache';
import type { Linguagem, LinhaTokenizada } from '@core/components/asciidoc/codigo/tokens';

function tipos(pLinguagem: string, pLinha: string, pEstado = ''): string[] {
  return linguagemPorNome(pLinguagem).tokenizarLinha(pLinha, pEstado).tokens.map((pT) => `${pT.tipo}:${pLinha.slice(pT.ini, pT.fim)}`);
}

describe('tokenizador de código', () => {
  it('resolve linguagens por nome e apelido, e cai em texto quando não conhece', () => {
    expect(linguagemPorNome('ts').nome).toBe('typescript');
    expect(linguagemPorNome('cs').nome).toBe('csharp');
    expect(linguagemPorNome('COBOL').nome).toBe('texto');
    expect(LINGUAGENS.length).toBeGreaterThanOrEqual(12);
  });

  it('TypeScript: palavra-chave, tipo, string, número, comentário e chamada', () => {
    // Tokens vizinhos do mesmo tipo se fundem (`);` é um só): menos nós no DOM.
    expect(tipos('typescript', 'const x: number = f(1); // ok')).toEqual([
      'palavraChave:const',
      'normal:x',
      'operador::',
      'tipo:number',
      'operador:=',
      'funcao:f',
      'pontuacao:(',
      'numero:1',
      'pontuacao:);',
      'comentario:// ok',
    ]);
  });

  it('comentário de bloco atravessa linhas pelo estado', () => {
    const ts = linguagemPorNome('typescript');
    const primeira = ts.tokenizarLinha('a /* abre', '');
    expect(primeira.estadoFinal).toBe('c:*/');
    const segunda = ts.tokenizarLinha('ainda */ b', primeira.estadoFinal);
    expect(segunda.tokens[0].tipo).toBe('comentario');
    expect(segunda.estadoFinal).toBe('');
  });

  it('C#: string verbatim multilinha e atributo', () => {
    const cs = linguagemPorNome('csharp');
    expect(cs.tokenizarLinha('var s = @"abre', '').estadoFinal.startsWith('s:')).toBe(true);
    expect(tipos('csharp', '[Fact]')).toEqual(['macro:[Fact]']);
  });

  it('SQL ignora caixa e marca funções embutidas', () => {
    expect(tipos('sql', 'SELECT count(*) FROM T')).toEqual(['palavraChave:SELECT', 'funcao:count', 'pontuacao:(', 'operador:*', 'pontuacao:)', 'palavraChave:FROM', 'normal:T']);
  });

  it('AsciiDoc: título, delimitador com estado, inline e tabela', () => {
    const adoc = linguagemPorNome('asciidoc');
    expect(tipos('asciidoc', '== Título')).toEqual(['titulo:== Título']);
    const abre = adoc.tokenizarLinha('----', '');
    expect(abre.estadoFinal).toBe('d:----');
    expect(adoc.tokenizarLinha('código', abre.estadoFinal).tokens[0].tipo).toBe('texto');
    expect(adoc.tokenizarLinha('----', abre.estadoFinal).estadoFinal).toBe('');
    expect(tipos('asciidoc', 'a *b* https://x.org[y]')).toEqual(['forte:*b*', 'link:https://x.org[y]']);
    expect(adoc.tokenizarLinha('|===', '').estadoFinal).toBe('t');
  });

  it('cache incremental: só retokeniza a partir da linha editada e para quando converge', () => {
    let chamadas = 0;
    const base = linguagemPorNome('typescript');
    const contada: Linguagem = {
      ...base,
      tokenizarLinha(pLinha: string, pEstado: string): LinhaTokenizada {
        chamadas += 1;
        return base.tokenizarLinha(pLinha, pEstado);
      },
    };
    const cache = new CacheDeTokens(contada);
    const linhas = Array.from({ length: 1000 }, (_, pI) => `const v${pI} = ${pI};`);
    cache.definirLinhas(linhas);
    cache.tokensDaLinha(999);
    expect(chamadas).toBe(1000);

    chamadas = 0;
    const editadas = [...linhas];
    editadas[500] = 'const v500 = "mudou";';
    cache.definirLinhas(editadas);
    cache.tokensDaLinha(999);
    // A linha 500 muda; a 501 tem o mesmo texto e o mesmo estado inicial ⇒ converge ali.
    expect(chamadas).toBe(1);

    chamadas = 0;
    const comComentario = [...editadas];
    comComentario[10] = '/* abre comentário';
    cache.definirLinhas(comComentario);
    cache.tokensDaLinha(999);
    // O estado mudou para todas as linhas seguintes: todas são retokenizadas.
    expect(chamadas).toBe(990);
  });
});
