import { useState, useCallback, useRef, useEffect, type JSX } from 'react';

import { X, RotateCcw, Copy, Check, Layers } from 'lucide-react';
import { DEFAULT_CUSTOM_COLORS, TOKEN_GROUPS, TOKEN_LABEL_KEYS, THEME_PRESETS, getCustomThemeColors, saveCustomThemeColors, type ThemeID, type CustomThemeToken } from '@core/lib/themeService';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { useTheme } from '@core/hooks';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

const COPYABLE_THEMES: { id: Exclude<ThemeID, 'custom'>; label: string }[] = [
  { id: 'light',  label: 'Claro' },
  { id: 'cloudy', label: 'Nublado' },
  { id: 'dark',   label: 'Escuro' },
  { id: 'amber',  label: 'Âmbar' },
];

interface ThemeCustomizerProps {
  onClose: () => void;
}

/**
 * Modal panel for editing custom theme colors.
 * Shows grouped color pickers with live preview.
 */
export function ThemeCustomizer({ onClose }: ThemeCustomizerProps): JSX.Element {
  const { changeTheme } = useTheme();
  const [colors, setColors] = useState<Record<CustomThemeToken, string>>(getCustomThemeColors);
  const [copied, setCopied] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [zIndex] = useState(() => ZIndexManager.next());
  const backdropRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Apply custom theme on mount so user sees live preview
  useEffect(() => {
    changeTheme('custom');
  }, []);

  // Live preview: apply colors as they change
  useEffect(() => {
    saveCustomThemeColors(colors);
  }, [colors]);

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    function handleClick(pEvent: MouseEvent): void {
      if (presetsRef.current && !presetsRef.current.contains(pEvent.target as Node))
        setShowPresets(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresets]);

  function handleColorInput(pToken: CustomThemeToken, pValue: string): void {
    setColors(prev => ({ ...prev, [pToken]: pValue }));
  }

  const handleReset = useCallback((): void => {
    setColors({ ...DEFAULT_CUSTOM_COLORS });
  }, []);

  function handleCopyJSON(): void {
    const json = JSON.stringify(colors, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyFromTheme(pThemeID: Exclude<ThemeID, 'custom'>): void {
    setColors({ ...THEME_PRESETS[pThemeID] });
    setShowPresets(false);
  }

  return (
    <div
      ref={backdropRef}
      // Clicar fora não fecha (dono, 2026-10-25, binária): só o botão de fechar.
      style={{ zIndex }}
      className="fixed inset-0 flex items-center justify-center bg-black/40"
    >
      <XCartaoDeModal className="w-full max-w-2xl flex flex-col bg-brand-surface rounded-xl overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted-bg flex-shrink-0">
          <h2 className="text-ui-sm font-semibold text-brand-text-primary">
            {'Tema personalizado'}
          </h2>
          <div className="flex items-center gap-1">
            {/* Copy from theme */}
            <div ref={presetsRef} className="relative">
              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="p-1.5 rounded-md hover:bg-hover transition-colors text-brand-text-muted"
                title={'Copiar de'}
              >
                <Layers size={14} />
              </button>
              {showPresets && (
                <div className="absolute right-0 top-full mt-1 bg-brand-surface rounded-lg shadow-lg border border-border py-1 min-w-[140px] z-50">
                  {COPYABLE_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleCopyFromTheme(theme.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-ui-xs text-left hover:bg-hover text-brand-text-secondary transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-sm border border-border flex-shrink-0"
                        style={{ backgroundColor: THEME_PRESETS[theme.id]['brand-primary'] }}
                      />
                      {theme.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Copy JSON */}
            <button
              type="button"
              onClick={handleCopyJSON}
              className="p-1.5 rounded-md hover:bg-hover transition-colors text-brand-text-muted"
              title={'Copiar JSON'}
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-md hover:bg-hover transition-colors text-brand-text-muted"
              title={'Restaurar'}
            >
              <RotateCcw size={14} />
            </button>
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title={'Fechar'}
              aria-label={'Fechar'}
              className="p-1.5 rounded-md hover:bg-hover transition-colors text-brand-text-muted"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Color groups */}
        <div className="overflow-y-auto max-h-[70vh] px-3 py-2 space-y-3">
          {TOKEN_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-ui-xs font-medium text-brand-text-secondary mb-1">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {group.tokens.map((token) => (
                  <ColorPicker
                    key={token}
                    token={token}
                    label={TOKEN_LABEL_KEYS[token]}
                    value={colors[token]}
                    onInput={handleColorInput}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </XCartaoDeModal>
    </div>
  );
}

/* ────────────────────────────────────────────── */

interface ColorPickerProps {
  token: CustomThemeToken;
  label: string;
  value: string;
  onInput: (pToken: CustomThemeToken, pValue: string) => void;
}

function ColorPicker({ token, label, value, onInput }: ColorPickerProps): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded bg-brand-background border border-border-light">
      <label className="relative w-6 h-6 rounded overflow-hidden border border-border cursor-pointer flex-shrink-0">
        <input
          type="color"
          value={value}
          onInput={(e) => onInput(token, (e.target as HTMLInputElement).value)}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        />
        <span
          className="block w-full h-full"
          style={{ backgroundColor: value }}
        />
      </label>
      <span className="text-[10px] leading-tight text-brand-text-secondary truncate">{label}</span>
    </div>
  );
}
