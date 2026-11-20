/**
 * XBotaoDeCamera — liga e desliga a câmera numa chamada de suporte. O estado vem no texto e no ícone, não só
 * na cor (WCAG 2.2 AA). Compacto, é só o ícone, e o texto vai para o hint e para o nome acessível.
 */

import type { JSX } from 'react';
import { Loader2, Video, VideoOff } from 'lucide-react';

import type { CameraDeSuporte } from './useCameraDeSuporte';

interface XBotaoDeCameraProps {
  camera: CameraDeSuporte;
  className: string;
  /** Só o ícone; o texto fica no hint (`title`) e no `aria-label`. */
  compacto?: boolean;
}

export function XBotaoDeCamera({ camera, className, compacto = false }: XBotaoDeCameraProps): JSX.Element {
  const icone = camera.ligando
    ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
    : camera.ligada ? <Video className="w-4 h-4" aria-hidden="true" /> : <VideoOff className="w-4 h-4" aria-hidden="true" />;

  const texto = camera.ligando ? 'Ligando a câmera…' : camera.ligada ? 'Câmera ligada' : 'Câmera desligada';
  const dica = camera.ligando ? texto : camera.ligada ? 'Câmera ligada: clique para desligar' : 'Câmera desligada: clique para ligar';

  return (
    <button
      type="button" onClick={() => void camera.alternar()} disabled={camera.ligando} aria-pressed={camera.ligada}
      aria-label={compacto ? dica : undefined} title={compacto ? dica : undefined}
      data-testid="suporte-camera" className={className}
    >
      {icone}
      {!compacto && texto}
    </button>
  );
}
