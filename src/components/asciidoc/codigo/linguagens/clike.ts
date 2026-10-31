/**
 * Linguagens definidas por DADOS sobre o tokenizador genérico: TypeScript/JavaScript, C#, SQL, JSON, Python, Shell.
 */

import type { TipoDeToken } from '../tokens';
import { linguagemGenerica, type Gancho } from './generica';

const ASPAS = [
  { abre: '"', fecha: '"', escape: '\\' },
  { abre: "'", fecha: "'", escape: '\\' },
];

/** Regex literal de JS: `/…/flags` só onde um operando pode começar (depois de `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;`, `return`, ou no início). */
const regexDeJS: Gancho = (pLinha, pPos, pAnterior) => {
  if (pLinha[pPos] !== '/' || pLinha[pPos + 1] === '/' || pLinha[pPos + 1] === '*')
    return null;
  if (pAnterior !== '' && !/^[(,=:\[!&|?{};]$/.test(pAnterior) && pAnterior !== 'return' && pAnterior !== 'typeof')
    return null;
  let i = pPos + 1;
  let classe = false;
  while (i < pLinha.length) {
    const c = pLinha[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '[')
      classe = true;
    else if (c === ']')
      classe = false;
    else if (c === '/' && !classe) {
      i += 1;
      while (i < pLinha.length && /[a-z]/.test(pLinha[i]))
        i += 1;
      return { fim: i, tipo: 'texto' as TipoDeToken };
    }
    i += 1;
  }
  return null;
};

/** Decorador (`@Nome`) e etiquetas JSX simples (`<Nome`, `</Nome`, `/>`). */
const decoradorEJSX: Gancho = (pLinha, pPos) => {
  if (pLinha[pPos] === '@') {
    const m = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(pLinha.slice(pPos));
    if (m)
      return { fim: pPos + m[0].length, tipo: 'macro' };
  }
  if (pLinha[pPos] === '<') {
    const m = /^<\/?[A-Za-z][A-Za-z0-9.-]*/.exec(pLinha.slice(pPos));
    if (m && !/[A-Za-z0-9_)\]]\s*$/.test(pLinha.slice(0, pPos)))
      return { fim: pPos + m[0].length, tipo: 'etiqueta' };
  }
  return null;
};

