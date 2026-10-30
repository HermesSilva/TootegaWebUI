import { useState, useRef, useEffect, useCallback, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, ChevronDown, Palette, Mail, Lock, User, Building2 } from 'lucide-react';
import { useAuth, useCompany } from '@core/hooks';
import { ThemeSelector } from './ThemeSelector';
import { ChangeEmailModal } from './ChangeEmailModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { MyAccountModal } from './MyAccountModal';
import { ZIndexManager } from '@core/lib/zIndexManager';

interface AvatarProps {
  onManageDeleted?: () => void;
}

export function Avatar({ onManageDeleted }: AvatarProps): JSX.Element {
  const { user, logout } = useAuth();
  const { openSelector } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  // Accordion: only one section open at a time (null = all closed)
  const [openSection, setOpenSection] = useState<'theme' | null>(null);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showMyAccountModal, setShowMyAccountModal] = useState(false);
  const [dropdownZIndex, setDropdownZIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Accordion toggle: close current if clicked again, otherwise switch
  function toggleSection(pSection: 'theme'): void {
    setOpenSection((prev) => prev === pSection ? null : pSection);
  }

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      )
        setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  async function handleLogout(): Promise<void> {
    setIsOpen(false);
    await logout();
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="relative" data-tour="app-avatar">
      <button
        ref={buttonRef}
        data-testid="avatar-trigger"
        onClick={() => {
          if (!isOpen) setDropdownZIndex(ZIndexManager.next());
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-background transition-colors duration-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-ui-xs font-medium">{initials}</span>
        </div>
        <span className="text-ui text-brand-text-primary hidden sm:block whitespace-nowrap">
          {user?.name || 'Usuário'}
        </span>
        <ChevronDown 
          size={14} 
          className={`text-brand-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-64 bg-brand-surface rounded-lg shadow-lg border border-border-light py-1" 
          style={{ zIndex: dropdownZIndex, top: dropdownPosition.top, right: dropdownPosition.right }}
        >
          {/* User Info */}
          <div className="px-3 py-2 border-b border-border-light">
            <p className="text-ui font-medium text-brand-text-primary truncate">{user?.name}</p>
            <p className="text-ui-xs text-brand-text-muted truncate">{user?.email}</p>
          </div>

          {/* Theme Settings (Accordion) */}
          <div className="border-b border-border-light">
            <button
              onClick={() => toggleSection('theme')}
              className="dropdown-item w-full justify-between"
            >
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-brand-text-secondary" />
                <span>{'Tema'}</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-brand-text-secondary transition-transform duration-200 ${openSection === 'theme' ? 'rotate-180' : ''}`}
              />
            </button>

            {openSection === 'theme' && (
              <ThemeSelector />
            )}
          </div>

          {/* Empresa corrente */}
          <button
            data-testid="menu-select-company"
            onClick={() => { setIsOpen(false); openSelector(); }}
            className="dropdown-item"
          >
            <Building2 size={16} className="text-brand-text-secondary" />
            <span>{'Selecionar empresa'}</span>
          </button>

          {/* My Account */}
          <button
            onClick={() => { setIsOpen(false); setShowMyAccountModal(true); }}
            className="dropdown-item"
          >
            <User size={16} className="text-brand-text-secondary" />
            <span>{'Minha conta'}</span>
          </button>

          {/* Account Settings */}
          <div className="border-t border-border-light">
            <button
              data-testid="menu-change-email"
              onClick={() => { setIsOpen(false); setShowChangeEmailModal(true); }}
              className="dropdown-item"
            >
              <Mail size={16} className="text-brand-text-secondary" />
              <span>{'Alterar e-mail'}</span>
            </button>
            <button
              data-testid="menu-change-password"
              onClick={() => { setIsOpen(false); setShowChangePasswordModal(true); }}
              className="dropdown-item"
            >
              <Lock size={16} className="text-brand-text-secondary" />
              <span>{'Alterar senha'}</span>
            </button>
          </div>
          
          {/* Logout */}
          <button
            data-testid="menu-logout"
            onClick={handleLogout}
            className="dropdown-item text-danger hover:bg-danger/10"
          >
            <LogOut size={16} />
            <span>{'Sair'}</span>
          </button>
        </div>,
        document.body
      )}

      {/* Modals */}
      <ChangeEmailModal 
        isOpen={showChangeEmailModal} 
        onClose={() => setShowChangeEmailModal(false)} 
      />
      <ChangePasswordModal 
        isOpen={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)} 
      />
      <MyAccountModal
        isOpen={showMyAccountModal}
        onClose={() => setShowMyAccountModal(false)}
        onManageDeleted={onManageDeleted}
      />
    </div>
  );
}
