import { type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormBusy } from '@core/hooks/useFormBusy';

/**
 * Véu de "formulário ocupado": cobre o modal com o indicador de progresso enquanto há trabalho
 * demorado em curso. Dois motivos, e nenhum deles é conhecido por este componente (CE-19):
 *
 * - a GRAVAÇÃO, sinalizada por `isSaving` — ela toca várias tabelas e pode demorar;
 * - o que um EDITOR tenha disparado (FormBusyContext) — a consulta de um documento a um serviço
 *   externo, por exemplo, cuja resposta vai reescrever vários campos do formulário.
 *
 * Enquanto o véu está no ar, o usuário não digita por cima do que está prestes a mudar, nem salva
 * duas vezes.
 */
interface XFormBusyVeilProps {
  /** Verdadeiro durante a gravação (o modal já sabe quando salva). */
  isSaving?: boolean;
}

export function XFormBusyVeil({ isSaving = false }: XFormBusyVeilProps): JSX.Element | null {
  const { isBusy } = useFormBusy();

  if (!isBusy && !isSaving)
    return null;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
      <span className="text-ui text-white/90">{isSaving ? 'Salvando...' : 'Carregando...'}</span>
    </div>
  );
}
