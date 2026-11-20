/**
 * toqueDeChamada — o som curto que acompanha o aviso de chamada de suporte recebida: dois tons, como um
 * telefone, gerados na hora (sem arquivo de áudio a baixar).
 *
 * É complemento, nunca o único sinal: o aviso aparece na tela de qualquer jeito. Navegador sem áudio, ou que
 * ainda não deixa a página tocar som (nenhum clique nela desde que abriu), simplesmente não toca.
 */

type ContextoDeAudio = typeof AudioContext;

/** Toca o aviso. Devolve `false` quando o navegador não deixou tocar. */
export function tocarAvisoDeChamada(): boolean {
  const Construtor = (globalThis as { AudioContext?: ContextoDeAudio; webkitAudioContext?: ContextoDeAudio }).AudioContext
    ?? (globalThis as { webkitAudioContext?: ContextoDeAudio }).webkitAudioContext;

  if (!Construtor)
    return false;

  try {
    const contexto = new Construtor();
    const inicio = contexto.currentTime;

    // Dois tons de 0,18 s, com um respiro entre eles; volume baixo, para não assustar.
    [[880, 0], [660, 0.25]].forEach(([frequencia, atraso]) => {
      const oscilador = contexto.createOscillator();
      const volume = contexto.createGain();

      oscilador.type = 'sine';
      oscilador.frequency.value = frequencia;
      volume.gain.setValueAtTime(0.0001, inicio + atraso);
      volume.gain.exponentialRampToValueAtTime(0.12, inicio + atraso + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, inicio + atraso + 0.18);
      oscilador.connect(volume).connect(contexto.destination);
      oscilador.start(inicio + atraso);
      oscilador.stop(inicio + atraso + 0.2);
    });

    window.setTimeout(() => void contexto.close().catch(() => { /* já fechado */ }), 800);

    return contexto.state !== 'suspended';
  } catch {
    return false;
  }
}