const PALAVRAS_JS = [
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await', 'of', 'static', 'get', 'set', 'from', 'as',
];
const PALAVRAS_TS = [...PALAVRAS_JS, 'interface', 'type', 'implements', 'declare', 'namespace', 'module', 'abstract', 'readonly', 'keyof', 'infer', 'is', 'satisfies', 'override', 'public', 'private', 'protected'];
const TIPOS_TS = ['string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'object', 'symbol', 'bigint', 'Record', 'Partial', 'Promise', 'Array', 'Map', 'Set', 'Date', 'Error', 'JSX', 'ReactNode', 'HTMLElement'];
const CONSTANTES_JS = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
const EMBUTIDAS_JS = ['console', 'window', 'document', 'Math', 'JSON', 'Object', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'setTimeout', 'clearTimeout', 'fetch', 'require'];

export const TYPESCRIPT = linguagemGenerica({
  nome: 'typescript',
  apelidos: ['ts', 'tsx'],
  rotulo: 'TypeScript',
  palavrasChave: PALAVRAS_TS,
  tipos: TIPOS_TS,
  constantes: CONSTANTES_JS,
  embutidas: EMBUTIDAS_JS,
  comentarioDeLinha: ['//'],
  comentarioDeBloco: [['/*', '*/']],
  strings: [...ASPAS, { abre: '`', fecha: '`', escape: '\\', multilinha: true }],
  ganchos: [regexDeJS, decoradorEJSX],
});

export const JAVASCRIPT = linguagemGenerica({
  nome: 'javascript',
  apelidos: ['js', 'jsx', 'mjs', 'cjs'],
  rotulo: 'JavaScript',
  palavrasChave: PALAVRAS_JS,
  constantes: CONSTANTES_JS,
  embutidas: EMBUTIDAS_JS,
  comentarioDeLinha: ['//'],
  comentarioDeBloco: [['/*', '*/']],
  strings: [...ASPAS, { abre: '`', fecha: '`', escape: '\\', multilinha: true }],
  ganchos: [regexDeJS, decoradorEJSX],
});

/** `[Atributo]` do C# no início da linha. */
const atributoCSharp: Gancho = (pLinha, pPos) => {
  if (pLinha[pPos] !== '[' || pLinha.slice(0, pPos).trim() !== '')
    return null;
  const fim = pLinha.indexOf(']', pPos);
  return fim === -1 ? null : { fim: fim + 1, tipo: 'macro' };
};

export const CSHARP = linguagemGenerica({
  nome: 'csharp',
  apelidos: ['cs', 'c#'],
  rotulo: 'C#',
  palavrasChave: [
    'abstract', 'as', 'base', 'break', 'case', 'catch', 'checked', 'class', 'const', 'continue', 'default', 'delegate', 'do', 'else', 'enum', 'event', 'explicit', 'extern', 'finally', 'fixed', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'interface', 'internal', 'is', 'lock', 'namespace', 'new', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sealed', 'sizeof', 'stackalloc', 'static', 'struct', 'switch', 'this', 'throw', 'try', 'typeof', 'unchecked', 'unsafe', 'using', 'virtual', 'volatile', 'while', 'async', 'await', 'var', 'yield', 'get', 'set', 'init', 'value', 'where', 'select', 'from', 'record', 'with', 'nameof', 'when', 'required', 'file', 'global', 'partial', 'dynamic',
  ],
  tipos: ['bool', 'byte', 'sbyte', 'char', 'decimal', 'double', 'float', 'int', 'uint', 'long', 'ulong', 'short', 'ushort', 'object', 'string', 'void', 'nint', 'nuint', 'Boolean', 'Byte', 'Char', 'Decimal', 'Double', 'Single', 'Int16', 'Int32', 'Int64', 'UInt16', 'UInt32', 'UInt64', 'Object', 'String', 'Guid', 'DateTime', 'DateOnly', 'TimeSpan', 'Task', 'List', 'Dictionary', 'IEnumerable', 'IReadOnlyList', 'Exception', 'CancellationToken'],
  constantes: ['true', 'false', 'null'],
  comentarioDeLinha: ['//'],
  comentarioDeBloco: [['/*', '*/']],
  strings: [
    { abre: '@"', fecha: '"', escape: '', multilinha: true },
    { abre: '$"', fecha: '"', escape: '\\' },
    { abre: '"""', fecha: '"""', escape: '', multilinha: true },
    { abre: '"', fecha: '"', escape: '\\' },
    { abre: "'", fecha: "'", escape: '\\' },
  ],
  preprocessador: '#',
  ganchos: [atributoCSharp],
});

export const SQL = linguagemGenerica({
  nome: 'sql',
  apelidos: ['tsql', 'plpgsql', 'postgresql', 'mysql'],
  rotulo: 'SQL',
  ignorarCaixa: true,
  palavrasChave: [
    'select', 'from', 'where', 'and', 'or', 'not', 'in', 'is', 'null', 'like', 'between', 'exists', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'alter', 'drop', 'table', 'index', 'view', 'procedure', 'function', 'trigger', 'database', 'schema', 'primary', 'key', 'foreign', 'references', 'constraint', 'unique', 'default', 'check', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on', 'as', 'group', 'by', 'order', 'having', 'limit', 'offset', 'top', 'distinct', 'union', 'all', 'case', 'when', 'then', 'else', 'end', 'begin', 'commit', 'rollback', 'transaction', 'declare', 'if', 'while', 'return', 'returns', 'with', 'asc', 'desc', 'cast', 'convert', 'over', 'partition', 'window', 'fetch', 'next', 'rows', 'only', 'go', 'use', 'exec', 'execute', 'merge', 'using', 'matched', 'output', 'identity', 'collate', 'truncate', 'grant', 'revoke',
  ],
  tipos: ['int', 'integer', 'bigint', 'smallint', 'tinyint', 'bit', 'decimal', 'numeric', 'float', 'real', 'money', 'char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext', 'date', 'time', 'datetime', 'datetime2', 'datetimeoffset', 'timestamp', 'uniqueidentifier', 'uuid', 'boolean', 'serial', 'bytea', 'varbinary', 'json', 'jsonb', 'xml'],
  constantes: ['true', 'false'],
  embutidas: ['count', 'sum', 'avg', 'min', 'max', 'coalesce', 'isnull', 'nullif', 'getdate', 'now', 'len', 'length', 'upper', 'lower', 'substring', 'trim', 'ltrim', 'rtrim', 'replace', 'concat', 'row_number', 'rank', 'dense_rank', 'newid', 'gen_random_uuid', 'date_trunc', 'extract', 'datediff', 'dateadd', 'format', 'string_agg', 'array_agg'],
  comentarioDeLinha: ['--'],
  comentarioDeBloco: [['/*', '*/']],
  strings: [
    { abre: "'", fecha: "'", escape: "'" },
    { abre: '"', fecha: '"', escape: '' , tipo: 'variavel' },
    { abre: '[', fecha: ']', escape: '', tipo: 'variavel' },
  ],
  variavel: /^@[A-Za-z_][A-Za-z0-9_]*/,
});

export const JSON_ = linguagemGenerica({
  nome: 'json',
  apelidos: ['jsonc', 'json5'],
  rotulo: 'JSON',
  constantes: ['true', 'false', 'null'],
  comentarioDeLinha: ['//'],
  comentarioDeBloco: [['/*', '*/']],
  strings: [{ abre: '"', fecha: '"', escape: '\\' }],
  ganchos: [
    // Chave: string seguida de `:`.
    (pLinha, pPos) => {
      if (pLinha[pPos] !== '"')
        return null;
      const m = /^"(?:[^"\\]|\\.)*"\s*(?=:)/.exec(pLinha.slice(pPos));
      return m ? { fim: pPos + m[0].trimEnd().length, tipo: 'propriedade' } : null;
    },
  ],
});

