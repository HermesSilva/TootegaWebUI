/**
 * MessageText - Renders a user-facing message with light, readable formatting.
 *
 * Every message the platform shows a user goes through here: validation, business warnings, errors
 * and informational notices, from ANY module (owner directive, 2026-07-16 — CE-21). A message is
 * something a person has to read, understand and act on; delivered as one undifferentiated block of
 * text, it gets skimmed and the instruction is lost.
 *
 * The markup is deliberately tiny, because the point is that ANY message can use it without a
 * contract, a component or a code path of its own:
 *
 *   - blank line               -> new paragraph
 *   - `**text**`               -> bold highlight (field names, codes, values, the actionable noun)
 *   - `1. `, `2. `…            -> numbered steps, rendered as a real list
 *   - `[[app:Name|Label]]`     -> a link that opens the App that resolves the problem
 *                                 (`?Field=Value` recorta a lista; `#123` abre o registro)
 *
 * Anything else is plain text and stays plain text: a message written with no markup at all renders
 * exactly as it did before. That is what makes the rule safe to apply platform-wide.
 *
 * Not markdown. No images, no HTML, and NO URL — the text comes from the backend, and a renderer that
 * accepts more than this would be an injection surface. The App link is the one exception, and it is
 * not a URL: the backend names an App, the frontend resolves that name against the user's OWN menu and
 * opens it as a tab (owner directive, 2026-07-16 — CE-21). A message that tells the user to go
 * somewhere should take them there; making them hunt for the screen is the same failure as not saying
 * where to go. Every run is emitted as a React node, never as dangerouslySetInnerHTML.
 */

