import { type JSX, type ChangeEvent } from 'react';

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (pChecked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
}: CheckboxProps): JSX.Element {
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    onChange(e.target.checked);
  }

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="
          w-4 h-4 rounded border border-border bg-brand-surface
          text-brand-primary focus:ring-2 focus:ring-brand-primary focus:ring-offset-0
          cursor-pointer disabled:cursor-not-allowed
          accent-brand-primary
        "
      />
      <span className="text-ui text-brand-text-secondary">{label}</span>
    </label>
  );
}
