/**
 * XStatementEditor — DEMONSTRATIVO (XUIEditorType.Statement = 30, dono 2026-10-25).
 *
 * Desenha uma conta como demonstrativo financeiro: rótulo à esquerda, detalhe discreto e valor alinhados
 * à direita em algarismos tabulares, deduções recuadas com o sinal de menos, e o resultado fechando a
 * conta com traço, em tamanho maior, verde quando positivo e vermelho quando negativo.
 *
 * O valor do campo é a lista de linhas tipadas que o BACK escreveu (`XLinhaDemonstrativo`); o editor não
 * sabe de que conta se trata — preço, pedido, título —, só como cada estilo se desenha (CE-19). Só leitura
 * por natureza: é o resultado de uma conta, não campo de digitação. A altura é a do conteúdo, sem rolagem
 * própria: um demonstrativo cortado esconde justamente o resultado, que vem por último.
 */

import type { JSX } from 'react';
import { AlertTriangle } from 'lucide-react';

import type { XDataEditor, XLinhaDemonstrativo } from '@core/types';
import { XEstiloLinhaDemonstrativo } from '@core/types';
import { formatDecimal } from '@core/lib';
import { XEditorLabel } from './XEditorLabel';

interface XStatementEditorProps {
  editor: XDataEditor;
  value: unknown;
}

/** O valor chega do serializador em camelCase; qualquer coisa que não seja lista vira demonstrativo vazio. */
function linhasDe(pValor: unknown): XLinhaDemonstrativo[] {
  return Array.isArray(pValor) ? (pValor as XLinhaDemonstrativo[]) : [];
}

function Valor({ pLinha }: { pLinha: XLinhaDemonstrativo }): JSX.Element | null {
  if (pLinha.valor === null || pLinha.valor === undefined)
    return pLinha.textoValor
      ? <span className="italic text-brand-text-muted">{pLinha.textoValor}</span>
      : null;

  const texto = formatDecimal(Math.abs(pLinha.valor));
  if (pLinha.estilo === XEstiloLinhaDemonstrativo.Deducao)
    return <span>{`− ${texto}`}</span>;

  return <span>{pLinha.valor < 0 ? `− ${texto}` : texto}</span>;
}

/**
 * O DETALHE da linha (percentual, fórmula, margem). Número é dado e ganha destaque DISCRETO (dono,
 * 2026-10-25): uma pastilha de tinta leve, com o texto mais claro que o cinza do rodapé — chama o olho
 * sem disputar com o valor. Prosa ("compra com frete e despesas") segue em cinza miúdo. Partes
 * separadas por " · " viram pastilhas irmãs.
 */
function Detalhe({ pTexto }: { pTexto: string }): JSX.Element | null {
  if (!pTexto)
    return <span className="flex-1" />;

  if (!/\d/.test(pTexto))
    return (
      <span className="flex-1 min-w-0 text-right text-ui-xs italic text-brand-text-muted truncate">{pTexto}</span>
    );

  return (
    <span className="flex-1 min-w-0 flex justify-end gap-1.5 overflow-hidden">
      {pTexto.split(' · ').map((pParte, pIndice) => (
        <span
          key={pIndice}
          className="shrink-0 rounded-md bg-brand-primary/10 ring-1 ring-inset ring-brand-primary/20 px-1.5
                     text-ui-xs font-medium leading-5 tabular-nums text-brand-text-secondary whitespace-nowrap"
        >
          {pParte}
        </span>
      ))}
    </span>
  );
}

function Linha({ pLinha, pPrimeira }: { pLinha: XLinhaDemonstrativo; pPrimeira: boolean }): JSX.Element {
  switch (pLinha.estilo) {
    case XEstiloLinhaDemonstrativo.Nota:
      return <p className="pt-1.5 text-ui-sm italic text-brand-text-muted">{pLinha.rotulo}</p>;

    case XEstiloLinhaDemonstrativo.Aviso:
      return (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-ui-sm text-brand-text-primary leading-snug">{pLinha.rotulo}</p>
        </div>
      );

    case XEstiloLinhaDemonstrativo.Resultado: {
      const negativo = (pLinha.valor ?? 0) < 0;
      const cor = pLinha.valor === null || pLinha.valor === undefined
        ? 'text-brand-text-secondary'
        : negativo ? 'text-danger' : 'text-success';
      return (
        // Uma linha só (rótulo, detalhe, valor): o resultado se destaca pelo traço, pelo tamanho e pela
        // cor, não por ocupar duas linhas — altura é o que falta num diálogo aninhado.
        <div className="mt-1.5 pt-1.5 border-t-2 border-border flex items-baseline gap-3">
          <span className={`shrink-0 text-base font-semibold ${cor}`}>{pLinha.rotulo}</span>
          <Detalhe pTexto={pLinha.detalhe} />
          <span className={`shrink-0 text-xl font-bold tabular-nums ${cor}`}><Valor pLinha={pLinha} /></span>
        </div>
      );
    }

    default: {
      const principal = pLinha.estilo === XEstiloLinhaDemonstrativo.Principal;
      const deducao = pLinha.estilo === XEstiloLinhaDemonstrativo.Deducao;
      // O valor de partida abre um bloco: afasta-se do que vem antes por um traço fino.
      const abertura = principal && !pPrimeira ? 'mt-1.5 pt-1.5 border-t border-border-light' : '';
      return (
        <div className={`flex items-baseline gap-3 leading-6 ${abertura}`}>
          <span className={`min-w-0 ${deducao ? 'pl-4 text-brand-text-secondary' : principal
            ? 'font-semibold text-brand-text-primary' : 'text-brand-text-secondary'}`}>
            {pLinha.rotulo}
          </span>
          <Detalhe pTexto={pLinha.detalhe} />
          <span className={`w-28 shrink-0 text-right tabular-nums ${principal
            ? 'font-semibold text-brand-text-primary' : deducao ? 'text-danger/90' : 'text-brand-text-primary'}`}>
            <Valor pLinha={pLinha} />
          </span>
        </div>
      );
    }
  }
}

export function XStatementEditor({ editor, value }: XStatementEditorProps): JSX.Element {
  const linhas = linhasDe(value);

  return (
    <div className="w-full">
      <XEditorLabel id={editor.id} title={editor.title} isRequired={false} />
      <div
        id={editor.id}
        data-testid={`statement-${editor.fieldName}`}
        className="rounded-lg border border-border-light bg-muted-bg px-4 py-2 text-ui-sm"
      >
        {linhas.length > 0
          ? linhas.map((pLinha, pIndice) => (
              <Linha key={pIndice} pLinha={pLinha} pPrimeira={pIndice === 0} />
            ))
          : <span className="text-brand-text-muted">{'Sem conteúdo'}</span>}
      </div>
    </div>
  );
}
