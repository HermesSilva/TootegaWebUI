import type { JSX } from 'react';
import { AlertTriangle } from 'lucide-react';

interface AvisoSpamProps {
  className?: string;
}

// Aviso destacado que acompanha TODA tela que diz ao usuário que um e-mail foi enviado
// (cadastro, reenvio de confirmação, redefinição de senha, troca de e-mail). E-mail transacional
// cai no spam com frequência, e quem não o encontra conclui que o envio falhou — o aviso vive num
// lugar só para que as telas não divirjam no texto nem no destaque.
export function AvisoSpam({ className = '' }: AvisoSpamProps): JSX.Element {
  return (
    <div
      data-testid="aviso-spam"
      role="note"
      className={`flex items-start gap-2 p-3 rounded-lg bg-warning-bg border border-warning/40 text-left ${className}`}
    >
      <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
      <p className="text-ui-sm text-brand-text-primary">
        <strong className="text-warning">{'Não encontrou o e-mail? Confira a caixa de spam.'}</strong>
        {' A mensagem pode ter ido para '}
        <strong>{'spam'}</strong>
        {', '}
        <strong>{'lixo eletrônico'}</strong>
        {' ou para a aba '}
        <strong>{'Promoções'}</strong>
        {'. Se estiver lá, marque-a como "não é spam" para que as próximas cheguem à caixa de entrada.'}
      </p>
    </div>
  );
}
