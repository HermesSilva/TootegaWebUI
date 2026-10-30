/**
 * XAlertListEditor — a lista de ALERTAS de um relatório, em cartões.
 *
 * Substitui a grade (dono, 2026-09-17). Uma tabela era a forma errada para este dado, e a tela o
 * provou: a mensagem de um alerta é um PARÁGRAFO — "a empresa X está sem Inscrição Estadual… **O que
 * fazer:** abra Pessoas → a empresa…" —, e parágrafo em célula vira rolagem horizontal, texto
 * cortado e `**` cru à vista. É a mesma razão que fez o log do sistema sair como ficha e não como
 * grade: um texto não é uma linha de conferência contábil.
 *
 * Aqui cada alerta é um cartão com faixa lateral colorida pela GRAVIDADE — o operador reconhece o
 * que impede antes de ler —, o "o que houve" em corpo de texto e o "o que fazer" logo abaixo.
 *
 * **Genérico, sem uma linha de App** (CE-19): o back manda uma lista de objetos com `gravidade`,
 * `origem`, `mensagem` e `orientacao`; a App só declara `customEditorName`.
 *
 * **O texto passa pelo MessageText, como toda mensagem da plataforma** (dono, 2026-09-17). Antes
 * havia aqui um renderizador pela metade, que resolvia só o `**destaque**`: o `[[app:CRMxPessoas|
 * Pessoas]]` chegava CRU à tela e os passos `1. 2. 3.` ficavam como linhas soltas — a mensagem
 * mandava abrir Pessoas e mostrava a marcação em vez do caminho. O renderizador único resolve o
 * destaque, o passo numerado e o LINK que abre a App citada (CE-21), e o alerta que impede a nota
 * passa a levar o usuário até a tela onde ele resolve.
 */

import type { JSX } from 'react';
import { AlertTriangle, CircleAlert, CircleCheck } from 'lucide-react';

import type { XEditorProps } from './XEditor';
import { XEditorLabel } from './XEditorLabel';
import { getFieldValue } from '@core/lib';
import { MessageText } from '@core/components/ui/MessageText';
import { useResolvedorLinkApp } from '@core/hooks/useResolvedorLinkApp';

/** Um alerta como o back o descreve. Campos ausentes são tolerados: o cartão omite o que não veio. */
interface Alerta {
  gravidade: string;
  origem: string;
  mensagem: string;
  orientacao: string;
}

/**
 * A gravidade que o back escreve é TEXTO em pt-BR ("Impeditivo" / "Atenção"), porque é o que o
 * relatório também imprime no PDF. Compara-se sem acento e sem caixa: o mesmo texto chega de duas
 * fontes (o serviço e o gerador do documento) e não se pode depender de os dois acentuarem igual.
 */
function ehImpeditivo(pGravidade: string): boolean {
  return pGravidade
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .startsWith('imped');
}

/** Lê a lista venha ela como array ou como JSON em texto — os dois caminhos existem no produto. */
function alertasDe(pValor: unknown): Alerta[] {
  const cru = typeof pValor === 'string' && pValor.trim().startsWith('[')
    ? JSON.parse(pValor) as unknown
    : pValor;

  if (!Array.isArray(cru))
    return [];

  return cru.map((pItem) => {
    const item = pItem as Record<string, unknown>;
    return {
      gravidade: String(getFieldValue(item, 'Gravidade') ?? ''),
      origem: String(getFieldValue(item, 'Origem') ?? ''),
      mensagem: String(getFieldValue(item, 'Mensagem') ?? ''),
      orientacao: String(getFieldValue(item, 'Orientacao') ?? ''),
    };
  });
}

export function XAlertListEditor({ editor, value }: XEditorProps): JSX.Element {
  const alertas = alertasDe(value);

  // Sem gancho de fechamento: o relatório de conferência VIVE dentro da tela do pedido, e abrir a App
  // citada já troca de aba — não há diálogo a dispensar (ver useResolvedorLinkApp).
  const resolverLinkApp = useResolvedorLinkApp();

  return (
    <div className="w-full">
      <XEditorLabel title={editor.title} />

      {/* NADA A APONTAR é uma resposta, e das boas — mas honesta: o ensaio passou, o que não promete
          a autorização (só a SEFAZ conhece o estado do emitente). Verde discreto, sem comemorar. */}
      {alertas.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-brand-surface px-3 py-2.5">
          <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="text-ui text-brand-text-secondary">
            Nada impede a emissão desta nota.
            <span className="block text-ui-xs text-brand-text-muted mt-0.5">
              A conferência passou em todas as verificações que rodam antes da SEFAZ. A autorização
              final depende do Fisco.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((pAlerta, pIndice) => {
            const impeditivo = ehImpeditivo(pAlerta.gravidade);

            // Vermelho abafado para o que PARA a emissão; âmbar para o que só merece conferência.
            // Cor de fundo suave (não sólida): o cartão é para ler, não para alarmar.
            const moldura = impeditivo
              ? 'border-l-4 border-l-red-500 bg-red-500/5 border-border'
              : 'border-l-4 border-l-amber-500 bg-amber-500/5 border-border';

            const Icone = impeditivo ? CircleAlert : AlertTriangle;
            const corDoIcone = impeditivo ? 'text-red-500' : 'text-amber-500';

            return (
              <div key={pIndice} className={`rounded-lg border px-3 py-2.5 ${moldura}`}>
                <div className="flex items-start gap-2.5">
                  <Icone size={16} className={`mt-0.5 shrink-0 ${corDoIcone}`} />

                  <div className="min-w-0 flex-1">
                    {/* Cabeçalho do cartão: a gravidade e de ONDE veio o achado (certificado,
                        estoque, regra da SEFAZ) — é o que diz onde o usuário vai mexer. */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-ui-xs font-semibold tracking-wide ${corDoIcone}`}>
                        {pAlerta.gravidade}
                      </span>
                      {pAlerta.origem && (
                        <span className="text-ui-xs text-brand-text-muted">· {pAlerta.origem}</span>
                      )}
                    </div>

                    <MessageText
                      text={pAlerta.mensagem}
                      className="text-ui text-brand-text-primary"
                      resolveAppLink={resolverLinkApp}
                      linkClassName={corDoIcone}
                    />

                    {/* O QUE FAZER separado e discreto: é a ação, e vem depois do diagnóstico. Só
                        aparece quando existe — a mensagem do back muitas vezes já a traz dentro. */}
                    {pAlerta.orientacao && (
                      <div className="mt-2 pt-2 border-t border-border-light">
                        <MessageText
                          text={pAlerta.orientacao}
                          className="text-ui-sm text-brand-text-secondary"
                          resolveAppLink={resolverLinkApp}
                          linkClassName={corDoIcone}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
