import { useState, useEffect, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { AvisoSpam } from './AvisoSpam';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { useError } from '@core/hooks';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InitiateEmailChangeRequest {
  NewEmail: string;
  CurrentPassword: string;
}

type ModalState = 'form' | 'success';

export function ChangeEmailModal({ isOpen, onClose }: ChangeEmailModalProps): JSX.Element | null {
  const { showError } = useError();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [zIndex, setZIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZIndex(ZIndexManager.next());
      setNewEmail('');
      setCurrentPassword('');
      setModalState('form');
    }
  }, [isOpen]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    
    if (!newEmail.trim() || !currentPassword.trim())
      return;

    setIsLoading(true);

    try {
      const request: InitiateEmailChangeRequest = {
        NewEmail: newEmail.trim(),
        CurrentPassword: currentPassword,
      };

      await api.auth.initiateEmailChange<void, InitiateEmailChangeRequest>(request);
      setModalState('success');
    } catch (error) {
      showError({ message: mensagemDeFalha(error, 'iniciar a troca de e-mail') });
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose(): void {
    onClose();
  }

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <XCartaoDeModal className="bg-brand-surface rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <Mail size={20} className="text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-brand-text-primary">
              {'Alterar e-mail'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="min-h-touch min-w-touch flex items-center justify-center hover:bg-hover rounded-lg transition-colors"
            aria-label={'Fechar'}
          >
            <X size={20} className="text-brand-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {modalState === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-ui text-brand-text-secondary mb-4">
                {'Atualize o e-mail associado à sua conta.'}
              </p>

              <Input
                type="email"
                label={'Novo e-mail'}
                data-testid="change-email-new"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={'novo@exemplo.com'}
                required
                autoFocus
                autoComplete="email"
              />

              <Input
                type="password"
                label={'Senha atual'}
                data-testid="change-email-current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={'Digite a sua senha atual'}
                required
                autoComplete="current-password"
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  className="flex-1"
                >
                  {'Cancelar'}
                </Button>
                <Button
                  type="submit"
                  data-testid="change-email-submit"
                  isLoading={isLoading}
                  className="flex-1"
                >
                  {'Enviar confirmação'}
                </Button>
              </div>
            </form>
          )}

          {modalState === 'success' && (
            <div className="text-center py-4" data-testid="change-email-success">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle size={32} className="text-success" />
              </div>
              <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
                {'E-mail enviado'}
              </h3>
              <p className="text-ui text-brand-text-secondary mb-4">
                {'Enviamos um link de confirmação para o novo endereço.'}
              </p>
              <AvisoSpam className="mb-6" />
              <Button onClick={handleClose} className="w-full">
                {'Fechar'}
              </Button>
            </div>
          )}
        </div>
      </XCartaoDeModal>
    </div>,
    document.body
  );
}
