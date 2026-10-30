import { useCallback, useContext } from 'react';
import { TabsContext } from '@core/contexts/TabsContext';
import { ErrorContext } from '@core/contexts/ErrorContext';

/**
 * O que o usuário LOGADO está vendo quando pergunta à Jaci (dono, 2026-10-17). Espelho do contrato
 * `ContextoDeTelaJaci` do SYS; o back REDIGE (senha, cartão, token, CSC fora) antes de enfileirar —
 * o front envia o que a tela mostra, e só isso.
 */
export interface ContextoDeTela {
  app: string;
  tituloDaApp: string;
  aba: string;
  /**
   * O registro que a tela acompanha (dono, 2026-10-25 — ADR-ANVIL-0006, RI-3): no AppX, o do nível à frente — o
   * subtítulo que o AppX escreve na aba da casca ("HZN-PORTAL (Portal do Cliente)"). É o "este projeto" da pergunta.
   */
  registro: string;
  campo: string;
  valores: Record<string, string>;
  ultimaMensagem: string;
}

/** Tetos de bom senso: contexto é pista para o modelo, não a cópia do formulário inteiro. */
const MAXIMO_DE_CAMPOS = 40;
const MAXIMO_DE_CARACTERES_POR_VALOR = 200;

/**
 * O nome do campo a partir do editor: o `data-testid="field-<nome>"` do recipiente (o que o motor
 * genérico já carimba) ou, na falta, o `name` do próprio controle. Sem nenhum dos dois, o controle
 * não tem como ser citado e fica de fora.
 */
function nomeDoCampo(pControle: HTMLElement): string {
  const recipiente = pControle.closest<HTMLElement>('[data-testid^="field-"]');
  const testid = recipiente?.getAttribute('data-testid') ?? '';

  if (testid.startsWith('field-'))
    return testid.slice('field-'.length);

  return pControle.getAttribute('name') ?? '';
}

/** Senha nunca entra, nem como pista: o back redigiria, mas não há motivo para trafegar. */
function controleSensivel(pControle: Element): boolean {
  return pControle instanceof HTMLInputElement && (pControle.type === 'password' || pControle.type === 'hidden');
}

function valorDoControle(pControle: Element): string {
  if (pControle instanceof HTMLInputElement) {
    if (pControle.type === 'checkbox' || pControle.type === 'radio')
      return pControle.checked ? 'sim' : 'não';
    return pControle.value;
  }

  if (pControle instanceof HTMLSelectElement)
    return pControle.selectedOptions[0]?.text ?? pControle.value;

  if (pControle instanceof HTMLTextAreaElement)
    return pControle.value;

  return '';
}

/**
 * Lê os valores do formulário à frente: o diálogo aberto por último dentro da área do App ou, sem
 * diálogo, a própria área. Vem do DOM, e não de um contexto, porque o painel da Jaci mora na CASCA
 * (cabeçalho), fora de qualquer `FormValuesProvider` — e é justamente a casca que precisa saber o
 * que o App à frente está mostrando.
 */
function lerValores(pRaiz: Element): Record<string, string> {
  const valores: Record<string, string> = {};
  const controles = pRaiz.querySelectorAll<HTMLElement>('input, select, textarea');
  let contados = 0;

  for (const controle of controles) {
    if (contados >= MAXIMO_DE_CAMPOS)
      break;
    if (controleSensivel(controle))
      continue;

    const nome = nomeDoCampo(controle);
    const valor = valorDoControle(controle).trim();

    if (!nome || !valor || nome in valores)
      continue;

    valores[nome] = valor.length > MAXIMO_DE_CARACTERES_POR_VALOR
      ? `${valor.slice(0, MAXIMO_DE_CARACTERES_POR_VALOR)}…`
      : valor;
    contados++;
  }

  return valores;
}

/**
 * Monta o contexto de tela NA HORA DO ENVIO (função, não valor reativo): o que importa é o estado
 * do formulário quando a pessoa clicou em perguntar, não quando o painel abriu.
 *
 * Funciona sem `TabsProvider` e sem `ErrorProvider` (tela de login): aí devolve `null`, e o pedido
 * sai sem contexto — que é exatamente o que o anônimo deve mandar.
 */
export function useContextoDeTela(): () => ContextoDeTela | null {
  const abas = useContext(TabsContext);
  const erros = useContext(ErrorContext);

  return useCallback((): ContextoDeTela | null => {
    if (!abas)
      return null;

    const abaAtiva = abas.tabs.find((pAba) => pAba.id === abas.activeTabId) ?? null;
    const area = typeof document === 'undefined' ? null : document.querySelector('[data-app-area]');

    if (!abaAtiva && !area)
      return null;

    // O diálogo aberto por último é o que está à frente: formulário sobre a grade, ou diálogo
    // aninhado sobre o formulário.
    const dialogos = area ? Array.from(area.querySelectorAll('[role="dialog"]')) : [];
    const frente = dialogos.length > 0 ? dialogos[dialogos.length - 1] : area;

    const abaDoFormulario = frente?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '';

    const focado = typeof document === 'undefined' ? null : document.activeElement;
    const campo = focado instanceof HTMLElement && frente?.contains(focado) ? nomeDoCampo(focado) : '';

    // Só a mensagem da aba à frente (ou a da sessão, sem aba de origem): a de outra aba não é o
    // assunto desta pergunta.
    const erro = erros?.error ?? null;
    const ultimaMensagem = erro && (!erro.originTabId || erro.originTabId === abaAtiva?.id)
      ? erro.message
      : '';

    return {
      app: abaAtiva?.menuItem.name ?? '',
      tituloDaApp: abaAtiva?.menuItem.title ?? abaAtiva?.title ?? '',
      aba: abaDoFormulario,
      registro: abaAtiva?.subtitulo ?? '',
      campo,
      valores: frente ? lerValores(frente) : {},
      ultimaMensagem,
    };
  }, [abas, erros]);
}
