/**
 * O som do aviso de chamada recebida: dois tons gerados na hora, volume baixo, e o contexto de áudio fechado
 * depois. Sem áudio no navegador, ou com a reprodução bloqueada, não toca e não quebra o aviso.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { tocarAvisoDeChamada } from '../../lib/suporte/toqueDeChamada';

class ContextoDeMentira {
  static criados: ContextoDeMentira[] = [];

  currentTime = 10;
  state = 'running';
  destination = {};
  osciladores: Array<{ frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  close = vi.fn().mockResolvedValue(undefined);

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

  it('toca dois tons, um depois do outro, e fecha o contexto em seguida', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: (pFn: () => void, pMs: number) => setTimeout(pFn, pMs) });
    vi.stubGlobal('AudioContext', ContextoDeMentira);

    expect(tocarAvisoDeChamada()).toBe(true);

    const [contexto] = ContextoDeMentira.criados;
    expect(contexto.osciladores.map((pO) => pO.frequency.value)).toEqual([880, 660]);
    expect(contexto.osciladores[0].start).toHaveBeenCalledWith(10);
    expect(contexto.osciladores[1].start).toHaveBeenCalledWith(10.25);

    vi.advanceTimersByTime(800);
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
