/**
 * A parte pura do editor de data do motor: a máscara do que se digita, a leitura do texto como data que existe, a
 * escrita do valor como o usuário o lê e a montagem do mês do calendário. Nada disto pode depender de fuso: a data é
 * a dos números digitados, em qualquer máquina.
 */

import { describe, expect, it } from 'vitest';

import {
  dataDeHoje, dataDoValor, dataPorExtenso, diasDoMes, digitacaoCompleta, escreverValor, foraDaFaixa, horaDeAgora,
  horaDoValor, lerDigitado, mascararData, montarData, partesDaData, semanasDoMes, somarDias, somarMeses,
} from '../lib/dataDigitada';

describe('máscara do que se digita', () => {
  it('data: as barras entram sozinhas, só dígito conta e o excesso é descartado', () => {
    expect(mascararData('2', 'data')).toBe('2');
    expect(mascararData('21', 'data')).toBe('21');
    expect(mascararData('211', 'data')).toBe('21/1');
    expect(mascararData('21112026', 'data')).toBe('21/11/2026');
    expect(mascararData('21/11/2026', 'data')).toBe('21/11/2026');
    expect(mascararData('21-11-2026 extra 99', 'data')).toBe('21/11/2026');
    expect(mascararData('abc', 'data')).toBe('');
  });

  it('data e hora e hora: o espaço e os dois-pontos também entram sozinhos', () => {
    expect(mascararData('211120261', 'dataHora')).toBe('21/11/2026 1');
    expect(mascararData('211120261430', 'dataHora')).toBe('21/11/2026 14:30');
    expect(mascararData('14', 'hora')).toBe('14');
    expect(mascararData('143', 'hora')).toBe('14:3');
    expect(mascararData('14305', 'hora')).toBe('14:30');
  });

  it('sabe quando a digitação está completa', () => {
    expect(digitacaoCompleta('21/11/202', 'data')).toBe(false);
    expect(digitacaoCompleta('21/11/2026', 'data')).toBe(true);
    expect(digitacaoCompleta('21/11/2026', 'dataHora')).toBe(false);
    expect(digitacaoCompleta('21/11/2026 14:30', 'dataHora')).toBe(true);
    expect(digitacaoCompleta('14:30', 'hora')).toBe(true);
  });
});

describe('leitura do texto digitado', () => {
  it('lê o que existe, no formato que o formulário guarda', () => {
    expect(lerDigitado('21/11/2026', 'data')).toBe('2026-11-21');
    expect(lerDigitado('29/02/2028', 'data')).toBe('2028-02-29');
    expect(lerDigitado('21/11/2026 08:05', 'dataHora')).toBe('2026-11-21T08:05');
    expect(lerDigitado('23:59', 'hora')).toBe('23:59');
  });

  it('recusa o que não existe ou está pela metade', () => {
    expect(lerDigitado('31/02/2026', 'data')).toBeNull();
    expect(lerDigitado('29/02/2026', 'data')).toBeNull();
    expect(lerDigitado('01/13/2026', 'data')).toBeNull();
    expect(lerDigitado('00/01/2026', 'data')).toBeNull();
    expect(lerDigitado('01/01/0000', 'data')).toBeNull();
    expect(lerDigitado('21/11/202', 'data')).toBeNull();
    expect(lerDigitado('21/11/2026 24:00', 'dataHora')).toBeNull();
    expect(lerDigitado('31/02/2026 10:00', 'dataHora')).toBeNull();
    expect(lerDigitado('12:60', 'hora')).toBeNull();
    expect(lerDigitado('', 'data')).toBeNull();
  });
});

describe('escrita do valor', () => {
  it('escreve como o usuário lê, e valor que não é data vira vazio', () => {
    expect(escreverValor('2026-11-21', 'data')).toBe('21/11/2026');
    expect(escreverValor('2026-11-21T14:30:00', 'data')).toBe('21/11/2026');
    expect(escreverValor('2026-11-21T14:30', 'dataHora')).toBe('21/11/2026 14:30');
    expect(escreverValor('2026-11-21', 'dataHora')).toBe('21/11/2026');
    expect(escreverValor('07:05:59', 'hora')).toBe('07:05');
    expect(escreverValor('', 'data')).toBe('');
    expect(escreverValor('2026-02-31', 'data')).toBe('');
    expect(escreverValor('x', 'hora')).toBe('');
  });

  it('separa a data e a hora de um valor', () => {
    expect(dataDoValor('2026-11-21T14:30')).toBe('2026-11-21');
    expect(dataDoValor('14:30')).toBe('');
    expect(horaDoValor('2026-11-21T14:30')).toBe('14:30');
    expect(horaDoValor('14:30')).toBe('14:30');
    expect(horaDoValor('2026-11-21')).toBe('');
  });

  it('escreve a data por extenso, para o leitor de tela', () => {
    expect(dataPorExtenso('2026-11-21')).toBe('sábado, 21 de novembro de 2026');
    expect(dataPorExtenso('2026-03-01')).toBe('domingo, 1 de março de 2026');
    expect(dataPorExtenso('nada')).toBe('');
  });
});

