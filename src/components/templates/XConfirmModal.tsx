/**
 * XConfirmModal — confirmação e aviso do motor genérico.
 *
 * Dois usos, um componente:
 *  - CONFIRMAÇÃO (onCancel definido): pergunta antes de agir. Ex.: "Transmitir esta NFS-e?".
 *  - AVISO (sem onCancel): informa o desfecho de uma ação. Ex.: o que o Fisco respondeu.
 *
 * Vive aqui, e não dentro de um componente específico, porque a ação de linha e a barra de botões
 * precisam do mesmo diálogo — duplicá-lo faria dois estilos divergirem no primeiro ajuste.
 *
 * CONTIDO NA APLICAÇÃO (`inline`, o padrão do XModalShell): este diálogo é de App — nasce de uma ação
 * sobre a grade dela. `overlay` é para o que é genuinamente global (pré-login, conta, erro bloqueante);
 * usá-lo aqui cobria o cabeçalho e o menu do sistema, saindo do padrão dos demais modais (dono,
 * 2026-07-13).
 */

import { useCallback, useState, type JSX } from 'react';
import { AlertTriangle, Check, Copy, Info } from 'lucide-react';
import { XModalShell } from './XModalShell';

interface XConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  /** Ausente ⇒ o diálogo é um AVISO: um botão só, sem pergunta. */
  onCancel?: () => void;
}

export function XConfirmModal({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: XConfirmModalProps): JSX.Element {
  const isConfirmacao = !!onCancel;
  const fechar = onCancel ?? onConfirm;
  const [copiado, setCopiado] = useState(false);

  // Copiar só faz sentido no AVISO (desfecho): é ele que traz protocolo e chave, o que se leva a um
  // chamado. A pergunta de confirmação ("Faturar?") é curta e não ganha o botão.
  const copiar = useCallback(() => {
    navigator.clipboard.writeText(message).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }, [message]);

  return (
    <XModalShell
      size="sm"
      title={title}
      closeLabel={cancelText ?? 'Fechar'}
      onClose={fechar}
      footer={
        <>
          {isConfirmacao && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 sm:py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border
                       hover:bg-hover rounded-lg transition-colors min-h-touch sm:min-h-[36px]"
            >
              {cancelText ?? 'Cancelar'}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="inline-flex items-center gap-2 px-4 py-3 sm:py-2 text-ui font-semibold text-white
                     bg-brand-primary hover:opacity-90 rounded-lg shadow-sm transition-opacity
                     min-h-touch sm:min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="relative flex items-start gap-3.5 px-4 sm:px-6 py-5">
        <span className="w-11 h-11 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0 ring-1 ring-brand-primary/20">
          {isConfirmacao ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </span>

        {/* "Copiar" DISCRETO, colado ao canto superior direito do corpo — só no AVISO. `break-words`
            no texto: protocolo e chave são tokens longos sem espaço, e sem isso vazam da caixa. */}
        {!isConfirmacao && (
          <button
            type="button"
            onClick={copiar}
            className="
              absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded
              text-[11px] text-brand-text-muted
              hover:bg-black/10 hover:text-brand-text-primary
              focus:outline-none focus-visible:ring-1 focus-visible:ring-current
              transition-colors
            "
            title={'Copiar'}
            aria-label={'Copiar'}
          >
            {copiado ? (
              <>
                <Check className="w-3 h-3 text-success" />
                <span className="text-success">{'Copiado'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{'Copiar'}</span>
              </>
            )}
          </button>
        )}

        <p className={`text-ui text-brand-text-secondary leading-relaxed pt-1.5 whitespace-pre-line min-w-0 break-words ${!isConfirmacao ? 'pr-16' : ''}`}>
          {message}
        </p>
      </div>
    </XModalShell>
  );
}
