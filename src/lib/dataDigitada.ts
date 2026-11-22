/**
 * dataDigitada — a parte PURA do editor de data do motor: a máscara do que se digita (`dd/mm/aaaa`, `hh:mm`), a
 * leitura do texto como data de verdade e a montagem do mês para o calendário.
 *
 * O editor é do sistema, e não o do navegador (dono, 2026-11-21): o nativo escreve no formato do idioma do NAVEGADOR
 * (`mm/dd/yyyy` numa tela em português), não segue o tema, e o calendário dele não é da página — não recebe foco pelo
 * controle remoto do suporte nem aparece para o atendente clicar.
 *
 * Três formatos de valor, os mesmos que os campos nativos usavam, para nada mudar em quem consome:
 *   - data        `aaaa-mm-dd`
 *   - data e hora `aaaa-mm-ddThh:mm` (hora local)
 *   - hora        `hh:mm`
 *
 * Nada aqui usa fuso: a data é montada pelos seus números, nunca por `toISOString`, que a deslocaria de dia.
 */

export type TipoDeData = 'data' | 'dataHora' | 'hora';

/** O formato escrito como o usuário o lê: é o texto de exemplo do campo vazio. */
export const FORMATO_DO_TIPO: Record<TipoDeData, string> = {
  data: 'dd/mm/aaaa',
  dataHora: 'dd/mm/aaaa hh:mm',
  hora: 'hh:mm',
};

/** Quantos dígitos completam cada tipo. */
const DIGITOS_DO_TIPO: Record<TipoDeData, number> = { data: 8, dataHora: 12, hora: 4 };

export const NOMES_DOS_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/** Os dias da semana, do domingo ao sábado: a letra do cabeçalho e o nome inteiro (para leitor de tela). */
export const DIAS_DA_SEMANA = [
  { curto: 'dom', nome: 'domingo' }, { curto: 'seg', nome: 'segunda-feira' }, { curto: 'ter', nome: 'terça-feira' },
  { curto: 'qua', nome: 'quarta-feira' }, { curto: 'qui', nome: 'quinta-feira' }, { curto: 'sex', nome: 'sexta-feira' },
  { curto: 'sáb', nome: 'sábado' },
] as const;

const dois = (pNumero: number): string => String(pNumero).padStart(2, '0');

/** `aaaa-mm-dd` a partir dos números (mês de 1 a 12). */
export function montarData(pAno: number, pMes: number, pDia: number): string {
  return `${String(pAno).padStart(4, '0')}-${dois(pMes)}-${dois(pDia)}`;
}

/** Os números de uma data `aaaa-mm-dd` (o que vier depois é ignorado), ou `null` quando ela não existe. */
export function partesDaData(pData: string): { ano: number; mes: number; dia: number } | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(pData);
  if (!partes)
    return null;

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(ano, mes))
    return null;

  return { ano, mes, dia };
}

/** Quantos dias tem o mês (1 a 12) daquele ano. */
export function diasDoMes(pAno: number, pMes: number): number {
  // O Date trata ano de 0 a 99 como 1900+: `setFullYear` não.
  const data = new Date(2000, pMes, 0);

  data.setFullYear(pAno, pMes, 0);

  return data.getDate();
}

/** A data de hoje, no relógio de quem usa: `aaaa-mm-dd`. */
export function dataDeHoje(pAgora: Date = new Date()): string {
  return montarData(pAgora.getFullYear(), pAgora.getMonth() + 1, pAgora.getDate());
}

/** A hora de agora, `hh:mm`. */
export function horaDeAgora(pAgora: Date = new Date()): string {
  return `${dois(pAgora.getHours())}:${dois(pAgora.getMinutes())}`;
}

/**
 * Põe a máscara no que foi digitado: só os dígitos contam, e as barras, o espaço e os dois-pontos entram sozinhos,
 * no lugar deles. Dígito além do que o formato comporta é descartado.
 */
export function mascararData(pTexto: string, pTipo: TipoDeData): string {
  const digitos = pTexto.replace(/\D/g, '').slice(0, DIGITOS_DO_TIPO[pTipo]);

  if (pTipo === 'hora')
    return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;

  let texto = digitos.slice(0, 2);

  if (digitos.length > 2)
    texto += `/${digitos.slice(2, 4)}`;
  if (digitos.length > 4)
    texto += `/${digitos.slice(4, 8)}`;
  if (digitos.length > 8)
    texto += ` ${digitos.slice(8, 10)}`;
  if (digitos.length > 10)
    texto += `:${digitos.slice(10, 12)}`;

  return texto;
}

/** O texto já tem todos os dígitos do formato? */
export function digitacaoCompleta(pTexto: string, pTipo: TipoDeData): boolean {
  return pTexto.replace(/\D/g, '').length === DIGITOS_DO_TIPO[pTipo];
}

function lerHoraDosDigitos(pDigitos: string): string | null {
  const hora = Number(pDigitos.slice(0, 2));
  const minuto = Number(pDigitos.slice(2, 4));

  return hora <= 23 && minuto <= 59 ? `${dois(hora)}:${dois(minuto)}` : null;
}

/**
 * Lê o texto digitado (completo) como valor do tipo. `null` quando o que está escrito não existe: 31/02, mês 13,
 * 25:00, ou texto incompleto.
 */
