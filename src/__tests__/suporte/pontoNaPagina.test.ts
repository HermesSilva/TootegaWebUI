/**
 * O ponto do vídeo na página de quem chamou, conforme o que ele compartilhou: na aba, o vídeo é a página; na
 * janela do navegador, a página fica abaixo das abas e da barra de endereço, entre as bordas; na tela inteira,
 * a janela está na posição dela na tela. Ponto que cai fora da página não vira gesto.
 */

import { describe, expect, it } from 'vitest';

import {
  geometriaDaJanela, pontoNaPagina, pontoSemTarja, proporcaoDaSuperficie, type GeometriaDaJanela,
} from '../../lib/suporte/controleRemoto';

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

describe('pontoSemTarja', () => {
  it('conteúdo mais estreito que o quadro: tarjas nas laterais, descontadas', () => {
    // Conteúdo 4:3 num quadro 16:9: útil = 0,75 da largura, tarjas de 0,125 de cada lado.
    const quadro = { largura: 1600, altura: 900 };
    const perto = (pReal: { x: number; y: number } | null, pX: number, pY: number): void => {
      expect(pReal).not.toBeNull();
      expect(pReal!.x).toBeCloseTo(pX);
      expect(pReal!.y).toBeCloseTo(pY);
    };

    perto(pontoSemTarja({ x: 0.13, y: 0.3 }, quadro, 4 / 3), 0.00667, 0.3);
    perto(pontoSemTarja({ x: 0.5, y: 0.5 }, quadro, 4 / 3), 0.5, 0.5);
    perto(pontoSemTarja({ x: 0.87, y: 1 }, quadro, 4 / 3), 0.99333, 1);
  });

  it('conteúdo mais largo que o quadro: tarjas em cima e embaixo', () => {
    // Conteúdo 2:1 num quadro 16:9 (1,78): útil = 0,889 da altura.
    const ponto = pontoSemTarja({ x: 0.3, y: 0.5 }, { largura: 1600, altura: 900 }, 2)!;

    expect(ponto.x).toBeCloseTo(0.3);
    expect(ponto.y).toBeCloseTo(0.5);
    expect(pontoSemTarja({ x: 0.3, y: 0.01 }, { largura: 1600, altura: 900 }, 2)).toBeNull();
  });

  it('na tarja não é conteúdo; sem tarja (mesma proporção) ou sem medida, o ponto fica como está', () => {
    expect(pontoSemTarja({ x: 0.05, y: 0.5 }, { largura: 1600, altura: 900 }, 4 / 3)).toBeNull();
    expect(pontoSemTarja({ x: 0.2, y: 0.7 }, { largura: 1600, altura: 900 }, 16 / 9)).toEqual({ x: 0.2, y: 0.7 });
    expect(pontoSemTarja({ x: 0.2, y: 0.7 }, { largura: 0, altura: 0 }, 4 / 3)).toEqual({ x: 0.2, y: 0.7 });
  });

  it('a proporção é a do que foi capturado: página, janela ou tela', () => {
    expect(proporcaoDaSuperficie('browser', JANELA)).toBeCloseTo(984 / 700);
    expect(proporcaoDaSuperficie(undefined, JANELA)).toBeCloseTo(984 / 700);
    expect(proporcaoDaSuperficie('window', JANELA)).toBeCloseTo(1000 / 800);
    expect(proporcaoDaSuperficie('monitor', JANELA)).toBeCloseTo(1920 / 1080);
  });
});
