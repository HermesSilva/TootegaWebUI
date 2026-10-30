export { queryClient } from './queryClient';
export { api, getAccessToken, getCurrentCompanyID } from './api';
export type { ApiError, ApiResponse } from './api';
export { errorEmitter } from './errorEmitter';
export { mensagemDeFalha } from './mensagemDeFalha';
export { baseDaApp } from './baseDaApp';
export type { ErrorEvent } from './errorEmitter';
export { lookupLabel } from './lookupLabel';
export { lerModeloApp, gravarModeloApp, descartarVersoesAntigas } from './appModelCache';
export { sincronizarVersaoDoModelo, versaoDoModelo, invalidarModeloEmRecarregamento } from './appModelVersion';
export { safeRandomUUID } from './uuid';
export { getFieldValue } from './fieldAccess';
export { prepararDadosParaGravar, mapaDeEditores } from './prepararDadosParaGravar';
export { isTruthy, isVisible, matchRules, acoesVisiveisNaLinha, abreEmLeitura, linhaMarcadaReadOnly } from './visibility';
export { aplicarValoresDirigidos } from './valueRules';
export { aplicarTotaisAoVivo } from './totaisAoVivo';
export {
  precoDoItemAtivo, precoDoItemInformado, precoDoItemValido, descontoDoPrecoDoItem, precoDoItemExibido,
  mensagemDoPrecoDoItem, errosDoPrecoDoItem,
} from './precoDoItem';
export { ratearDesconto, type LinhaRateavel, type RateioResultado } from './rateioDesconto';
export {
  getIntlLocale,
  getDateFormat,
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatDecimal,
  formatCurrency,
  formatPercentage,
  formatPhone,
  formatCPF,
  formatCNPJ,
  formatDocument,
  sanitizeDocument,
  detectDocumentType,
  applyDocumentMask,
  maskDocumentInput,
  formatCEP,
  formatCNAE,
  isValidCPF,
  isValidCNPJ,
  isValidCardNumber,
} from './formatting';
export type { DocumentType } from './formatting';
export { initDeviceDetection, isMobile, isDesktop, getDeviceType } from './deviceDetection';
export type { DeviceType } from './deviceDetection';
export { initTheme, applyTheme, getStoredTheme, persistThemeToBackend, THEME_OPTIONS } from './themeService';
export type { ThemeID } from './themeService';
export { gridAlignmentClass, isNumericDataType } from './gridAlignment';
export { valoresPadraoDeFiltro, resolverTokenDeFiltro } from './filtroPadrao';
export { valoresPadraoDeFormulario } from './formularioPadrao';
export { CLOSE_BUTTON_STYLE, CLOSE_BUTTON_CLASS } from './closeButtonStyle';
export { XBUTTON_PALETTE, PALETA_POR_ACAO, classeDeCorDoBotao } from './xButtonPalette';
export { fecharDocumento, validarDocumento, FechamentoInvalidoError } from './fechamentoDocumento';
export type {
  FechamentoItemEntrada,
  FechamentoItemResultado,
  FechamentoResultado,
  FechamentoValidacao,
  FechamentoErro,
  FechamentoErroCodigo,
  FechamentoOpcoes,
  OrigemDesconto,
} from './fechamentoDocumento';
export { textoRealcado, paragrafosRealcados } from './textoRealcado';