export function lerDigitado(pTexto: string, pTipo: TipoDeData): string | null {
  if (!digitacaoCompleta(pTexto, pTipo))
    return null;

  const digitos = pTexto.replace(/\D/g, '');

  if (pTipo === 'hora')
    return lerHoraDosDigitos(digitos);

  const data = montarData(Number(digitos.slice(4, 8)), Number(digitos.slice(2, 4)), Number(digitos.slice(0, 2)));
  if (!partesDaData(data))
    return null;

  if (pTipo === 'data')
    return data;

  const hora = lerHoraDosDigitos(digitos.slice(8, 12));

  return hora ? `${data}T${hora}` : null;
}

/** O valor do tipo, escrito como o usuário o lê (`21/11/2026`, `21/11/2026 14:30`, `14:30`). Valor inválido ⇒ vazio. */
export function escreverValor(pValor: string, pTipo: TipoDeData): string {
  if (pTipo === 'hora') {
    const hora = /^(\d{2}):(\d{2})/.exec(pValor);

    return hora ? `${hora[1]}:${hora[2]}` : '';
  }

  const partes = partesDaData(pValor);
  if (!partes)
    return '';

  const data = `${dois(partes.dia)}/${dois(partes.mes)}/${String(partes.ano).padStart(4, '0')}`;

  if (pTipo === 'data')
    return data;

  const hora = /T(\d{2}):(\d{2})/.exec(pValor);

  return hora ? `${data} ${hora[1]}:${hora[2]}` : data;
}

/** A parte da data (`aaaa-mm-dd`) de um valor de data ou de data e hora; vazio quando não há. */
export function dataDoValor(pValor: string): string {
  return partesDaData(pValor) ? pValor.slice(0, 10) : '';
}

/** A parte da hora (`hh:mm`) de um valor de data e hora ou de hora; vazio quando não há. */
export function horaDoValor(pValor: string): string {
  const hora = /(?:^|T)(\d{2}):(\d{2})/.exec(pValor);

  return hora ? `${hora[1]}:${hora[2]}` : '';
}

/** A data, deslocada de tantos dias (negativo volta). */
export function somarDias(pData: string, pDias: number): string {
  const partes = partesDaData(pData);
  if (!partes)
    return pData;

  const data = new Date(2000, 0, 1);

  data.setFullYear(partes.ano, partes.mes - 1, partes.dia + pDias);

  return montarData(data.getFullYear(), data.getMonth() + 1, data.getDate());
}

/** A data, deslocada de tantos meses; o dia que não existe no mês de destino (31 em fevereiro) vira o último dele. */
export function somarMeses(pData: string, pMeses: number): string {
  const partes = partesDaData(pData);
  if (!partes)
    return pData;

  const indice = partes.ano * 12 + (partes.mes - 1) + pMeses;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12 + 12) % 12 + 1;

  if (ano < 1 || ano > 9999)
    return pData;

  return montarData(ano, mes, Math.min(partes.dia, diasDoMes(ano, mes)));
}

/**
 * O valor está fora da faixa permitida? Compara como texto, o que vale para os três formatos (todos crescem da
 * esquerda para a direita). Limite vazio não limita.
 */
export function foraDaFaixa(pValor: string, pMinimo?: string, pMaximo?: string): boolean {
  return (!!pMinimo && pValor < pMinimo) || (!!pMaximo && pValor > pMaximo);
}

/** Um dia na grade do calendário. */
export interface DiaDoCalendario {
  /** `aaaa-mm-dd`. */
  data: string;
  dia: number;
  /** É do mês mostrado (e não a sobra do mês anterior ou o começo do seguinte)? */
  doMes: boolean;
}

/**
 * As seis semanas que o calendário mostra para um mês (1 a 12), do domingo ao sábado: os dias do mês e, para
 * completar a primeira e a última semana, os do mês anterior e do seguinte. Sempre seis linhas, para o painel não
 * mudar de altura ao trocar de mês.
 */
export function semanasDoMes(pAno: number, pMes: number): DiaDoCalendario[][] {
  const primeiro = new Date(2000, 0, 1);

  primeiro.setFullYear(pAno, pMes - 1, 1);

  const inicio = somarDias(montarData(pAno, pMes, 1), -primeiro.getDay());
  const semanas: DiaDoCalendario[][] = [];

  for (let semana = 0; semana < 6; semana++) {
    const dias: DiaDoCalendario[] = [];

    for (let dia = 0; dia < 7; dia++) {
      const data = somarDias(inicio, semana * 7 + dia);
      const partes = partesDaData(data)!;

      dias.push({ data, dia: partes.dia, doMes: partes.mes === pMes && partes.ano === pAno });
    }

    semanas.push(dias);
  }

  return semanas;
}

/** A data por extenso, para leitor de tela e hint: "sábado, 21 de novembro de 2026". */
export function dataPorExtenso(pData: string): string {
  const partes = partesDaData(pData);
  if (!partes)
    return '';

  const data = new Date(2000, 0, 1);

  data.setFullYear(partes.ano, partes.mes - 1, partes.dia);

  return `${DIAS_DA_SEMANA[data.getDay()].nome}, ${partes.dia} de ${NOMES_DOS_MESES[partes.mes - 1]} de ${partes.ano}`;
}
