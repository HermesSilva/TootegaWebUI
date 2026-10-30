/**
 * Formatação centralizada — data, número, moeda e percentual saem daqui, e só daqui.
 *
 * O produto fala pt-BR (dono, 2026-08-03): vírgula decimal, ponto de milhar e dd/MM/yyyy.
 * Ter um lugar só evita que uma tela mostre "1,234.56" e a vizinha "1.234,56".
 *
 * Valor monetário sai SEM o símbolo da moeda (dono, 2026-08-24) — ver `formatCurrency`. Por isso
 * não há mais código de moeda aqui: não existe símbolo a escolher.
 */

/** Locale do produto, para os formatadores do Intl. */
const LOCALE = 'pt-BR';

/** Padrões de data do produto. */
const DATE_FORMATS = { date: 'dd/MM/yyyy', dateTime: 'dd/MM/yyyy HH:mm', time: 'HH:mm' };

/**
 * Locale compatível com o Intl.
 */
export function getIntlLocale(): string {
  return LOCALE;
}

/**
 * Padrão de data do produto.
 */
export function getDateFormat(pType: 'date' | 'dateTime' | 'time' = 'date'): string {
  return DATE_FORMATS[pType];
}

/**
 * Formats a date value according to the current locale
 */
export function formatDate(pValue: unknown, pFormat?: string): string {
  try {
    const date = pValue instanceof Date ? pValue : new Date(String(pValue));

    if (isNaN(date.getTime()))
      return String(pValue);

    // Use Intl.DateTimeFormat for automatic locale formatting if no custom format
    if (!pFormat) {
      return new Intl.DateTimeFormat(getIntlLocale(), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    }

    // Custom format parsing
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours24 >= 12 ? 'PM' : 'AM';

    return pFormat
      .replace('dd', day)
      .replace('MM', month)
      .replace('yyyy', String(year))
      .replace('yy', String(year).slice(-2))
      .replace('HH', hours24.toString().padStart(2, '0'))
      .replace('hh', hours12.toString().padStart(2, '0'))
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('a', ampm);
  } catch {
    return String(pValue);
  }
}

/**
 * Formats a date with time according to the current locale
 */
export function formatDateTime(pValue: unknown, pFormat?: string): string {
  try {
    const date = pValue instanceof Date ? pValue : new Date(String(pValue));

    if (isNaN(date.getTime()))
      return String(pValue);

    if (!pFormat) {
      return new Intl.DateTimeFormat(getIntlLocale(), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }

    return formatDate(pValue, pFormat);
  } catch {
    return String(pValue);
  }
}

/**
 * Ancora uma HORA SOLTA ("10:30", "10:30:00") num dia qualquer, para o `Date` conseguir lê-la.
 *
 * Um campo `Time` do back chega sem data — e `new Date('10:30:00')` é **inválido**, porque o
 * construtor não aceita hora sozinha. O `formatTime` caía no `isNaN` e devolvia a string crua, de
 * modo que toda coluna de hora da grade exibia os SEGUNDOS ("10:30:00") em vez da hora limpa que o
 * `Intl` produz ("10:30"). O dia escolhido é irrelevante: só a hora é formatada.
 *
 * O que já vem com data (ISO completo, `Date`) passa intacto.
 */
function horaSolta(pTexto: string): string {
  return /^\d{1,2}:\d{2}(:\d{2})?(\.\d+)?$/.test(pTexto.trim())
    ? `1970-01-01T${pTexto.trim()}`
    : pTexto;
}

/**
 * Formats a time value according to the current locale
 */
export function formatTime(pValue: unknown, pFormat?: string): string {
  try {
    // A hora solta é ancorada UMA vez e o valor ancorado serve aos dois caminhos: o `Intl` e a
    // máscara. Repassar o `pValue` cru ao `formatDate` deixaria "10:30:00" quebrado justamente
    // quando há formato explícito — o caso do `XTimeEditor`.
    const ancorado = pValue instanceof Date ? pValue : horaSolta(String(pValue));
    const date = ancorado instanceof Date ? ancorado : new Date(ancorado);

    if (isNaN(date.getTime()))
      return String(pValue);

    if (!pFormat) {
      return new Intl.DateTimeFormat(getIntlLocale(), {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }

    return formatDate(ancorado, pFormat);
  } catch {
    return String(pValue);
  }
}

/**
 * Distância até agora, em linguagem de gente: "agora", "há 5 min", "há 3 h", "há 2 d" — e, passada a
 * semana, a data em si, porque "há 43 d" já não diz nada a ninguém.
 *
 * Existe para a lista em que a idade do item é o que ordena a leitura (o inbox do sino): ali, a data
 * cheia em cada linha é ruído, e o que o operador quer saber é se aquilo acabou de acontecer. A data
 * completa continua a um passo, no `title` de quem chama.
 *
 * Data futura — relógio do servidor à frente do da máquina — sai como "agora", e não como "em 3 min":
 * o adiantamento é do relógio, não do fato.
 */
export function formatRelativeTime(pValue: unknown, pAgora: Date = new Date()): string {
  try {
    const date = pValue instanceof Date ? pValue : new Date(String(pValue));

    if (isNaN(date.getTime()))
      return String(pValue);

    const segundos = Math.floor((pAgora.getTime() - date.getTime()) / 1000);

    if (segundos < 60)
      return 'agora';

    const relativo = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: 'always', style: 'narrow' });

    if (segundos < 3600)
      return relativo.format(-Math.floor(segundos / 60), 'minute');

    if (segundos < 86400)
      return relativo.format(-Math.floor(segundos / 3600), 'hour');

    if (segundos < 604800)
      return relativo.format(-Math.floor(segundos / 86400), 'day');

    return formatDate(date);
  } catch {
    return String(pValue);
  }
}

/**
 * Formats a number according to the current locale
 */
export function formatNumber(
  pValue: number,
  pOptions?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: pOptions?.minimumFractionDigits ?? 0,
    maximumFractionDigits: pOptions?.maximumFractionDigits ?? 2,
  }).format(pValue);
}

