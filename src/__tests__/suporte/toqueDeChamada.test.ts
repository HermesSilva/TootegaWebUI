/**
 * O toque da chamada de suporte: um trinado duplo gerado na hora, volume baixo. Uma vez (o aviso discreto) ou
 * repetido até mandar parar (a chamada que espera alguém atender). Sem áudio no navegador, ou com a reprodução
 * bloqueada, não toca e não quebra o aviso.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { INTERVALO_DO_TOQUE_MS, NOTAS_DO_TOQUE, iniciarToqueDeChamada, tocarAvisoDeChamada } from '../../lib/suporte/toqueDeChamada';

class ContextoDeMentira {
  static criados: ContextoDeMentira[] = [];

  currentTime = 10;
  state = 'running';
  destination = {};
  osciladores: Array<{ frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  close = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);

  constructor() { ContextoDeMentira.criados.push(this); }

  createOscillator(): unknown {
    const oscilador = {
      type: '', frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(),
      connect: (pNo: unknown) => pNo,
    };

    this.osciladores.push(oscilador);

    return oscilador;
  }

  createGain(): unknown {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (pNo: unknown) => pNo,
    };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  ContextoDeMentira.criados.length = 0;
});

describe('tocarAvisoDeChamada', () => {
  it('sem áudio no navegador, não toca e não lança', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    expect(tocarAvisoDeChamada()).toBe(false);
  });

  it('toca o trinado uma vez (duas rajadas de notas alternadas) e fecha o contexto em seguida', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: (pFn: () => void, pMs: number) => setTimeout(pFn, pMs) });
    vi.stubGlobal('AudioContext', ContextoDeMentira);

    expect(tocarAvisoDeChamada()).toBe(true);

    const [contexto] = ContextoDeMentira.criados;
    // Duas rajadas de 8 pulsos, alternando as duas notas.
    expect(contexto.osciladores).toHaveLength(16);
    expect(contexto.osciladores.slice(0, 4).map((pO) => pO.frequency.value))
      .toEqual([NOTAS_DO_TOQUE[0], NOTAS_DO_TOQUE[1], NOTAS_DO_TOQUE[0], NOTAS_DO_TOQUE[1]]);
    expect(contexto.osciladores[0].start).toHaveBeenCalledWith(10);
    expect(contexto.osciladores[8].start).toHaveBeenCalledWith(10.9);

    vi.advanceTimersByTime(2000);
    expect(contexto.close).toHaveBeenCalledTimes(1);
  });

  it('com a reprodução ainda bloqueada pelo navegador, diz que não tocou', () => {
    vi.stubGlobal('window', { setTimeout: () => 0 });
    vi.stubGlobal('AudioContext', class extends ContextoDeMentira { override state = 'suspended'; });

    expect(tocarAvisoDeChamada()).toBe(false);
  });

  it('falha ao criar o áudio não quebra o aviso', () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('sem dispositivo de áudio'); } });

    expect(tocarAvisoDeChamada()).toBe(false);
  });
});

describe('iniciarToqueDeChamada', () => {
  it('repete o toque até mandar parar; parar fecha o áudio, e parar de novo não faz mal', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setInterval: (pFn: () => void, pMs: number) => setInterval(pFn, pMs),
      clearInterval: (pID: ReturnType<typeof setInterval>) => clearInterval(pID),
    });
    vi.stubGlobal('AudioContext', ContextoDeMentira);

    const parar = iniciarToqueDeChamada();
    const [contexto] = ContextoDeMentira.criados;
    expect(contexto.osciladores).toHaveLength(16);

    vi.advanceTimersByTime(INTERVALO_DO_TOQUE_MS * 2);
    expect(contexto.osciladores).toHaveLength(48);

    parar();
    expect(contexto.close).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INTERVALO_DO_TOQUE_MS * 3);
    expect(contexto.osciladores).toHaveLength(48);

    parar();
    expect(contexto.close).toHaveBeenCalledTimes(1);
  });

  it('com o áudio suspenso pelo navegador, tenta retomá-lo a cada toque', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setInterval: (pFn: () => void, pMs: number) => setInterval(pFn, pMs),
      clearInterval: (pID: ReturnType<typeof setInterval>) => clearInterval(pID),
    });
    vi.stubGlobal('AudioContext', class extends ContextoDeMentira { override state = 'suspended'; });

    const parar = iniciarToqueDeChamada();
    vi.advanceTimersByTime(INTERVALO_DO_TOQUE_MS);
    expect(ContextoDeMentira.criados[0].resume).toHaveBeenCalledTimes(1);
    parar();
  });

  it('sem áudio, ou com falha ao abri-lo, devolve um parar que não faz nada', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => iniciarToqueDeChamada()()).not.toThrow();

    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('sem dispositivo de áudio'); } });
    expect(() => iniciarToqueDeChamada()()).not.toThrow();
  });
});
