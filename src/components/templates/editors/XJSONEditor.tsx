/**
 * XJSONEditor — documento JSON FORMATADO e COLORIDO, ocupando a altura disponível.
 *
 * Existe porque uma TextArea entrega o JSON numa linha só, sem hierarquia e sem destaque: ilegível
 * para o que a auditoria de IA guarda (o enviado e o recebido, com milhares de caracteres). Aqui o
 * texto é reindentado e as partes ganham cor — chave, texto, número, booleano, nulo.
 *
 * Só leitura: é registro do que aconteceu, não campo de digitação.
 *
 * O que NÃO é JSON válido aparece COMO VEIO, com um aviso discreto. Esconder o conteúdo porque o
 * parser não gostou seria perder justamente o caso que se quer investigar (uma resposta truncada,
 * uma mensagem de erro em texto puro).
 *
 * Sem biblioteca de realce: o realce é um percurso do próprio JSON reserializado, então não há HTML
 * de terceiro nem `dangerouslySetInnerHTML` — cada pedaço vira um <span> tipado pelo React.
 */

import { useMemo, type JSX, type ReactNode } from 'react';

import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XBotaoCopiar } from './XBotaoCopiar';

// ============================================================================
// Types
// ============================================================================

interface XJSONEditorProps {
  editor: XDataEditor;
  value: unknown;
}

/** Resultado da tentativa de formatar: ou o JSON reserializado, ou o texto cru. */
interface Formatado {
  texto: string;
  ehJSON: boolean;
  /** Parecia JSON (abre com { ou [) mas o parse falhou: provável truncamento — vale avisar. */
  jsonQuebrado: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatar(pValor: unknown): Formatado {
  const cru = typeof pValor === 'string' ? pValor : pValor == null ? '' : String(pValor);
  const limpo = cru.trim();

  if (limpo.length === 0)
    return { texto: '', ehJSON: false, jsonQuebrado: false };

  // Só tem sentido tentar parsear como JSON o que abre como JSON. Um prompt de sistema (texto/markdown)
  // não é uma tentativa de JSON malformada — é outro tipo de documento, e não deve carregar aviso.
  const pareceJSON = limpo.startsWith('{') || limpo.startsWith('[');

  try {
    return { texto: JSON.stringify(JSON.parse(limpo), null, 2), ehJSON: true, jsonQuebrado: false };
  } catch {
    // Mostra como veio. Avisa APENAS quando parecia JSON e quebrou (provável truncamento) — o caso
    // que a auditoria quer flagrar; texto puro (prompt, resposta livre) sai limpo, sem aviso.
    return { texto: cru, ehJSON: false, jsonQuebrado: pareceJSON };
  }
}

/**
 * Quebra a linha em pedaços coloridos. Trabalha sobre o JSON JÁ reserializado (saída do
 * JSON.stringify), cuja forma é conhecida — por isso um percurso simples basta, sem parser.
 */
function realcar(pLinha: string, pChave: number): ReactNode {
  const pedacos: ReactNode[] = [];
  // Ordem importa: a chave ("nome":) tem de casar antes do texto comum.
  const padrao = /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

  let ultimo = 0;
  let achado: RegExpExecArray | null;

  while ((achado = padrao.exec(pLinha)) !== null) {
    if (achado.index > ultimo)
      pedacos.push(pLinha.slice(ultimo, achado.index));

    const [inteiro, textoOuChave, doisPontos, booleano, nulo, numero] = achado;

    if (textoOuChave !== undefined && doisPontos !== undefined) {
      pedacos.push(<span key={`k${achado.index}`} className="text-brand-primary">{textoOuChave}</span>);
      pedacos.push(doisPontos);
    } else if (textoOuChave !== undefined) {
      pedacos.push(<span key={`s${achado.index}`} className="text-success">{textoOuChave}</span>);
    } else if (booleano !== undefined) {
      pedacos.push(<span key={`b${achado.index}`} className="text-warning font-medium">{booleano}</span>);
    } else if (nulo !== undefined) {
      pedacos.push(<span key={`n${achado.index}`} className="text-brand-text-muted italic">{nulo}</span>);
    } else if (numero !== undefined) {
      pedacos.push(<span key={`d${achado.index}`} className="text-info">{numero}</span>);
    } else {
      pedacos.push(inteiro);
    }

    ultimo = achado.index + inteiro.length;
  }

  if (ultimo < pLinha.length)
    pedacos.push(pLinha.slice(ultimo));

  return <div key={pChave} className="whitespace-pre">{pedacos.length > 0 ? pedacos : ' '}</div>;
}

// ============================================================================
// Component
// ============================================================================

export function XJSONEditor({ editor, value }: XJSONEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const { texto, jsonQuebrado } = useMemo(() => formatar(value), [value]);
  const linhas = useMemo(() => texto.split('\n'), [texto]);

  return (
    // h-full + min-h-0: o campo ocupa a altura que a seção lhe der (é o único da aba), e o corpo
    // rola por dentro em vez de esticar o modal.
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />
        {jsonQuebrado && (
          <span className="text-ui-xs text-warning">{'JSON inválido (possível truncamento) — exibido como veio'}</span>
        )}
      </div>

      {/* O copiar mora no CANTO DA CAIXA, o mesmo lugar da área de texto (FE-12): é o mesmo gesto
          sobre o mesmo tipo de conteúdo, e dois cantos diferentes fariam o operador procurar. Fica
          FORA do elemento que rola — dentro dele, o botão subiria com o texto e sumiria da vista no
          documento longo, que é justamente o que se quer copiar. */}
      <div className="relative flex-1 min-h-[16rem] flex">
        <div
          id={editor.id}
          className="
            flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-brand-surface
            px-3 py-2 pr-10 font-mono text-ui-xs leading-relaxed text-brand-text-secondary
          "
        >
          {texto.length > 0
            ? linhas.map((linha, i) => realcar(linha, i))
            : <span className="text-brand-text-muted">{'Sem conteúdo'}</span>}
        </div>

        <XBotaoCopiar texto={texto} descricao={editor.title} className="absolute top-2 right-2" />
      </div>
    </div>
  );
}