/**
 * Formats a decimal number according to the current locale
 */
export function formatDecimal(pValue: number, pDecimals = 2): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: pDecimals,
    maximumFractionDigits: pDecimals,
  }).format(pValue);
}

/**
 * Valor monetário formatado — **sem o símbolo da moeda** (dono, 2026-08-24).
 *
 * O "R$" repetido em cada linha é ruído: uma coluna de dinheiro é inteira da mesma moeda, e o que
 * torna a grandeza legível é o alinhamento à direita com casas decimais fixas, não o símbolo colado
 * em cada número. A mesma razão pela qual a declaração das Apps já manda valor como `Decimal` em vez
 * de `Currency` nas grades — esta função apenas passou a obedecer à mesma regra em todo lugar.
 *
 * Duas casas SEMPRE: dinheiro não encolhe para "6,4" nem cresce para "6,4321"; a coluna tem de
 * alinhar na vírgula de cima a baixo.
 *
 * O parâmetro de moeda permanece na assinatura por compatibilidade com quem já a chama, e é
 * deliberadamente ignorado: não há símbolo a escolher. Quando o produto precisar distinguir moedas,
 * o lugar de dizê-lo é o RÓTULO da coluna ("Preço (US$)"), uma vez, e não cada célula.
 */
export function formatCurrency(pValue: number, pCurrencyCode?: string): string {
  void pCurrencyCode;

  return new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pValue);
}

/**
 * Formats a percentage value according to the current locale
 */
export function formatPercentage(pValue: number, pDecimals = 1): string {
  return `${new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: pDecimals,
    maximumFractionDigits: pDecimals,
  }).format(pValue)}%`;
}

/**
 * Formats a phone number (Brazilian format)
 */
export function formatPhone(pValue: string): string {
  const numbers = pValue.replace(/\D/g, '');

  if (numbers.length === 11)
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;

  if (numbers.length === 10)
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;

  return pValue;
}

