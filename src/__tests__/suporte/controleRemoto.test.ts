import { describe, expect, it } from 'vitest';

import {
  lerAviso, lerGesto, lerPedido,pontoNaJanela, pontoNoVideo, serializarGesto, teclaEscreve, textoAposTecla,
} from '@core/lib/suporte/controleRemoto';
import {
  formatarDuracao, formatarEspera, formatarEstimativa, politicaDoNavegador, servidoresDoNavegador,
} from '@core/lib/suporte/tipos';

/**
 * A parte pura do controle remoto do suporte: a conta que leva o ponteiro do atendente, sobre o vídeo, a
 * um ponto da tela de quem chamou, e a conferência de tudo o que chega pelo canal de dados antes de virar
 * gesto na página de alguém.
 */
describe('pontoNoVideo — do ponteiro sobre o vídeo ao ponto da tela', () => {
  const caixa = { left: 100, top: 50, width: 800, height: 600 };

  it('com a mesma proporção, o vídeo ocupa a caixa inteira', () => {
    expect(pontoNoVideo(100, 50, caixa, 1600, 1200)).toEqual({ x: 0, y: 0 });
    expect(pontoNoVideo(900, 650, caixa, 1600, 1200)).toEqual({ x: 1, y: 1 });
    expect(pontoNoVideo(500, 350, caixa, 1600, 1200)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('tela mais larga que a caixa: desconta as faixas de cima e de baixo', () => {
    // 1600x600 numa caixa 800x600 ⇒ escala 0,5, imagem 800x300, faixas de 150 px em cima e embaixo.
    expect(pontoNoVideo(100, 200, caixa, 1600, 600)).toEqual({ x: 0, y: 0 });
    expect(pontoNoVideo(500, 350, caixa, 1600, 600)).toEqual({ x: 0.5, y: 0.5 });
    expect(pontoNoVideo(500, 199, caixa, 1600, 600)).toBeNull();
    expect(pontoNoVideo(500, 501, caixa, 1600, 600)).toBeNull();
  });

  it('tela mais alta que a caixa: desconta as faixas dos lados', () => {
    // 600x1200 numa caixa 800x600 ⇒ escala 0,5, imagem 300x600, faixas de 250 px de cada lado.
    expect(pontoNoVideo(350, 50, caixa, 600, 1200)).toEqual({ x: 0, y: 0 });
    expect(pontoNoVideo(349, 300, caixa, 600, 1200)).toBeNull();
    expect(pontoNoVideo(651, 300, caixa, 600, 1200)).toBeNull();
  });

  it('sem imagem ou sem caixa, não há ponto', () => {
    expect(pontoNoVideo(500, 350, caixa, 0, 0)).toBeNull();
    expect(pontoNoVideo(500, 350, { ...caixa, width: 0 }, 1600, 1200)).toBeNull();
  });
});

describe('pontoNaJanela — o ponto normalizado em pixels da janela de quem chamou', () => {
  it('escala pelo tamanho da janela', () => {
    expect(pontoNaJanela({ x: 0.5, y: 0.25 }, 1000, 800)).toEqual({ x: 500, y: 200 });
  });

  it('a borda direita e a de baixo ficam DENTRO da janela', () => {
    expect(pontoNaJanela({ x: 1, y: 1 }, 1000, 800)).toEqual({ x: 999, y: 799 });
    expect(pontoNaJanela({ x: 0, y: 0 }, 1000, 800)).toEqual({ x: 0, y: 0 });
  });

  it('janela sem tamanho não produz coordenada negativa', () => {
    expect(pontoNaJanela({ x: 0.5, y: 0.5 }, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('lerGesto — só gesto bem formado vira ação', () => {
  it('lê de volta o que serializarGesto escreveu', () => {
    const gestos = [
      { t: 'mover', x: 0.1, y: 0.2 },
      { t: 'pressionar', x: 0.3, y: 0.4, b: 0 },
      { t: 'soltar', x: 0.3, y: 0.4, b: 2 },
      { t: 'rolar', x: 0.5, y: 0.5, dx: 0, dy: 120 },
      { t: 'tecla', k: 'a', ctrl: false, shift: true, alt: false },
    ] as const;

    for (const gesto of gestos)
      expect(lerGesto(serializarGesto(gesto))).toEqual(gesto);
  });

  it('recusa texto que não é JSON, tipo desconhecido e o que não é objeto', () => {
    expect(lerGesto('isto não é JSON')).toBeNull();
    expect(lerGesto('null')).toBeNull();
    expect(lerGesto('"mover"')).toBeNull();
    expect(lerGesto('{"t":"executar","codigo":"alert(1)"}')).toBeNull();
  });

  it('recusa coordenada fora de 0 a 1, não numérica ou ausente', () => {
    expect(lerGesto('{"t":"mover","x":1.2,"y":0.5}')).toBeNull();
    expect(lerGesto('{"t":"mover","x":-0.1,"y":0.5}')).toBeNull();
    expect(lerGesto('{"t":"mover","x":"0.5","y":0.5}')).toBeNull();
    expect(lerGesto('{"t":"pressionar","x":0.5,"b":0}')).toBeNull();
  });

  it('recusa botão que não existe', () => {
    expect(lerGesto('{"t":"pressionar","x":0.5,"y":0.5,"b":7}')).toBeNull();
  });

  it('limita a rolagem de um gesto', () => {
    expect(lerGesto('{"t":"rolar","x":0.5,"y":0.5,"dx":0,"dy":999999}')).toEqual({ t: 'rolar', x: 0.5, y: 0.5, dx: 0, dy: 2000 });
    expect(lerGesto('{"t":"rolar","x":0.5,"y":0.5,"dx":-999999,"dy":0}')).toEqual({ t: 'rolar', x: 0.5, y: 0.5, dx: -2000, dy: 0 });
    expect(lerGesto('{"t":"rolar","x":0.5,"y":0.5,"dx":0}')).toBeNull();
  });

  it('recusa tecla sem nome ou com nome longo demais, e trata modificador ausente como solto', () => {
    expect(lerGesto('{"t":"tecla","k":""}')).toBeNull();
    expect(lerGesto(`{"t":"tecla","k":"${'x'.repeat(25)}"}`)).toBeNull();
    expect(lerGesto('{"t":"tecla","k":"Enter"}')).toEqual({ t: 'tecla', k: 'Enter', ctrl: false, shift: false, alt: false });
  });
});

describe('lerAviso — o que quem chamou devolve ao atendente', () => {
  it('lê o bloqueio por senha e o por gesto do usuário', () => {
    expect(lerAviso(serializarGesto({ t: 'bloqueio', motivo: 'senha' }))).toEqual({ t: 'bloqueio', motivo: 'senha' });
    expect(lerAviso(serializarGesto({ t: 'bloqueio', motivo: 'usuario' }))).toEqual({ t: 'bloqueio', motivo: 'usuario' });
  });

  it('ignora motivo desconhecido, gesto e texto solto', () => {
    expect(lerAviso('{"t":"bloqueio","motivo":"outro"}')).toBeNull();
    expect(lerAviso('{"t":"mover","x":0.1,"y":0.2}')).toBeNull();
    expect(lerAviso('null')).toBeNull();
    expect(lerAviso('texto')).toBeNull();
  });
});

describe('lerPedido — o atendente pede o painel de quem chamou recolhido e no topo', () => {
  it('lê o pedido; gesto, aviso e texto solto não são pedido', () => {
    expect(lerPedido(serializarGesto({ t: 'recolherPainel' }))).toEqual({ t: 'recolherPainel' });
    expect(lerPedido('{"t":"mover","x":0.1,"y":0.2}')).toBeNull();
    expect(lerPedido('{"t":"bloqueio","motivo":"senha"}')).toBeNull();
    expect(lerPedido('null')).toBeNull();
    expect(lerPedido('texto')).toBeNull();
    // E o pedido não passa por gesto: o reprodutor nunca o vê.
    expect(lerGesto('{"t":"recolherPainel"}')).toBeNull();
  });
});

describe('textoAposTecla — o que uma tecla faz ao texto de um campo', () => {
  const tecla = (k: string, ctrl = false, alt = false) => ({ k, ctrl, alt });

  it('caractere entra na posição do cursor', () => {
    expect(textoAposTecla('casa', 2, 2, tecla('x'))).toEqual({ texto: 'caxsa', cursor: 3 });
    expect(textoAposTecla('', 0, 0, tecla('é'))).toEqual({ texto: 'é', cursor: 1 });
  });

  it('caractere substitui o trecho selecionado, em qualquer sentido da seleção', () => {
    expect(textoAposTecla('casa', 1, 3, tecla('o'))).toEqual({ texto: 'coa', cursor: 2 });
    expect(textoAposTecla('casa', 3, 1, tecla('o'))).toEqual({ texto: 'coa', cursor: 2 });
  });

  it('Backspace apaga o caractere antes do cursor, ou a seleção', () => {
    expect(textoAposTecla('casa', 2, 2, tecla('Backspace'))).toEqual({ texto: 'csa', cursor: 1 });
    expect(textoAposTecla('casa', 1, 3, tecla('Backspace'))).toEqual({ texto: 'ca', cursor: 1 });
    expect(textoAposTecla('casa', 0, 0, tecla('Backspace'))).toBeNull();
  });

  it('Delete apaga o caractere depois do cursor, ou a seleção', () => {
    expect(textoAposTecla('casa', 2, 2, tecla('Delete'))).toEqual({ texto: 'caa', cursor: 2 });
    expect(textoAposTecla('casa', 0, 4, tecla('Delete'))).toEqual({ texto: '', cursor: 0 });
    expect(textoAposTecla('casa', 4, 4, tecla('Delete'))).toBeNull();
  });

  it('tecla de comando e atalho não mudam o texto', () => {
    expect(textoAposTecla('casa', 2, 2, tecla('ArrowLeft'))).toBeNull();
    expect(textoAposTecla('casa', 2, 2, tecla('Enter'))).toBeNull();
    expect(textoAposTecla('casa', 2, 2, tecla('a', true))).toBeNull();
    expect(textoAposTecla('casa', 2, 2, tecla('Backspace', false, true))).toBeNull();
  });

  it('cursor fora do texto é trazido para dentro', () => {
    expect(textoAposTecla('ab', 99, 99, tecla('c'))).toEqual({ texto: 'abc', cursor: 3 });
  });
});

describe('teclaEscreve', () => {
  it('um caractere sem Ctrl nem Alt escreve; o resto comanda', () => {
    expect(teclaEscreve({ k: 'a', ctrl: false, alt: false })).toBe(true);
    expect(teclaEscreve({ k: ' ', ctrl: false, alt: false })).toBe(true);
    expect(teclaEscreve({ k: 'a', ctrl: true, alt: false })).toBe(false);
    expect(teclaEscreve({ k: 'Enter', ctrl: false, alt: false })).toBe(false);
  });
});

describe('formatarEspera e servidoresDoNavegador', () => {
  it('formata a espera em minutos e segundos', () => {
    expect(formatarEspera(300)).toBe('05:00');
    expect(formatarEspera(61)).toBe('01:01');
    expect(formatarEspera(9.9)).toBe('00:09');
    expect(formatarEspera(-5)).toBe('00:00');
    expect(formatarEspera(Number.NaN)).toBe('00:00');
  });

  it('a espera estimada não promete mais do que sabe', () => {
    expect(formatarEstimativa(0)).toBe('em instantes');
    expect(formatarEstimativa(-10)).toBe('em instantes');
    expect(formatarEstimativa(Number.NaN)).toBe('em instantes');
    expect(formatarEstimativa(1)).toBe('cerca de 1 minuto');
    expect(formatarEstimativa(60)).toBe('cerca de 1 minuto');
    expect(formatarEstimativa(61)).toBe('cerca de 2 minutos');
    expect(formatarEstimativa(600)).toBe('cerca de 10 minutos');
  });

  it('a duração do atendimento sai em segundos, minutos ou horas', () => {
    expect(formatarDuracao(0)).toBe('0 s');
    expect(formatarDuracao(42)).toBe('42 s');
    expect(formatarDuracao(420)).toBe('7 min');
    expect(formatarDuracao(3900)).toBe('1 h 05 min');
    expect(formatarDuracao(-5)).toBe('0 s');
  });

  it('STUN vai sem credencial, TURN com a temporária, e servidor sem endereço é descartado', () => {
    expect(servidoresDoNavegador([
      { urls: ['stun:turn.exemplo.teste:3478'], username: '', credential: '' },
      { urls: ['turn:turn.exemplo.teste:3478?transport=udp'], username: '1735689600:abc', credential: 'segredo-derivado' },
      { urls: [], username: '', credential: '' },
    ])).toEqual([
      { urls: ['stun:turn.exemplo.teste:3478'] },
      { urls: ['turn:turn.exemplo.teste:3478?transport=udp'], username: '1735689600:abc', credential: 'segredo-derivado' },
    ]);
  });

  it('só relay quando o back manda; nos demais casos o navegador tenta a ligação direta', () => {
    const turns = { urls: ['turns:turn.exemplo.teste:41123?transport=tcp'], username: 'u', credential: 'c' };

    expect(politicaDoNavegador([{ ...turns, soRelay: true }])).toBe('relay');
    expect(politicaDoNavegador([{ ...turns, soRelay: false }])).toBe('all');
    expect(politicaDoNavegador([turns])).toBe('all');
    expect(politicaDoNavegador([])).toBe('all');
    // Servidor sem endereço é descartado por `servidoresDoNavegador`: não pode sozinho tirar a ligação direta.
    expect(politicaDoNavegador([{ urls: [], username: '', credential: '', soRelay: true }])).toBe('all');
    // O marcador é do back e não vai ao navegador: `RTCIceServer` não o conhece.
    expect(servidoresDoNavegador([{ ...turns, soRelay: true }])).toEqual([turns]);
  });
});
