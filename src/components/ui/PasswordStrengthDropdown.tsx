import { useState, useMemo, useEffect, useRef, type JSX } from 'react';
import { ChevronDown, Check, Circle, Shield, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  colorClass: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

interface PasswordStrengthDropdownProps {
  password: string;
  className?: string;
  isInputFocused?: boolean;
}

export function evaluatePasswordStrength(pPassword: string): PasswordStrength {
  const checks = {
    length: pPassword.length >= 8,
    uppercase: /[A-Z]/.test(pPassword),
    lowercase: /[a-z]/.test(pPassword),
    number: /[0-9]/.test(pPassword),
    special: /[^A-Za-z0-9]/.test(pPassword),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed <= 1) return { score: 0, label: 'Fraca', color: '#ef4444', colorClass: 'text-danger', checks };
  if (passed === 2) return { score: 1, label: 'Razoável', color: '#f59e0b', colorClass: 'text-warning', checks };
  if (passed === 3) return { score: 2, label: 'Boa', color: '#3b82f6', colorClass: 'text-brand-primary', checks };
  if (passed === 4) return { score: 3, label: 'Forte', color: '#22c55e', colorClass: 'text-success', checks };
  return { score: 4, label: 'Muito forte', color: '#22c55e', colorClass: 'text-success', checks };
}

export function PasswordStrengthDropdown({ password, className = '', isInputFocused = true }: PasswordStrengthDropdownProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const hasPassword = password.length > 0;

  // Control visibility based on password content and focus state
  useEffect(() => {
    if (hasPassword && isInputFocused) {
      setIsVisible(true);
      return undefined;
    }
    if (isInputFocused)
      return undefined;

    // Small delay before hiding to allow focus transitions. O timer é CANCELADO no cleanup: sem isso,
    // um componente desmontado antes dos 150 ms ainda chamava setIsVisible — no CI do ANVIL (2026-10-23)
    // o timer disparava com o jsdom já derrubado ("window is not defined") e derrubava a suíte inteira
    // com todos os testes verdes. Timer vazado é defeito, não detalhe de teste.
    const timer = setTimeout(() => setIsVisible(false), 150);
    return () => clearTimeout(timer);
  }, [hasPassword, isInputFocused]);

  if (!isVisible || !hasPassword) return null;

  const ShieldIcon = strength.score >= 4 ? ShieldCheck 
    : strength.score >= 2 ? Shield 
    : strength.score >= 1 ? ShieldAlert 
    : ShieldX;

  const requirements = [
    { key: 'length', label: 'Pelo menos 8 caracteres', met: strength.checks.length },
    { key: 'uppercase', label: 'Uma letra maiúscula', met: strength.checks.uppercase },
    { key: 'lowercase', label: 'Uma letra minúscula', met: strength.checks.lowercase },
    { key: 'number', label: 'Um número', met: strength.checks.number },
    { key: 'special', label: 'Um caractere especial', met: strength.checks.special },
  ];

  return (
    <div className={`relative ${className}`}>
      <div 
        className="
          absolute top-0 right-0 z-50 w-1/2
          overflow-hidden rounded-lg border border-border-light
          bg-brand-surface/98 backdrop-blur-sm
          shadow-lg shadow-black/10
          transition-all duration-200 ease-out
          animate-in fade-in
        "
        tabIndex={-1}
      >
        {/* Header - Clickable to expand/collapse */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsExpanded(!isExpanded)}
          className="
            w-full flex items-center gap-2 px-2.5 py-1.5
            transition-colors duration-200
            hover:bg-hover cursor-pointer
          "
        >
          {/* Shield Icon with strength color */}
          <div 
            className="flex-shrink-0 transition-colors duration-500"
            style={{ color: strength.color }}
          >
            <ShieldIcon size={14} strokeWidth={2} />
          </div>

          {/* Progress Bar */}
          <div className="flex-1 flex items-center gap-1.5">
            <div className="flex-1 flex gap-0.5 h-1.5">
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className="flex-1 rounded-full bg-border-light overflow-hidden"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: level <= strength.score ? '100%' : '0%',
                      backgroundColor: strength.color,
                      transitionDelay: `${level * 50}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
            <span 
              className="text-[10px] font-semibold whitespace-nowrap transition-colors duration-300"
              style={{ color: strength.color }}
            >
              {strength.label}
            </span>
          </div>

          {/* Expand/Collapse indicator */}
          <ChevronDown 
            size={12} 
            className={`
              text-brand-text-muted transition-transform duration-300
              ${isExpanded ? 'rotate-180' : ''}
            `}
          />
        </button>

        {/* Requirements List - Collapsible */}
        <div
          className="overflow-hidden transition-all duration-200 ease-out"
          style={{ 
            maxHeight: isExpanded ? '150px' : '0px',
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <div 
            ref={contentRef}
            className="px-2.5 pb-2"
          >
            <div className="flex flex-col gap-1">
              {requirements.map((req) => (
                <div
                  key={req.key}
                  className="flex items-center gap-1.5 text-[10px]"
                >
                  <div 
                    className={`
                      flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${req.met 
                        ? 'bg-success/15 text-success' 
                        : 'bg-border-light text-brand-text-muted'
                      }
                    `}
                  >
                    {req.met ? (
                      <Check size={8} strokeWidth={3} />
                    ) : (
                      <Circle size={5} strokeWidth={2} />
                    )}
                  </div>
                  <span 
                    className={`
                      transition-colors duration-300
                      ${req.met ? 'text-success font-medium' : 'text-brand-text-muted'}
                    `}
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
