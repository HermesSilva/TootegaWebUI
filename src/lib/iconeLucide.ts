/**
 * O ícone lucide pelo NOME que o back declara, em kebab-case ("folder-kanban" ⇒ `FolderKanban`). Nome que não exista
 * devolve nulo: quem desenha segue legível pelo texto, sem ícone.
 */

import type { ComponentType } from 'react';
import * as LucideIcons from 'lucide-react';

type IconeLucide = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

export function iconeLucide(pNome: string | null | undefined): IconeLucide | null {
  if (!pNome)
    return null;
  const nome = pNome.split('-').map((pParte) => pParte.charAt(0).toUpperCase() + pParte.slice(1)).join('');
  const icone = (LucideIcons as Record<string, unknown>)[nome];
  // Os ícones do lucide são componentes de função ou `forwardRef` (objeto com `$$typeof`).
  return typeof icone === 'function' || (typeof icone === 'object' && icone !== null && '$$typeof' in icone)
    ? icone as IconeLucide
    : null;
}
