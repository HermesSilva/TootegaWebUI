/**
 * toqueDeChamada — o som da chamada de suporte, gerado na hora (sem arquivo de áudio a baixar).
 *
 * O toque é um trinado duplo, como o de um telefone (dono, 2026-11-19: "altere o som, dos dois, faça um som
 * repetitivo, até que atenda ou caia"): duas rajadas curtas de notas alternadas, repetidas a cada
 * {@link INTERVALO_DO_TOQUE_MS} até quem tocou mandar parar. Vale para o atendente (chamada na fila) e para quem chamou
 * (o atendente retornou o chamado).
 *
 * É complemento, nunca o único sinal: o aviso aparece na tela de qualquer jeito. Navegador sem áudio, ou que ainda não
 * deixa a página tocar som (nenhum clique nela desde que abriu), simplesmente não toca.
 */

type ContextoDeAudio = typeof AudioContext;

/** De quanto em quanto tempo o toque se repete. */
export const INTERVALO_DO_TOQUE_MS = 3000;

/** As duas notas que se alternam no trinado (sol e si), em Hz. */
export const NOTAS_DO_TOQUE = [784, 988] as const;

/** Pulsos de cada rajada, duração de cada pulso e início da segunda rajada, em segundos. */
const PULSOS_POR_RAJADA = 8;
const PULSO = 0.07;
const PASSO = 0.08;
const SEGUNDA_RAJADA = 0.9;
const VOLUME = 0.1;

function construtor(): ContextoDeAudio | undefined {
  return (globalThis as { AudioContext?: ContextoDeAudio }).AudioContext
    ?? (globalThis as { webkitAudioContext?: ContextoDeAudio }).webkitAudioContext;
}

/** Agenda um toque inteiro (as duas rajadas) a partir de agora, no contexto dado. */
function agendarToque(pContexto: AudioContext): void {
  const inicio = pContexto.currentTime;

  [0, SEGUNDA_RAJADA].forEach((pRajada) => {
    for (let i = 0; i < PULSOS_POR_RAJADA; i++) {
      const quando = inicio + pRajada + i * PASSO;
      const oscilador = pContexto.createOscillator();
      const volume = pContexto.createGain();

      oscilador.type = 'sine';
      oscilador.frequency.value = NOTAS_DO_TOQUE[i % 2];
      volume.gain.setValueAtTime(0.0001, quando);
      volume.gain.exponentialRampToValueAtTime(VOLUME, quando + 0.01);
      volume.gain.exponentialRampToValueAtTime(0.0001, quando + PULSO);
      oscilador.connect(volume).connect(pContexto.destination);
      oscilador.start(quando);
      oscilador.stop(quando + PULSO + 0.01);
    }
  });
}

/** Toca o toque UMA vez (o aviso discreto, durante um atendimento). Devolve `false` quando o navegador não deixou tocar. */
export function tocarAvisoDeChamada(): boolean {
  const Construtor = construtor();

  if (!Construtor)
    return false;

  try {
    const contexto = new Construtor();

    agendarToque(contexto);
    window.setTimeout(() => void contexto.close().catch(() => { /* já fechado */ }), 2000);

    return contexto.state !== 'suspended';
  } catch {
    return false;
  }
}

/**
 * Começa a tocar e repete até a função devolvida ser chamada (atendeu, dispensou, ou a chamada caiu). Sem áudio no
 * navegador, devolve uma função que não faz nada. Chamar a função de parar mais de uma vez não faz mal.
 */
export function iniciarToqueDeChamada(): () => void {
  const Construtor = construtor();

  if (!Construtor)
    return () => { /* sem áudio, nada a parar */ };

  let contexto: AudioContext;

  try {
    contexto = new Construtor();
    agendarToque(contexto);
  } catch {
    return () => { /* o áudio não abriu, nada a parar */ };
  }

  const repeticao = window.setInterval(() => {
    try {
      // O navegador pode ter suspendido o áudio (página sem clique): tenta retomar a cada toque.
      if (contexto.state === 'suspended')
        void contexto.resume().catch(() => { /* segue bloqueado */ });
      agendarToque(contexto);
    } catch {
      window.clearInterval(repeticao);
    }
  }, INTERVALO_DO_TOQUE_MS);

  let parado = false;

  return () => {
    if (parado)
      return;
    parado = true;
    window.clearInterval(repeticao);
    void contexto.close().catch(() => { /* já fechado */ });
  };
}
