/**
 * XCartaoDeRegistro — o CARTÃO de um registro (dono, 2026-10-26): a moldura comum dos cartões da área SubAppX. Borda
 * expressiva (traço de 2px no tom de borda cheio, sombra média), cabeçalho numa faixa tingida — o complemento em
 * destaque (o código), o título (o nome), inteiros e sem corte — e o corpo, com o recuo curto do cartão sob medida.
 *
 * Usam-no a lista de cartões (um cartão por registro da consulta) e o formulário de configuração (o registro do
 * contexto, num cartão só): o mesmo molde, para a tela ser uma só. Genérico: não conhece o registro.
 */

import type { JSX, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface XCartaoDeRegistroProps {
  /** O título do cartão (o nome do registro, ou o nome da tela de configuração). */
  titulo: string;
  /** O que vem à frente do título, em destaque (o código). */
  subtitulo?: string;
  icone?: LucideIcon;
  /** O `id` do título, para `aria-labelledby`; sem ele, o cartão leva `aria-label` com o título. */
  idDoTitulo?: string;
  /** Algo à direita do cabeçalho (um Fechar). */
  complemento?: ReactNode;
  /** A chave do registro, para quem procura o cartão. */
  registro?: string;
  className?: string;
  children: ReactNode;
}

export function XCartaoDeRegistro({
  titulo, subtitulo, icone: Icone, idDoTitulo, complemento, registro, className = '', children,
}: XCartaoDeRegistroProps): JSX.Element {
  return (
    <section
      aria-labelledby={idDoTitulo}
      aria-label={idDoTitulo ? undefined : titulo}
      className={`rounded-lg border-2 border-border bg-brand-surface shadow-md overflow-hidden ${className}`}
      data-testid="cartao-do-registro"
      data-registro={registro}
    >
      {/* Código e nome vêm inteiros, numa linha, sem corte (dono, 2026-10-25). Cabeçalho raso: o cartão é sob medida. */}
      <header className="flex items-center gap-2 px-3 py-1.5 bg-hover border-b-2 border-border">
        {Icone && <Icone size={14} className="text-brand-primary shrink-0" aria-hidden="true" />}
        {subtitulo && <span className="text-ui-sm font-semibold text-brand-primary whitespace-nowrap shrink-0">{subtitulo}</span>}
        <h2 id={idDoTitulo} className="text-ui-sm font-semibold text-brand-text-primary whitespace-nowrap shrink-0">{titulo}</h2>
        {complemento && (
          <>
            <div className="flex-1 min-w-[8px]" />
            <div className="shrink-0">{complemento}</div>
          </>
        )}
      </header>

      <div className="px-3 pt-2 pb-2">{children}</div>
    </section>
  );
}
