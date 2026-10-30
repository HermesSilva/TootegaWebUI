import { useState, useEffect, useMemo, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, CheckCircle, XCircle } from 'lucide-react';

import { Button } from './Button';
import { Input } from './Input';
import { PasswordStrengthDropdown, evaluatePasswordStrength } from './PasswordStrengthDropdown';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { useAuth, useError } from '@core/hooks';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChangePasswordRequest {
  CurrentPassword: string;
  NewPassword: string;
  ConfirmPassword: string;
}

type ModalState = 'form' | 'success';

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps): JSX.Element | null {
  const { logout } = useAuth();
  const { showError } = useError();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [validationError, setValidationError] = useState('');
  const [zIndex, setZIndex] = useState(0);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Password strength evaluation
  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(newPassword),
    [newPassword]);

  useEffect(() => {
    if (isOpen) {
      setZIndex(ZIndexManager.next());
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setModalState('form');
      setValidationError('');
      setIsPasswordFocused(false);
    }
  }, [isOpen]);

  function validateForm(): boolean {
    if (newPassword !== confirmPassword) {
      setValidationError('As senhas não coincidem.');
      return false;
    }
    if (newPassword.length < 8) {
      setValidationError('A senha é muito curta.');
      return false;
    }
    if (passwordStrength.score < 2) {
      setValidationError('A senha é muito fraca.');
      return false;
    }
    setValidationError('');
    return true;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim())
      return;

    if (!validateForm())
      return;

    setIsLoading(true);

    try {
      const request: ChangePasswordRequest = {
        CurrentPassword: currentPassword,
        NewPassword: newPassword,
        ConfirmPassword: confirmPassword,
      };

      await api.auth.changePassword<void, ChangePasswordRequest>(request);
      setModalState('success');
    } catch (error) {
      showError({ message: mensagemDeFalha(error, 'trocar a senha') });
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose(): void {
    if (modalState !== 'success')
      onClose();
  }

  async function handleSuccessClose(): Promise<void> {
    onClose();
    await logout();
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
              <Lock size={20} className="text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-brand-text-primary">
              {'Alterar senha'}
            </h2>
          </div>
          {modalState === 'form' && (
            <button
              onClick={handleClose}
              className="min-h-touch min-w-touch flex items-center justify-center hover:bg-hover rounded-lg transition-colors"
              aria-label={'Fechar'}
            >
              <X size={20} className="text-brand-text-secondary" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {modalState === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-ui text-brand-text-secondary mb-4">
                {'Atualize a senha de acesso à sua conta.'}
              </p>

              <Input
                type="password"
                label={'Senha atual'}
                data-testid="change-password-current"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={'Digite a sua senha atual'}
                required
                autoFocus
                autoComplete="current-password"
              />

              <Input
                type="password"
                label={'Nova senha'}
                data-testid="change-password-new"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setValidationError(''); }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                placeholder={'Digite a nova senha'}
                required
                autoComplete="new-password"
              />

              {/* Password Strength Indicator */}
              <PasswordStrengthDropdown password={newPassword} isInputFocused={isPasswordFocused} />

              <Input
                type="password"
                label={'Confirmar nova senha'}
                data-testid="change-password-confirm"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setValidationError(''); }}
                placeholder={'Repita a nova senha'}
                required
                error={validationError}
                autoComplete="new-password"
              />

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <div className={`flex items-center gap-2 text-ui-sm -mt-2 ${
                  newPassword === confirmPassword ? 'text-success' : 'text-danger'
                }`}>
                  {newPassword === confirmPassword ? (
                    <>
                      <CheckCircle size={14} />
                      <span>{'As senhas coincidem.'}</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      <span>{'As senhas não coincidem.'}</span>
                    </>
                  )}
                </div>
              )}

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
                  data-testid="change-password-submit"
                  isLoading={isLoading}
                  className="flex-1"
                >
                  {'Alterar senha'}
                </Button>
              </div>
            </form>
          )}

          {modalState === 'success' && (
            <div className="text-center py-4" data-testid="change-password-success">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle size={32} className="text-success" />
              </div>
              <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
                {'Senha alterada'}
              </h3>
              <p className="text-ui text-brand-text-secondary mb-6">
                {'A sua senha foi alterada com sucesso.'}
              </p>
              <Button onClick={handleSuccessClose} data-testid="change-password-success-close" className="w-full">
                {'Sair'}
              </Button>
            </div>
          )}

        </div>
      </XCartaoDeModal>
    </div>,
    document.body
  );
}
