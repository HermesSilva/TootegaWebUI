/**
 * Editor AsciiDoc do Core (dono, 2026-10-28): modelo, parser, serializador, transações, editor de código com
 * realce e a vista WYSIWYG — tudo código da casa. Plano: `Docs/PLANO-editor-asciidoc.md` (no ANVIL).
 */

export * from './modelo/tipos';
export { analisarAsciiDoc, documentoVazio } from './parser/blocos';
export { analisarInline } from './parser/inline';
export { serializarDocumento, serializarInline } from './serializador/serializar';
export { XEditorDeCodigo, type XEditorDeCodigoProps, type PosicaoNoCodigo } from './codigo/XEditorDeCodigo';
export { LINGUAGENS, linguagemPorNome } from './codigo/linguagens';
export { CacheDeTokens } from './codigo/cache';
export type { Linguagem, Token, TipoDeToken } from './codigo/tokens';
export { XEditorAsciiDoc, type XEditorAsciiDocProps } from './XEditorAsciiDoc';
export { XAsciiDocEditor } from './XAsciiDocEditor';
export { XTextoFormatado } from './XTextoFormatado';
export type { ModoDoEditor } from './XBarraDoEditor';
export { DOCUMENTO_DE_EXEMPLO } from './exemplo/documentoDeExemplo';
export { esqueletoDoModelo, avaliarModelo, secoesTravadas, violacaoDoModelo, garantirEspacoDasSecoes, type ModeloDeDocumento, type SecaoDoModelo, type AvaliacaoDoModelo } from './modelo/modeloDeDocumento';
export { MODELOS_DE_EXEMPLO, MODELO_ITEM_DE_TRABALHO, MODELO_DECISAO, MODELO_INCIDENTE } from './exemplo/modelosDeExemplo';
