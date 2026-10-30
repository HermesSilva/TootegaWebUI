import { useState, type JSX } from 'react';
import { Sun, Cloud, Moon, Flame, Palette, Settings2 } from 'lucide-react';

import { useTheme } from '@core/hooks';
import { THEME_OPTIONS, type ThemeID } from '@core/lib/themeService';
import { ThemeCustomizer } from './ThemeCustomizer';

const THEME_META: Record<ThemeID, { icon: typeof Sun; label: string }> = {
  light:  { icon: Sun,     label: 'Claro' },
  cloudy: { icon: Cloud,   label: 'Nublado' },
  dark:   { icon: Moon,    label: 'Escuro' },
  amber:  { icon: Flame,   label: 'Âmbar' },
  custom: { icon: Palette, label: 'Personalizado' },
};

/**
 * Theme selector for the user profile dropdown menu.
 * Shows theme options with icons, highlights the active one.
 * Custom theme includes an edit button to open the color picker.
 */
export function ThemeSelector(): JSX.Element {
  const { currentTheme, changeTheme } = useTheme();
  const [showCustomizer, setShowCustomizer] = useState(false);

  function handleThemeClick(pThemeID: ThemeID): void {
    if (pThemeID === 'custom') {
      changeTheme('custom');
      setShowCustomizer(true);
    } else {
      changeTheme(pThemeID);
    }
  }

  return (
    <>
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-ui-xs text-brand-text-muted mb-2">
          <span>{'Tema'}</span>
        </div>
        <div className="flex flex-col gap-1">
          {THEME_OPTIONS.map((themeID) => {
            const meta = THEME_META[themeID];
            const Icon = meta.icon;
            const isActive = currentTheme === themeID;

            return (
              <div key={themeID} className="flex items-center gap-0">
                <button
                  onClick={() => handleThemeClick(themeID)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-md text-left flex-1
                    transition-colors duration-150
                    ${isActive
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'hover:bg-brand-background text-brand-text-secondary'
                    }
                  `}
                >
                  <Icon size={16} />
                  <span className="text-ui-xs">{meta.label}</span>
                  {isActive && (
                    <span className="ml-auto text-brand-primary">✓</span>
                  )}
                </button>

                {/* Edit button for Custom theme */}
                {themeID === 'custom' && isActive && (
                  <button
                    onClick={() => setShowCustomizer(true)}
                    className="p-2 rounded-md hover:bg-brand-background text-brand-primary transition-colors ml-1"
                    title={'Editar'}
                  >
                    <Settings2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showCustomizer && (
        <ThemeCustomizer onClose={() => setShowCustomizer(false)} />
      )}
    </>
  );
}
