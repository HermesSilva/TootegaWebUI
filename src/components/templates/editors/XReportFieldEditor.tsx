/**
 * XReportFieldEditor — o campo de um RELATÓRIO: rótulo em cima, valor embaixo, sem caixa.
 *
 * Nasceu porque um relatório montado com campos só-leitura **não é um relatório** (dono,
 * 2026-09-17): a conferência da nota saía como uma parede de inputs cinzentos e desabilitados, com
 * placeholder no lugar do dado quando o valor era vazio. O usuário pediu um documento — algo que se
 * lê, se imprime e se manda ao contador —, e caixa de digitação desligada não é isso: ela comunica
 * "aqui você digitaria, mas não pode", quando a mensagem certa é "este é o valor".
 *
 * A diferença é de linguagem visual, não de estado:
 *
 * | | Campo só-leitura | Campo de relatório |
 * |---|---|---|
 * | Moldura | caixa com borda, fundo de input | nenhuma |
 * | Vazio | mostra o *placeholder* (o rótulo de novo) | mostra "—" |
 * | Peso | valor em cor secundária, apagado | valor em destaque, rótulo discreto |
 *
 * **Genérico, sem uma linha de App** (CE-19): o back declara `customEditorName` e o formato do
 * valor (moeda, data, texto); aqui só se lê e se apresenta.
 */

import type { JSX } from 'react';
import type { XEditorProps } from './XEditor';
import { XUIEditorType, XUIEmphasis } from '@core/types';
import { formatCurrency, formatDate, formatDateTime, formatDecimal } from '@core/lib';

/** O nome com que o back o declara — e o que o `main.tsx` registra. */
export const XREPORT_FIELD_EDITOR = 'XReportFieldEditor';

/**
 * O valor JÁ FORMATADO, pelo tipo que o modelo declarou. É a mesma formatação do resto do produto
 * (`@core/lib`): duas verdades sobre como se escreve um número seria uma a mais.
 */
function formatar(pValor: unknown, pTipo: XUIEditorType, pCasas?: number): string {
  if (pValor === null || pValor === undefined)
    return '';

  if (typeof pValor === 'boolean')
    return pValor ? 'Sim' : 'Não';

  const texto = String(pValor).trim();
  if (texto === '')
    return '';

  switch (pTipo) {
    case XUIEditorType.Currency: {
      const numero = Number(pValor);
      return Number.isNaN(numero) ? texto : formatCurrency(numero);
    }

    case XUIEditorType.Number:
    case XUIEditorType.Percent: {
      const numero = Number(pValor);
      if (Number.isNaN(numero))
        return texto;

      // As casas vêm do modelo (`decimalPlaces`): quantidade de volumes não tem centavos, e peso
      // em quilo pede três. Sem declaração, valem as duas de sempre.
      const numeroFormatado = formatDecimal(numero, pCasas ?? 2);
      return pTipo === XUIEditorType.Percent ? `${numeroFormatado}%` : numeroFormatado;
    }

    case XUIEditorType.Date:
      return formatDate(texto);

    case XUIEditorType.DateTime:
      return formatDateTime(texto);

    default:
      return texto;
  }
}

/**
 * A COR do valor pela ênfase que o back declarou (dono, 2026-10-13): o papel do número vira o tom da
 * paleta — primário, sucesso, atenção, perigo. Sem ênfase, a cor de todo valor de relatório.
 */
export function classeDaEnfase(pEnfase: XUIEmphasis | undefined): string {
  switch (pEnfase) {
    case XUIEmphasis.Primary: return 'text-brand-primary';
    case XUIEmphasis.Success: return 'text-success';
    case XUIEmphasis.Warning: return 'text-warning';
    case XUIEmphasis.Danger: return 'text-danger';
    default: return 'text-brand-text-primary';
  }
}

/**
 * O TAMANHO do valor pela escala: 0 é o corpo de todo campo; 1 é maior; 2 é o maior — o número que o
 * leitor procura primeiro (o total da nota). Cor e tamanho são destaques independentes, e um relatório
 * que se confere linha a linha precisa dos dois: posição sozinha não faz um número saltar aos olhos.
 */
export function classeDaEscala(pEscala: number | undefined): string {
  if (!pEscala || pEscala <= 0)
    return 'text-ui font-medium';
  return pEscala === 1 ? 'text-lg font-semibold' : 'text-2xl font-bold';
}

export function XReportFieldEditor({ editor, value }: XEditorProps): JSX.Element {
  const tipo = editor.editor.editorType;
  const texto = formatar(value, tipo, editor.editor.decimalPlaces);
  const enfase = classeDaEnfase(editor.editor.emphasis);
  const escala = classeDaEscala(editor.editor.emphasisScale);

  // TEXTO LONGO (o relatório da decisão tributária) é um BLOCO, não uma linha: preserva as quebras
  // que quem o escreveu colocou, e é o único jeito de uma prosa regra-a-regra continuar legível.
  const ehBloco = tipo === XUIEditorType.TextArea;

  // Valor NUMÉRICO alinha à direita, como na grade e no papel: é o que permite comparar de relance.
  const ehNumero = tipo === XUIEditorType.Currency
    || tipo === XUIEditorType.Number
    || tipo === XUIEditorType.Percent;

  return (
    <div className="min-w-0">
      {/* O RÓTULO acompanha o valor (dono, 2026-10-10): número à direita com título à esquerda
          deixava o título de um campo colado ao valor do vizinho — lia-se "Desconto 3.168,00". */}
      {editor.title && (
        <div className={`text-ui-xs text-brand-text-muted mb-0.5 truncate ${ehNumero ? 'text-right' : ''}`}>
          {editor.title}
        </div>
      )}

      {ehBloco ? (
        // `whitespace-pre-wrap`: as quebras do texto são dado, não formatação acidental.
        <div className="text-ui text-brand-text-primary whitespace-pre-wrap leading-relaxed">
          {texto || '—'}
        </div>
      ) : (
        <div
          className={`${escala} ${enfase} break-words ${ehNumero ? 'text-right tabular-nums' : ''}`}
          title={texto}
        >
          {/* Vazio vira TRAVESSÃO, nunca o placeholder: num documento, "—" diz "não há"; repetir o
              rótulo dentro do campo faria procurar um dado que não existe. */}
          {texto || '—'}
        </div>
      )}
    </div>
  );
}
