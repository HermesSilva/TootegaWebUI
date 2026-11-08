/**
 * Editor AsciiDoc do Core (dono, 2026-10-28): modelo, parser, serializador, transações, editor de código com
 * realce e a vista WYSIWYG — tudo código da casa. Plano: `Docs/PLANO-editor-asciidoc.md` (no ANVIL).
 * Desde 2026-10-31 o editor também serve a um hospedeiro fora da web (a extensão do VS Code): textos injetáveis,
 * resolvedor de recursos, acionador de referências, modo controlado e `ref` com comandos.
 */

export * from './modelo/tipos';
export { analisarAsciiDoc, documentoVazio } from './parser/blocos';
export { analisarInline } from './parser/inline';
export { serializarDocumento, serializarInline } from './serializador/serializar';
export { XEditorDeCodigo, type XEditorDeCodigoProps, type XEditorDeCodigoHandle, type PosicaoNoCodigo } from './codigo/XEditorDeCodigo';
export * as edicaoDeTexto from './codigo/edicaoDeTexto';
export type { CursorVirtual } from './wysiwyg/XVistaWYSIWYG';
export { LINGUAGENS, linguagemPorNome } from './codigo/linguagens';
export { CacheDeTokens } from './codigo/cache';
export type { Linguagem, Token, TipoDeToken } from './codigo/tokens';
export { XEditorAsciiDoc, type XEditorAsciiDocProps, type XEditorAsciiDocHandle, type ArmazenamentoDoEditor } from './XEditorAsciiDoc';
export { XAsciiDocEditor } from './XAsciiDocEditor';
export { XTextoFormatado } from './XTextoFormatado';
export type { ModoDoEditor, ComandoDaBarra } from './XBarraDoEditor';
export { XVistaWYSIWYG, type XVistaWYSIWYGProps } from './wysiwyg/XVistaWYSIWYG';
export type { ResolvedorDeRecurso, AcionadorDeReferencia, TipoDeRecurso } from './wysiwyg/contexto';
export { TEXTOS_PADRAO, ContextoDeTextos, fundirTextos, useTextos, f as formatarTexto, type TextosDoEditorAsciiDoc, type TextosParciais } from './textos';
export { DOCUMENTO_DE_EXEMPLO } from './exemplo/documentoDeExemplo';
export { esqueletoDoModelo, avaliarModelo, secoesTravadas, violacaoDoModelo, garantirEspacoDasSecoes, type ModeloDeDocumento, type SecaoDoModelo, type AvaliacaoDoModelo } from './modelo/modeloDeDocumento';
export { MODELOS_DE_EXEMPLO, MODELO_ITEM_DE_TRABALHO, MODELO_DECISAO, MODELO_INCIDENTE } from './exemplo/modelosDeExemplo';