/**
 * Formats a CPF (Brazilian ID)
 */
export function formatCPF(pValue: string): string {
  const numbers = pValue.replace(/\D/g, '');

  if (numbers.length === 11)
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;

  return pValue;
}

/**
 * Formats a CNPJ (Brazilian Company ID).
 * Aceita o CNPJ ALFANUMÉRICO (formato 2026): 12 posições alfanuméricas + 2 dígitos verificadores.
 */
export function formatCNPJ(pValue: string): string {
  const chars = pValue.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  if (chars.length === 14)
    return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5, 8)}/${chars.slice(8, 12)}-${chars.slice(12)}`;

  return pValue;
}

// ============================================================================
// Documento em DIGITAÇÃO — máscara progressiva
// ============================================================================
//
// `formatDocument` só mascara o documento COMPLETO (11 ou 14 posições), porque é o formatador de
// EXIBIÇÃO. Quem está digitando — ou preenchendo um critério de busca — precisa ver a máscara desde
// a primeira tecla, e é o que as funções abaixo fazem.
//
// Vivem AQUI, e não dentro do XDocumentEditor (onde nasceram), porque o critério de documento do
// diálogo de busca precisa exatamente da mesma máscara: duas cópias dela seriam dois campos de
// documento se comportando diferente na mesma tela (observado em 2026-08-07, no picker de pessoa).

/** Espécie do documento em digitação. `unknown` = ainda não dá para saber. */
export type DocumentType = 'cpf' | 'cnpj' | 'unknown';

/**
 * Sanitiza o documento. Com CNPJ permitido, aceita ALFANUMÉRICO (novo CNPJ 2026: 12 posições
 * alfanuméricas + 2 dígitos verificadores, até 14), sempre em MAIÚSCULAS; senão, só dígitos (CPF).
 */
export function sanitizeDocument(pValue: string, pAllowCNPJ: boolean): string {
  const upper = pValue.toUpperCase();
  return pAllowCNPJ
    ? upper.replace(/[^0-9A-Z]/g, '').slice(0, 14)
    : upper.replace(/\D/g, '').slice(0, 11);
}

/**
 * Detecta o tipo do documento conforme o conteúdo e o que o campo permite. Letra ⇒ CNPJ
 * (só o CNPJ é alfanumérico). Sem letra, decide pelo tamanho (≤11 = CPF).
 */
export function detectDocumentType(pChars: string, pAllowCPF: boolean, pAllowCNPJ: boolean): DocumentType {
  if (!pAllowCNPJ)
    return 'cpf';

  if (!pAllowCPF)
    return 'cnpj';

  if (/[A-Z]/.test(pChars))
    return 'cnpj';

  return pChars.length <= 11 ? 'cpf' : 'cnpj';
}

/** Máscara de CPF, progressiva: XXX.XXX.XXX-XX */
function applyCPFMask(pDigits: string): string {
  const digits = pDigits.slice(0, 11);
  let result = '';

  for (let i = 0; i < digits.length; i++) {
    if (i === 3 || i === 6)
      result += '.';
    else if (i === 9)
      result += '-';

    result += digits[i];
  }

  return result;
}

/** Máscara de CNPJ, progressiva: XX.XXX.XXX/XXXX-XX */
function applyCNPJMask(pDigits: string): string {
  const digits = pDigits.slice(0, 14);
  let result = '';

  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 5)
      result += '.';
    else if (i === 8)
      result += '/';
    else if (i === 12)
      result += '-';

    result += digits[i];
  }

  return result;
}

/**
 * Aplica a máscara conforme o tipo já detectado. As máscaras inserem só separadores, então servem
 * tanto ao CPF numérico quanto ao CNPJ alfanumérico.
 */
export function applyDocumentMask(pChars: string, pType: DocumentType): string {
  if (pType === 'cpf')
    return applyCPFMask(pChars);

  if (pType === 'cnpj')
    return applyCNPJMask(pChars);

  return pChars;
}

/**
 * Máscara de quem está DIGITANDO um documento de espécie desconhecida (CPF ou CNPJ): sanitiza,
 * deduz a espécie pelo que já foi digitado e mascara — tudo em um passo. É o que um campo de busca
 * por documento precisa, onde o valor é parcial por natureza.
 */
export function maskDocumentInput(pValue: string): string {
  const chars = sanitizeDocument(pValue ?? '', true);
  return applyDocumentMask(chars, detectDocumentType(chars, true, true));
}

/**
 * Formats a Brazilian document by length: 11 digits → CPF, 14 alphanumeric → CNPJ (2026 format).
 * Anything else is returned untouched. Use this wherever a document is DISPLAYED and the kind
 * (CPF vs CNPJ) is not known ahead of time — the single source of document formatting in the UI.
 */
export function formatDocument(pValue: string): string {
  if (!pValue) return '';

  // O CNPJ ALFANUMÉRICO é testado PRIMEIRO: `12ABC678000195` tem 14 posições e apenas 11
  // DÍGITOS, de modo que a contagem de dígitos sozinha o confundiria com um CPF e a máscara
  // sairia deformada (`126.780.001-95`). Nenhum CPF tem 14 posições alfanuméricas, então a
  // ordem inversa é segura. Medido em 2026-07-22.
  const chars = pValue.replace(/[^0-9A-Za-z]/g, '');
  if (chars.length === 14)
    return formatCNPJ(pValue);

  const digits = pValue.replace(/\D/g, '');
  if (digits.length === 11)
    return formatCPF(pValue);

  return pValue;
}

/**
 * Formats a CEP (Brazilian Postal Code)
 */
export function formatCEP(pValue: string): string {
  const numbers = pValue.replace(/\D/g, '');

  // Formato adotado pela Tootega: XX.XXX-XXX (ex.: 69.005-070).
  if (numbers.length === 8)
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}-${numbers.slice(5)}`;

  return pValue;
}

