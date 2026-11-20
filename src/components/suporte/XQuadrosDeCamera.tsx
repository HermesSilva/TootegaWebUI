/**
 * XQuadrosDeCamera — as imagens de câmera de uma chamada de suporte: a da outra ponta, quando ela liga a
 * câmera, e a própria, menor e espelhada (como num espelho, que é como a pessoa espera se ver). Sem câmera
 * ligada em nenhum dos lados, não desenha nada. A falha ao ligar a câmera aparece aqui, com o motivo.
 */

import type { JSX } from 'react';
import { TriangleAlert } from 'lucide-react';

import type { CameraDeSuporte } from './useCameraDeSuporte';

interface XQuadrosDeCameraProps {
  camera: CameraDeSuporte;
  /** Como a outra ponta é chamada na legenda: "o atendente", "quem chamou". */
  nomeDaOutraPonta: string;
}

export function XQuadrosDeCamera({ camera, nomeDaOutraPonta }: XQuadrosDeCameraProps): JSX.Element | null {
  if (!camera.ligada && !camera.remotaLigada && !camera.falha)
    return null;

  return (
    <div className="flex items-end gap-2 flex-wrap" data-testid="suporte-quadros-camera">
      {camera.remotaLigada && (
        <figure className="m-0">
          <video
            ref={camera.refRemota} autoPlay playsInline muted data-testid="suporte-camera-remota"
            aria-label={`Câmera de ${nomeDaOutraPonta}`}
            className="h-28 aspect-video bg-black rounded-lg object-cover"
          />
          <figcaption className="text-ui-xs text-brand-text-secondary">{`Câmera de ${nomeDaOutraPonta}`}</figcaption>
        </figure>
      )}
      {camera.ligada && (
        <figure className="m-0">
          <video
            ref={camera.refLocal} autoPlay playsInline muted data-testid="suporte-camera-local"
            aria-label={'A sua câmera, como a outra pessoa a vê (espelhada aqui)'}
            className="h-20 aspect-video bg-black rounded-lg object-cover -scale-x-100"
          />
          <figcaption className="text-ui-xs text-brand-text-secondary">{'Você'}</figcaption>
        </figure>
      )}
      {camera.falha && (
        <p className="flex items-start gap-2 text-ui-sm text-brand-text-primary" role="alert" data-testid="suporte-camera-falha">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>{camera.falha}</span>
        </p>
      )}
    </div>
  );
}