describe('contas com datas', () => {
  it('monta e desmonta a data pelos números', () => {
    expect(montarData(2026, 3, 9)).toBe('2026-03-09');
    expect(montarData(987, 12, 31)).toBe('0987-12-31');
    expect(partesDaData('2026-11-21T10:00')).toEqual({ ano: 2026, mes: 11, dia: 21 });
    expect(partesDaData('2026-13-01')).toBeNull();
    expect(partesDaData('21/11/2026')).toBeNull();
  });

  it('sabe quantos dias tem cada mês, inclusive fevereiro de ano bissexto e ano de dois dígitos', () => {
    expect(diasDoMes(2026, 2)).toBe(28);
    expect(diasDoMes(2028, 2)).toBe(29);
    expect(diasDoMes(1900, 2)).toBe(28);
    expect(diasDoMes(2000, 2)).toBe(29);
    expect(diasDoMes(2026, 11)).toBe(30);
    expect(diasDoMes(2026, 12)).toBe(31);
    expect(diasDoMes(96, 2)).toBe(29);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarDias('2026-11-21', 7)).toBe('2026-11-28');
    expect(somarDias('nada', 1)).toBe('nada');
  });

  it('soma meses, e o dia que não existe no destino vira o último do mês', () => {
    expect(somarMeses('2026-11-21', 1)).toBe('2026-12-21');
    expect(somarMeses('2026-12-21', 1)).toBe('2027-01-21');
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28');
    expect(somarMeses('2026-11-21', -12)).toBe('2025-11-21');
    expect(somarMeses('0001-01-15', -1)).toBe('0001-01-15');
    expect(somarMeses('9999-12-15', 1)).toBe('9999-12-15');
    expect(somarMeses('nada', 1)).toBe('nada');
  });

  it('compara com a faixa; limite vazio não limita', () => {
    expect(foraDaFaixa('2026-11-21', '2026-11-22')).toBe(true);
    expect(foraDaFaixa('2026-11-21', '2026-11-21', '2026-11-21')).toBe(false);
    expect(foraDaFaixa('2026-11-21', undefined, '2026-11-20')).toBe(true);
    expect(foraDaFaixa('2026-11-21')).toBe(false);
    expect(foraDaFaixa('07:59', '08:00', '18:00')).toBe(true);
    expect(foraDaFaixa('2026-11-21T08:00', '2026-11-21T07:59')).toBe(false);
  });

  it('hoje e agora saem do relógio de quem usa, sem fuso no caminho', () => {
    // 23h50 do dia 21 no relógio local: em UTC já seria dia 22 em boa parte do Brasil, e o campo não pode saber disso.
    const agora = new Date(2026, 10, 21, 23, 50);

    expect(dataDeHoje(agora)).toBe('2026-11-21');
    expect(horaDeAgora(agora)).toBe('23:50');
  });
});

describe('o mês do calendário', () => {
  it('são sempre seis semanas, do domingo ao sábado, completadas com o mês anterior e o seguinte', () => {
    // Novembro de 2026 começa num domingo e termina numa segunda.
    const semanas = semanasDoMes(2026, 11);

    expect(semanas).toHaveLength(6);
    expect(semanas.every((pSemana) => pSemana.length === 7)).toBe(true);
    expect(semanas[0][0]).toEqual({ data: '2026-11-01', dia: 1, doMes: true });
    expect(semanas[4][1]).toEqual({ data: '2026-11-30', dia: 30, doMes: true });
    expect(semanas[4][2]).toEqual({ data: '2026-12-01', dia: 1, doMes: false });
    expect(semanas[5][6]).toEqual({ data: '2026-12-12', dia: 12, doMes: false });
  });

  it('o mês que começa no meio da semana traz o fim do mês anterior na primeira linha', () => {
    // Outubro de 2026 começa numa quinta.
    const semanas = semanasDoMes(2026, 10);

    expect(semanas[0].map((pDia) => pDia.dia)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(semanas[0].map((pDia) => pDia.doMes)).toEqual([false, false, false, false, true, true, true]);
    expect(semanas[0][0].data).toBe('2026-09-27');
  });

  it('janeiro traz dezembro do ano anterior, e dezembro traz janeiro do seguinte', () => {
    expect(semanasDoMes(2027, 1)[0][0].data).toBe('2026-12-27');
    expect(semanasDoMes(2026, 12)[5][6].data).toBe('2027-01-09');
  });
});
