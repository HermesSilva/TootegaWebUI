import { describe, expect, it } from 'vitest';

import { execucaoEmCurso, formatarDuracao, juntarLinhas, ultimaOrdem } from '../lib/tarefas/logDaExecucao';
import type { LinhaExecucaoTarefa } from '../lib/tarefas/tipos';

const linha = (pOrdem: number, pTexto = `linha ${pOrdem}`): LinhaExecucaoTarefa => ({ ordem: pOrdem, momento: '2026-11-20T12:00:00Z', texto: pTexto, erro: false });

describe('log da execução de uma tarefa agendada', () => {
  it('junta as linhas novas na ordem, sem repetir a que chegou de novo', () => {
    const juntas = juntarLinhas([linha(1), linha(2)], [linha(2), linha(4), linha(3)]);

    expect(juntas.map((pL) => pL.ordem)).toEqual([1, 2, 3, 4]);
  });

  it('sem linha nova, devolve a mesma lista (a tela não redesenha à toa)', () => {
    const atuais = [linha(1)];

    expect(juntarLinhas(atuais, [])).toBe(atuais);
  });

  it('a próxima pergunta é depois da maior ordem; sem linha, depois de zero', () => {
    expect(ultimaOrdem([linha(3), linha(7), linha(5)])).toBe(7);
    expect(ultimaOrdem([])).toBe(0);
  });

  it('só agendada e em execução ainda mudam', () => {
    expect(execucaoEmCurso(1)).toBe(true);
    expect(execucaoEmCurso(2)).toBe(true);
    expect([3, 4, 5, 6].some(execucaoEmCurso)).toBe(false);
  });

  it('escreve a duração como gente lê', () => {
    expect(formatarDuracao(null)).toBe('—');
    expect(formatarDuracao(350)).toBe('350 ms');
    expect(formatarDuracao(4200)).toBe('4,2 s');
    expect(formatarDuracao(185_000)).toBe('3 min 05 s');
    expect(formatarDuracao(3_720_000)).toBe('1 h 02 min');
  });
});