export const PYTHON = linguagemGenerica({
  nome: 'python',
  apelidos: ['py', 'python3'],
  rotulo: 'Python',
  palavrasChave: ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'match', 'case'],
  tipos: ['int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'bytes', 'object', 'type', 'Any', 'Optional', 'List', 'Dict'],
  constantes: ['True', 'False', 'None', 'self', 'cls'],
  embutidas: ['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'open', 'isinstance', 'super', 'min', 'max', 'sum', 'abs', 'round', 'input', 'format', 'getattr', 'setattr', 'hasattr', 'iter', 'next'],
  comentarioDeLinha: ['#'],
  strings: [
    { abre: '"""', fecha: '"""', escape: '\\', multilinha: true },
    { abre: "'''", fecha: "'''", escape: '\\', multilinha: true },
    { abre: 'f"', fecha: '"', escape: '\\' },
    { abre: "f'", fecha: "'", escape: '\\' },
    { abre: 'r"', fecha: '"', escape: '' },
    { abre: "r'", fecha: "'", escape: '' },
    ...ASPAS,
  ],
  ganchos: [
    (pLinha, pPos) => {
      if (pLinha[pPos] !== '@')
        return null;
      const m = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(pLinha.slice(pPos));
      return m ? { fim: pPos + m[0].length, tipo: 'macro' } : null;
    },
  ],
});

export const SHELL = linguagemGenerica({
  nome: 'shell',
  apelidos: ['sh', 'bash', 'zsh', 'console', 'shell-session'],
  rotulo: 'Shell',
  palavrasChave: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'in', 'function', 'return', 'exit', 'export', 'local', 'readonly', 'source', 'alias', 'set', 'unset', 'shift', 'break', 'continue', 'select', 'time'],
  embutidas: ['echo', 'cd', 'ls', 'cat', 'grep', 'sed', 'awk', 'find', 'xargs', 'curl', 'wget', 'git', 'docker', 'npm', 'npx', 'dotnet', 'node', 'python', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown', 'tar', 'ssh', 'scp', 'sudo', 'printf', 'read', 'test', 'tr', 'sort', 'uniq', 'head', 'tail', 'wc', 'tee', 'make', 'cmake'],
  constantes: ['true', 'false'],
  comentarioDeLinha: ['#'],
  strings: [
    { abre: '"', fecha: '"', escape: '\\', multilinha: true },
    { abre: "'", fecha: "'", escape: '', multilinha: true },
    { abre: '`', fecha: '`', escape: '\\' },
  ],
  variavel: /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9@#?*$!-])/,
  ganchos: [
    // Opção de comando: `-x`, `--longa`.
    (pLinha, pPos, pAnterior) => {
      if (pLinha[pPos] !== '-' || pAnterior === '' && pPos === 0)
        return null;
      const m = /^--?[A-Za-z][A-Za-z0-9-]*/.exec(pLinha.slice(pPos));
      return m && /\s/.test(pLinha[pPos - 1] ?? ' ') ? { fim: pPos + m[0].length, tipo: 'atributo' } : null;
    },
  ],
});

export const POWERSHELL = linguagemGenerica({
  nome: 'powershell',
  apelidos: ['ps1', 'pwsh', 'ps'],
  rotulo: 'PowerShell',
  ignorarCaixa: true,
  palavrasChave: ['if', 'else', 'elseif', 'switch', 'foreach', 'for', 'while', 'do', 'until', 'function', 'param', 'return', 'try', 'catch', 'finally', 'throw', 'begin', 'process', 'end', 'in', 'break', 'continue', 'class', 'enum', 'using', 'filter', 'workflow', 'trap'],
  constantes: ['$true', '$false', '$null'],
  comentarioDeLinha: ['#'],
  comentarioDeBloco: [['<#', '#>']],
  strings: [
    { abre: '@"', fecha: '"@', escape: '`', multilinha: true },
    { abre: "@'", fecha: "'@", escape: '', multilinha: true },
    { abre: '"', fecha: '"', escape: '`' },
    { abre: "'", fecha: "'", escape: "'" },
  ],
  variavel: /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_:]*)/,
  ganchos: [
    (pLinha, pPos) => {
      const m = /^[A-Z][a-z]+-[A-Za-z]+/.exec(pLinha.slice(pPos));
      return m && !/[A-Za-z0-9_]/.test(pLinha[pPos - 1] ?? ' ') ? { fim: pPos + m[0].length, tipo: 'funcao' } : null;
    },
    (pLinha, pPos) => {
      const m = /^-[A-Za-z][A-Za-z0-9]*/.exec(pLinha.slice(pPos));
      return m && /\s/.test(pLinha[pPos - 1] ?? ' ') ? { fim: pPos + m[0].length, tipo: 'atributo' } : null;
    },
  ],
});

export const TEXTO = linguagemGenerica({
  nome: 'texto',
  apelidos: ['text', 'plain', 'txt', 'plaintext', ''],
  rotulo: 'Texto',
  identificador: /^[^\s]+/,
  numero: /^(?!)/,
  operadores: '',
});
