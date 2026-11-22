import { describe, expect, it } from 'vitest';

import { deTexto, descrever, paraTexto, type AgendaGuiada } from '../lib/tarefas/agendaGuiada';

describe('agenda guiada (editor de horário e repetição das tarefas)', () => {
  it('cada forma vira o texto que o servidor aceita', () => {
    expect(paraTexto({ forma: 'intervalo', quantidade: 30, unidade: 'minutos' })).toBe('a cada 30 minutos');
    expect(paraTexto({ forma: 'intervalo', quantidade: 1, unidade: 'minutos' })).toBe('a cada 1 minuto');
    expect(paraTexto({ forma: 'intervalo', quantidade: 1, unidade: 'horas' })).toBe('a cada 1 hora');
    expect(paraTexto({ forma: 'intervalo', quantidade: 6, unidade: 'horas' })).toBe('a cada 6 horas');
    expect(paraTexto({ forma: 'diaria', hora: 3, minuto: 0 })).toBe('0 3 * * *');
    expect(paraTexto({ forma: 'semanal', dias: [5, 1, 2, 3, 4], hora: 8, minuto: 30 })).toBe('30 8 * * 1-5');
    expect(paraTexto({ forma: 'semanal', dias: [5, 1, 3], hora: 8, minuto: 0 })).toBe('0 8 * * 1,3,5');
    expect(paraTexto({ forma: 'semanal', dias: [6, 0], hora: 9, minuto: 15 })).toBe('15 9 * * 0,6');
    expect(paraTexto({ forma: 'mensal', dia: 1, hora: 4, minuto: 0 })).toBe('0 4 1 * *');
  });

  it('semanal com os sete dias é todo dia, e sai como tal', () => {
    expect(paraTexto({ forma: 'semanal', dias: [0, 1, 2, 3, 4, 5, 6], hora: 6, minuto: 0 })).toBe('0 6 * * *');
  });

  it('o texto que o editor gera volta para a mesma forma', () => {
    const formas: AgendaGuiada[] = [
      { forma: 'intervalo', quantidade: 15, unidade: 'minutos' },
      { forma: 'intervalo', quantidade: 1, unidade: 'horas' },
      { forma: 'diaria', hora: 22, minuto: 45 },
      { forma: 'semanal', dias: [1, 2, 3, 4, 5], hora: 8, minuto: 30 },
      { forma: 'semanal', dias: [0, 3], hora: 12, minuto: 0 },
      { forma: 'mensal', dia: 28, hora: 23, minuto: 55 },
    ];

    for (const forma of formas)
      expect(deTexto(paraTexto(forma))).toEqual(forma);
  });

  it('lê também o que o servidor aceita no mesmo formato: domingo como 7, dias fora de ordem, maiúsculas', () => {
    expect(deTexto('0 6 * * 7')).toEqual({ forma: 'semanal', dias: [0], hora: 6, minuto: 0 });
    expect(deTexto('0 6 * * 5,1')).toEqual({ forma: 'semanal', dias: [1, 5], hora: 6, minuto: 0 });
    expect(deTexto('0 6 * * 0-6')).toEqual({ forma: 'diaria', hora: 6, minuto: 0 });
    expect(deTexto('A cada 2 Horas')).toEqual({ forma: 'intervalo', quantidade: 2, unidade: 'horas' });
  });

  it('o que o editor não produz é personalizada (nula), nunca encaixado à força', () => {
    for (const texto of ['*/10 * * * *', '0,30 8-10 * * *', '0 3 31 * *', '0 3 1 6 *', '0 3 1 * 1', '0 3 * * */2', 'a cada 2 dias', 'a cada 0 minutos', 'qualquer coisa', ''])
      expect(deTexto(texto)).toBeNull();
  });

  it('descreve em português, com as mesmas frases do servidor', () => {
    expect(descrever({ forma: 'intervalo', quantidade: 30, unidade: 'minutos' })).toBe('a cada 30 minutos');
    expect(descrever({ forma: 'diaria', hora: 3, minuto: 0 })).toBe('todo dia às 03:00');
    expect(descrever({ forma: 'semanal', dias: [1, 2, 3, 4, 5], hora: 8, minuto: 30 })).toBe('de segunda a sexta às 08:30');
    expect(descrever({ forma: 'semanal', dias: [0, 6], hora: 9, minuto: 15 })).toBe('aos sábados e domingos às 09:15');
    expect(descrever({ forma: 'semanal', dias: [1], hora: 6, minuto: 0 })).toBe('toda segunda-feira às 06:00');
    expect(descrever({ forma: 'semanal', dias: [6], hora: 6, minuto: 0 })).toBe('todo sábado às 06:00');
    expect(descrever({ forma: 'semanal', dias: [1, 3, 5], hora: 8, minuto: 0 })).toBe('toda semana: segunda, quarta e sexta, às 08:00');
    expect(descrever({ forma: 'semanal', dias: [0, 1, 6], hora: 7, minuto: 0 })).toBe('toda semana: segunda, sábado e domingo, às 07:00');
    expect(descrever({ forma: 'semanal', dias: [0, 1, 2, 3, 4, 5, 6], hora: 7, minuto: 0 })).toBe('todo dia às 07:00');
    expect(descrever({ forma: 'mensal', dia: 1, hora: 4, minuto: 0 })).toBe('todo dia 1 do mês às 04:00');
  });
});