import type { JSX, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Resolves an App name to the action that opens it, or null when this user has no such App. Supplied
 * by whoever knows the menu (the dialog); MessageText itself stays a pure renderer.
 */
export type AppLinkResolver = (
  pAppName: string,
  pFiltro?: Record<string, string>,
  pRegistroID?: string
) => (() => void) | null;

interface InlineOptions {
  resolveAppLink?: AppLinkResolver;
  linkClassName?: string;
}

// ============================================================================
// Inline
// ============================================================================

/**
 * `**bold**` or `[[app:Name|Label]]`, matched in a SINGLE pass so the two can share a line without
 * either swallowing the other. The App name is restricted to identifier characters — it is a name, and
 * nothing that is not a name can pass through it.
 *
 * The name may carry a RECORTE — `[[app:Name?Field=Value|Label]]` — so the link lands on the row that
 * the message is about instead of on an empty screen: a message that says where to go and then makes
 * the user hunt for the line failed at the same thing as not saying where to go. The query is just as
 * restricted as the name: field names, values, separators. Still not a URL.
 *
 * E pode carregar o REGISTRO, como fragmento — `[[app:Name?Field=Value#123|Label]]` —, que é o degrau
 * seguinte do mesmo raciocínio: o recorte entrega a LISTA das linhas que interessam, o fragmento abre
 * a linha que a mensagem está falando, em visualização. Vale a analogia da âncora de URL: a consulta
 * escolhe o documento, o fragmento aponta o ponto dentro dele. Continua não sendo endereço — é um
 * identificador, e a expressão só admite caracteres de identificador.
 */
const INLINE_PATTERN =
  /\*\*(.+?)\*\*|\[\[app:([A-Za-z0-9_.-]+)(?:\?([A-Za-z0-9_.\-=&%:+\s]*))?(?:#([A-Za-z0-9_-]+))?\|([^|\]]+)\]\]/g;

/**
 * A mesma mensagem em UMA LINHA de texto puro, para onde só cabe a prévia dela — a lista recolhida do
 * sino, um `title`, uma notificação do sistema operacional. Achata o que a marcação existe para
 * esconder: `**destaque**` vira a palavra, `[[app:…|Rótulo]]` vira o rótulo, e a quebra de parágrafo
 * vira espaço.
 *
 * Fica AQUI, ao lado da expressão que a define, e a reusa: mantida noutro arquivo, a segunda cópia
 * envelheceria calada e o usuário leria `[[app:LOGxRegistro?Impressao=…` na prévia — exatamente o
 * vazamento que este renderizador existe para impedir.
 */
export function resumoDeMensagem(pTexto: string): string {
  return (pTexto ?? '')
    .replace(INLINE_PATTERN, (_pTudo, pNegrito, _pApp, _pQuery, _pRegistro, pRotulo) =>
      pNegrito ?? pRotulo ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A App que a mensagem cita, decomposta — para quem precisa do ALVO sem renderizar a mensagem. */
export interface LinkDeApp {
  app: string;
  filtro?: Record<string, string>;
  registro?: string;
  rotulo: string;
}

/**
 * O primeiro link de App do texto, ou nulo. Serve à lista que mostra a mensagem RECOLHIDA: ali o
 * corpo não está montado, e mesmo assim o destino tem de estar a um clique — obrigar a abrir a
 * mensagem para só então achar o link é pedir dois gestos para uma decisão só.
 *
 * Nulo quando a mensagem não cita App nenhuma. Nem toda mensagem tem para onde levar, e inventar um
 * destino seria pior do que não ter: o link que não resolve nada gasta a confiança antes de falhar.
 */
export function primeiroLinkDeApp(pTexto: string): LinkDeApp | null {
  INLINE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = INLINE_PATTERN.exec(pTexto ?? '')) !== null) {
    if (match[2] === undefined)
      continue;   // é um **destaque**, não um link

    INLINE_PATTERN.lastIndex = 0;
    return { app: match[2], filtro: lerRecorte(match[3]), registro: match[4], rotulo: match[5] };
  }

  return null;
}

/** `Campo=Valor&Outro=X` → objeto. Par sem nome ou sem valor é descartado, não vira filtro vazio. */
function lerRecorte(pQuery: string | undefined): Record<string, string> | undefined {
  if (!pQuery)
    return undefined;

  const recorte: Record<string, string> = {};

  for (const par of pQuery.split('&')) {
    const [campo, ...resto] = par.split('=');
    const valor = resto.join('=');

    if (campo && valor)
      recorte[campo] = decodeURIComponent(valor);
  }

  return Object.keys(recorte).length > 0 ? recorte : undefined;
}

function renderBold(pText: string, pKey: string): JSX.Element {
  return <strong key={pKey} className="font-semibold text-brand-text-primary">{pText}</strong>;
}

/**
 * An App reference the user cannot reach — no permission, or a name that no longer exists — has no
 * link to offer. The label stays, highlighted, and simply is not clickable: a dead link that opens
 * nothing is worse than plain text, because it spends the user's trust before it fails.
 */
function renderAppLink(
  pAppName: string,
  pQuery: string | undefined,
  pRegistroID: string | undefined,
  pLabel: string,
  pKey: string,
  pOptions: InlineOptions
): ReactNode {
  const abrir = pOptions.resolveAppLink?.(pAppName, lerRecorte(pQuery), pRegistroID) ?? null;

  if (!abrir)
    return renderBold(pLabel, pKey);

  return (
    <button
      key={pKey}
      type="button"
      onClick={abrir}
      className={`inline font-semibold underline underline-offset-2 hover:no-underline ${pOptions.linkClassName ?? ''}`}
    >
      {pLabel}
    </button>
  );
}

/** Splits a line into plain runs, **bold** runs and App links. Unmatched markup stays literal. */
function renderInline(pText: string, pKeyPrefix: string, pOptions: InlineOptions): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(pText)) !== null) {
    if (match.index > cursor)
      nodes.push(pText.slice(cursor, match.index));

    const key = `${pKeyPrefix}-m${match.index}`;
    nodes.push(match[1] !== undefined
      ? renderBold(match[1], key)
      : renderAppLink(match[2], match[3], match[4], match[5], key, pOptions));

    cursor = match.index + match[0].length;
  }

  if (cursor < pText.length)
    nodes.push(pText.slice(cursor));

  return nodes;
}

// ============================================================================
// Blocks
// ============================================================================

const STEP_PATTERN = /^\s*(\d+)\.\s+(.*)$/;

/** A run of consecutive `N. ` lines becomes one ordered list; everything else is a paragraph. */
function renderBlock(pBlock: string, pKey: string, pOptions: InlineOptions): JSX.Element {
  const lines = pBlock.split('\n');
  const steps = lines.map((pLine) => STEP_PATTERN.exec(pLine));

  // Only a block whose lines are ALL steps becomes a list — a paragraph that happens to end with a
  // numbered line keeps its shape.
  if (steps.length > 0 && steps.every((pStep) => pStep !== null)) {
    return (
      <ol key={pKey} className="list-decimal ml-5 space-y-1">
        {steps.map((pStep, pIdx) => (
          <li key={`${pKey}-s${pIdx}`} className="pl-1">
            {renderInline(pStep![2], `${pKey}-s${pIdx}`, pOptions)}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p key={pKey} className="whitespace-pre-line">
      {lines.map((pLine, pIdx) => (
        <span key={`${pKey}-l${pIdx}`}>
          {renderInline(pLine, `${pKey}-l${pIdx}`, pOptions)}
          {pIdx < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </p>
  );
}

// ============================================================================
// Component
// ============================================================================

interface MessageTextProps {
  text: string;
  className?: string;
  /** Omitted ⇒ App references render as plain highlighted text (see renderAppLink). */
  resolveAppLink?: AppLinkResolver;
  /** Colour of the App link, so it matches the severity of the dialog that hosts it. */
  linkClassName?: string;
}

export function MessageText({ text, className, resolveAppLink, linkClassName }: MessageTextProps): JSX.Element {
  // Paragraphs are separated by a blank line. Trailing/leading blanks are noise, not structure.
  const blocks = (text ?? '').split(/\n{2,}/).map((pB) => pB.trim()).filter((pB) => pB.length > 0);
  const options: InlineOptions = { resolveAppLink, linkClassName };

  // `break-words` + `min-w-0`: a mensagem pode trazer um TOKEN sem espaços mais largo que o diálogo —
  // uma URL de QR Code, uma chave de acesso, um XML citado. Sem isso ele não quebra, empurra a caixa e
  // o texto VAZA para fora da borda (observado em 2026-07-24, na reprova do qrCode da NFC-e). A quebra
  // só age sobre a palavra que não cabe sozinha na linha; texto normal continua quebrando por espaço.
  // Fica aqui, no renderizador por onde passa TODA mensagem da plataforma, e não em cada diálogo.
  return (
    <div className={`min-w-0 break-words space-y-2.5 ${className ?? ''}`}>
      {blocks.map((pBlock, pIdx) => renderBlock(pBlock, `b${pIdx}`, options))}
    </div>
  );
}
