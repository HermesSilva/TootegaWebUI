/**
 * O catálogo de linguagens do realce. `linguagemPorNome` aceita o nome ou um apelido (`ts`, `cs`, `sh`…) e cai no
 * texto puro quando não conhece — nunca lança: um `[source,cobol]` ainda é um bloco de código legível.
 */

import { ASCIIDOC } from './asciidoc';
import { CSHARP, JAVASCRIPT, JSON_, POWERSHELL, PYTHON, SHELL, SQL, TEXTO, TYPESCRIPT } from './clike';
import { CSS, MARKDOWN, XML, YAML } from './marcacao';
import type { Linguagem } from '../tokens';

export const LINGUAGENS: readonly Linguagem[] = [ASCIIDOC, TYPESCRIPT, JAVASCRIPT, CSHARP, SQL, JSON_, XML, CSS, YAML, MARKDOWN, PYTHON, SHELL, POWERSHELL, TEXTO];

const POR_NOME = new Map<string, Linguagem>();
for (const linguagem of LINGUAGENS) {
  POR_NOME.set(linguagem.nome, linguagem);
  for (const apelido of linguagem.apelidos)
    POR_NOME.set(apelido, linguagem);
}

export function linguagemPorNome(pNome: string | undefined): Linguagem {
  return POR_NOME.get((pNome ?? '').trim().toLowerCase()) ?? TEXTO;
}

export { ASCIIDOC, TEXTO };
