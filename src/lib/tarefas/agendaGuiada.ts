// A agenda de uma tarefa como o EDITOR GUIADO a entende (dono, 2026-11-20): quatro formas, preenchidas só com escolhas,
// nunca digitadas. Toda forma vira um texto que o servidor aceita (o mesmo da XAgenda do Core: "a cada N minutos" ou cron
// de 5 campos), e o texto que o editor gerou volta para a forma. Agenda que não veio do editor (uma expressão escrita à
// mão, de antes) não é forçada a caber: lê-se como nula, e o editor a mostra como personalizada.

/** Os dias da semana como o cron os numera: domingo é 0. */
export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type UnidadeDoIntervalo = 'minutos' | 'horas';

export interface Horario {
  hora: number;
  minuto: number;
}

export type AgendaGuiada =
  | { forma: 'intervalo'; quantidade: number; unidade: UnidadeDoIntervalo }
  | ({ forma: 'diaria' } & Horario)
  | ({ forma: 'semanal'; dias: DiaDaSemana[] } & Horario)
  | ({ forma: 'mensal'; dia: number } & Horario);

/** As quantidades oferecidas em cada unidade: só divisores "redondos", que o operador entende de primeira. */
export const QUANTIDADES: Record<UnidadeDoIntervalo, number[]> = {
  minutos: [1, 2, 5, 10, 15, 20, 30, 45],
  horas: [1, 2, 3, 4, 6, 8, 12],
};

/** O dia do mês vai até 28: todo mês tem, e a tarefa nunca "pula" fevereiro. */
export const ULTIMO_DIA_DO_MES = 28;

/** A ordem dos dias na tela: a semana de trabalho primeiro. */
export const DIAS_NA_TELA: DiaDaSemana[] = [1, 2, 3, 4, 5, 6, 0];

export const DIAS_UTEIS: DiaDaSemana[] = [1, 2, 3, 4, 5];
export const FIM_DE_SEMANA: DiaDaSemana[] = [6, 0];

const NOMES: Record<DiaDaSemana, string> = {
  0: 'domingo', 1: 'segunda-feira', 2: 'terça-feira', 3: 'quarta-feira', 4: 'quinta-feira', 5: 'sexta-feira', 6: 'sábado',
};

