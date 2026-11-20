/**
 * O ponto do vídeo na página de quem chamou, conforme o que ele compartilhou: na aba, o vídeo é a página; na
 * janela do navegador, a página fica abaixo das abas e da barra de endereço, entre as bordas; na tela inteira,
 * a janela está na posição dela na tela. Ponto que cai fora da página não vira gesto.
 */

import { describe, expect, it } from 'vitest';

import { geometriaDaJanela, pontoNaPagina, type GeometriaDaJanela } from '../../lib/suporte/controleRemoto';

// Janela de 1000 × 800, página de 984 × 700: borda de 8 dos lados e embaixo, 92 no alto (abas e endereço).
const JANELA: GeometriaDaJanela = {
  innerWidth: 984, innerHeight: 700, outerWidth: 1000, outerHeight: 800,
  screenX: 100, screenY: 50, telaLargura: 1920, telaAltura: 1080, telaEsquerda: 0, telaTopo: 0,
};

describe('pontoNaPagina', () => {
  it('na aba (ou sem saber o que foi compartilhado), o vídeo é a página', () => {
    expect(pontoNaPagina({ x: 0.5, y: 0.5 }, 'browser', JANELA)).toEqual({ x: 492, y: 350 });
    expect(pontoNaPagina({ x: 0.5, y: 0.5 }, undefined, JANELA)).toEqual({ x: 492, y: 350 });
  });

  it('na janela, desconta a moldura do navegador: as bordas e o alto das abas e do endereço', () => {
    // (0,5 × 1000 − 8, 0,5 × 800 − 92)
    expect(pontoNaPagina({ x: 0.5, y: 0.5 }, 'window', JANELA)).toEqual({ x: 492, y: 308 });
    // O canto de cima da página: logo abaixo da barra de endereço.
    expect(pontoNaPagina({ x: 8 / 1000, y: 92 / 800 }, 'window', JANELA)).toEqual({ x: 0, y: 0 });
  });

  it('na janela, o ponto na barra de abas, na de endereço ou na borda não é da página', () => {
    expect(pontoNaPagina({ x: 0.5, y: 0.05 }, 'window', JANELA)).toBeNull();
    expect(pontoNaPagina({ x: 0.001, y: 0.5 }, 'window', JANELA)).toBeNull();
    expect(pontoNaPagina({ x: 0.5, y: 0.999 }, 'window', JANELA)).toBeNull();
  });

  it('janela maximizada, sem borda: só o alto é descontado', () => {
    const maximizada = { ...JANELA, outerWidth: 984, outerHeight: 780, innerWidth: 984, innerHeight: 700 };

    expect(pontoNaPagina({ x: 0.5, y: 1 - 1 / 780 }, 'window', maximizada)).toEqual({ x: 492, y: 699 });
    expect(pontoNaPagina({ x: 0.5, y: 80 / 780 }, 'window', maximizada)).toEqual({ x: 492, y: 0 });
  });

  it('na tela inteira, a janela está na posição dela; fora dela, não é da página', () => {
    // Página começa na tela em (100 + 8, 50 + 92) = (108, 142).
    expect(pontoNaPagina({ x: 108 / 1920, y: 142 / 1080 }, 'monitor', JANELA)).toEqual({ x: 0, y: 0 });
    expect(pontoNaPagina({ x: 600 / 1920, y: 492 / 1080 }, 'monitor', JANELA)).toEqual({ x: 492, y: 350 });
    expect(pontoNaPagina({ x: 0.01, y: 0.01 }, 'monitor', JANELA)).toBeNull();
  });

  it('na tela inteira de um segundo monitor, conta a partir do canto daquela tela', () => {
    const noSegundo = { ...JANELA, screenX: 2020, telaEsquerda: 1920 };

    expect(pontoNaPagina({ x: 108 / 1920, y: 142 / 1080 }, 'monitor', noSegundo)).toEqual({ x: 0, y: 0 });
  });

  it('lê as medidas da janela; sem medida externa, vale a interna', () => {
    const janela = {
      innerWidth: 800, innerHeight: 600, outerWidth: 0, outerHeight: 0, screenX: 5, screenY: 6,
      screen: { width: 1920, height: 1080, availLeft: 0, availTop: 40 },
    } as unknown as Window;

    expect(geometriaDaJanela(janela)).toEqual({
      innerWidth: 800, innerHeight: 600, outerWidth: 800, outerHeight: 600, screenX: 5, screenY: 6,
      telaLargura: 1920, telaAltura: 1080, telaEsquerda: 0, telaTopo: 40,
    });
  });
});