/**
 * Formata um código CNAE (Classificação Nacional de Atividades Econômicas). A subclasse tem sete
 * dígitos e se escreve `0000-0/00` (ex.: 6204000 → 6204-0/00); a classe tem cinco e se escreve
 * `0000-0`. Qualquer outro comprimento volta como veio — não se inventa máscara.
 */
export function formatCNAE(pValue: string): string {
  const digitos = (pValue ?? '').replace(/\D/g, '');

  if (digitos.length === 7)
    return `${digitos.slice(0, 4)}-${digitos.slice(4, 5)}/${digitos.slice(5)}`;

  if (digitos.length === 5)
    return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;

  return pValue ?? '';
}

/**
 * Valida um CPF pelos dígitos verificadores. Espelha o backend ValidadorDocumento.CPFValido
 * (defesa em profundidade): confere só os dígitos — não consulta a Receita Federal.
 *
 * Sequência de dígito repetido (111.111.111-11) é recusada: o cálculo do módulo 11 a aprovaria,
 * e ela não é CPF de ninguém.
 */
export function isValidCPF(pValue: string): boolean {
  const d = (pValue ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d))
    return false;

  const check = (weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++)
      sum += parseInt(d[i], 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const dv1 = check([10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = check([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(d[9], 10) === dv1 && parseInt(d[10], 10) === dv2;
}

/**
 * Validates a CNPJ (Brazilian Company ID) by its check digits. Mirrors the backend
 * ValidadorDocumento (defense in depth): only the digits are checked — no Receita lookup.
 */
export function isValidCNPJ(pValue: string): boolean {
  const d = pValue.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d))
    return false;

  const check = (weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++)
      sum += parseInt(d[i], 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const dv1 = check([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = check([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(d[12], 10) === dv1 && parseInt(d[13], 10) === dv2;
}

/**
 * Validates a credit-card number by the Luhn algorithm (13–19 digits). Mirrors the
 * backend CartaoCredito.NumeroValido.
 */
export function isValidCardNumber(pValue: string): boolean {
  const d = pValue.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19)
    return false;

  let sum = 0;
  let alternate = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9)
        n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