const CURTOS: Record<DiaDaSemana, string> = { 0: 'domingo', 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado' };

/** A sigla do dia no botão. */
export const SIGLAS: Record<DiaDaSemana, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

/** O nome do dia, para o leitor de tela e a dica do botão. */
export function nomeDoDia(pDia: DiaDaSemana): string {
  return NOMES[pDia];
}

const dois = (pN: number): string => String(pN).padStart(2, '0');

export function horarioEmTexto(pHorario: Horario): string {
  return `${dois(pHorario.hora)}:${dois(pHorario.minuto)}`;
}

/** Os dias sem repetição e na ordem do cron (domingo primeiro). */
function normalizar(pDias: readonly number[]): DiaDaSemana[] {
  return [...new Set(pDias.map((pD) => (pD === 7 ? 0 : pD)))]
    .filter((pD): pD is DiaDaSemana => Number.isInteger(pD) && pD >= 0 && pD <= 6)
    .sort((pA, pB) => pA - pB);
}

/** O campo "dia da semana" do cron: faixa quando os dias são seguidos (1-5), lista quando não (1,3,5). */
function campoDosDias(pDias: DiaDaSemana[]): string {
  const dias = normalizar(pDias);
  const seguidos = dias.length >= 3 && dias.every((pD, pI) => pI === 0 || pD === dias[pI - 1] + 1);

  return seguidos ? `${dias[0]}-${dias[dias.length - 1]}` : dias.join(',');
}

/** O texto que vai ao servidor. Semanal com os sete dias é o mesmo que todo dia, e sai assim. */
export function paraTexto(pAgenda: AgendaGuiada): string {
  switch (pAgenda.forma) {
    case 'intervalo': {
      const singular = pAgenda.quantidade === 1;
      const unidade = pAgenda.unidade === 'minutos' ? (singular ? 'minuto' : 'minutos') : (singular ? 'hora' : 'horas');
      return `a cada ${pAgenda.quantidade} ${unidade}`;
    }
    case 'diaria':
      return `${pAgenda.minuto} ${pAgenda.hora} * * *`;
    case 'semanal': {
      const dias = normalizar(pAgenda.dias);
      return `${pAgenda.minuto} ${pAgenda.hora} * * ${dias.length === 7 ? '*' : campoDosDias(dias)}`;
    }
    case 'mensal':
      return `${pAgenda.minuto} ${pAgenda.hora} ${pAgenda.dia} * *`;
  }
}

const INTERVALO = /^a\s+cada\s+(\d+)\s+(minutos?|horas?)$/i;
const NUMERO = /^\d{1,2}$/;

function numeroNaFaixa(pTexto: string, pMinimo: number, pMaximo: number): number | null {
  if (!NUMERO.test(pTexto))
    return null;
  const n = Number(pTexto);
  return n >= pMinimo && n <= pMaximo ? n : null;
}

/** "1-5", "1,3,5", "0", "6,0", "7". Passo e outras formas não são do editor: nulo. */
function lerDias(pCampo: string): DiaDaSemana[] | null {
  const dias: number[] = [];

  for (const parte of pCampo.split(',')) {
    const faixa = /^(\d)-(\d)$/.exec(parte);
    if (faixa) {
      const [inicio, fim] = [Number(faixa[1]), Number(faixa[2])];
      if (inicio > fim || fim > 7)
        return null;
      for (let d = inicio; d <= fim; d++)
        dias.push(d);
    } else {
      const dia = numeroNaFaixa(parte, 0, 7);
      if (dia === null)
        return null;
      dias.push(dia);
    }
  }

  const normalizados = normalizar(dias);
  return normalizados.length > 0 ? normalizados : null;
}

/** Lê o texto de volta para a forma do editor; o que o editor não produz é nulo (agenda personalizada). */
export function deTexto(pTexto: string): AgendaGuiada | null {
  const texto = pTexto.trim();
  const intervalo = INTERVALO.exec(texto);

  if (intervalo) {
    const quantidade = Number(intervalo[1]);
    const unidade: UnidadeDoIntervalo = intervalo[2].toLowerCase().startsWith('minuto') ? 'minutos' : 'horas';
    return quantidade > 0 ? { forma: 'intervalo', quantidade, unidade } : null;
  }

  const campos = texto.split(/\s+/);
  if (campos.length !== 5)
    return null;

  const [campoMinuto, campoHora, campoDia, campoMes, campoSemana] = campos;
  const minuto = numeroNaFaixa(campoMinuto, 0, 59);
  const hora = numeroNaFaixa(campoHora, 0, 23);

  if (minuto === null || hora === null || campoMes !== '*')
    return null;

  if (campoDia === '*' && campoSemana === '*')
    return { forma: 'diaria', hora, minuto };

  if (campoDia === '*') {
    const dias = lerDias(campoSemana);
    if (dias === null)
      return null;
    return dias.length === 7 ? { forma: 'diaria', hora, minuto } : { forma: 'semanal', dias, hora, minuto };
  }

  const dia = numeroNaFaixa(campoDia, 1, ULTIMO_DIA_DO_MES);
  return dia !== null && campoSemana === '*' ? { forma: 'mensal', dia, hora, minuto } : null;
}

/** Os dias em português: "de segunda a sexta", "aos sábados e domingos", "toda segunda-feira", "toda semana: …". */
function descreverDias(pDias: DiaDaSemana[]): string {
  const dias = normalizar(pDias);
  const chave = dias.join(',');

  if (dias.length === 7)
    return 'todo dia';
  if (chave === '1,2,3,4,5')
    return 'de segunda a sexta';
  if (chave === '0,6')
    return 'aos sábados e domingos';
  if (dias.length === 1)
    return `${dias[0] === 0 || dias[0] === 6 ? 'todo' : 'toda'} ${NOMES[dias[0]]}`;

  // Na ordem da tela (segunda primeiro), sem artigo: "segunda" e "sábado" não concordam no mesmo artigo.
  const nomes = DIAS_NA_TELA.filter((pD) => dias.includes(pD)).map((pD) => CURTOS[pD]);
  return `toda semana: ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]},`;
}

/** A agenda em português, como o servidor também a descreve na grade. */
export function descrever(pAgenda: AgendaGuiada): string {
  switch (pAgenda.forma) {
    case 'intervalo':
      return paraTexto(pAgenda);
    case 'diaria':
      return `todo dia às ${horarioEmTexto(pAgenda)}`;
    case 'semanal':
      return `${descreverDias(pAgenda.dias)} às ${horarioEmTexto(pAgenda)}`;
    case 'mensal':
      return `todo dia ${pAgenda.dia} do mês às ${horarioEmTexto(pAgenda)}`;
  }
}
