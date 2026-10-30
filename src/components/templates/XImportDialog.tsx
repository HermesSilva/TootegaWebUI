/**
 * XImportDialog — Diálogo de importação de arquivos, dirigido por modelo.
 *
 * Genérico: não conhece App alguma (CE-19). Recebe os arquivos escolhidos e o endpoint publicado em
 * `XApplication.importEndpoint`, envia UM arquivo por requisição e mostra o progresso.
 *
 * Enviar um a um (em vez de um lote) é o que permite dizer QUAL arquivo entrou, qual já existia e
 * qual falhou — e por quê. O importador de notas do contador recebe uma pasta inteira; saber que
 * "3 de 40 falharam" sem saber quais é inútil.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { AlertCircle, CheckCircle2, FileWarning, Loader2, Sparkles, X } from 'lucide-react';

import { api, ApiError } from '@core/lib/api';
import { XCartaoDeModal } from './XCartaoDeModal';

// ============================================================================
// Types
// ============================================================================

/**
 * Desfecho de um arquivo. `duplicado` não é erro (o mesmo documento chega duas vezes na vida real).
 * `assistido` = não entrou na hora: foi para a fila da IA, que classifica em segundo plano — o sino
 * avisa ao concluir. Distingui-lo de `importado` evita a mentira do "verde" para o que ainda vai rodar.
 */
export type XImportOutcome = 'importado' | 'duplicado' | 'assistido' | 'falhou';

export interface XImportResult {
  fileName: string;
  outcome: XImportOutcome;
  message: string;
}

/**
 * Envelope que o back devolve por arquivo. `jaExistia` distingue a importação nova da repetição;
 * `assistida` diz que o arquivo entrou no fluxo de IA (assíncrono), sem nota gerada ainda.
 */
interface XImportResponse {
  jaExistia?: boolean;
  chaveAcesso?: string;
  assistida?: boolean;
}

export interface XImportDialogProps {
  isOpen: boolean;
  /** Endpoint multipart, campo `arquivo`. Vem do modelo da App. */
  endpoint: string;
  files: File[];
  onClose: () => void;
  /** Chamado ao fim, quando ao menos um arquivo entrou — a grade se recarrega. */
  onFinished: (pImportados: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function XImportDialog({
  isOpen,
  endpoint,
  files,
  onClose,
  onFinished,
}: XImportDialogProps): JSX.Element | null {

  const [results, setResults] = useState<XImportResult[]>([]);
  const [current, setCurrent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Cancelamento: fechar o diálogo no meio da corrida aborta o que está em voo.
  const abortRef = useRef<AbortController | null>(null);

  const total = files.length;
  const progresso = total === 0 ? 0 : Math.round((current / total) * 100);
  const importados = results.filter((r) => r.outcome === 'importado').length;
  const duplicados = results.filter((r) => r.outcome === 'duplicado').length;
  const assistidos = results.filter((r) => r.outcome === 'assistido').length;
  const falhas = results.filter((r) => r.outcome === 'falhou').length;

  const executar = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setResults([]);
    setCurrent(0);

    const acumulado: XImportResult[] = [];

    for (const file of files) {
      if (controller.signal.aborted)
        break;

      try {
        const resposta = await api.postFile<XImportResponse>(endpoint, file, 'arquivo', controller.signal);

        acumulado.push({
          fileName: file.name,
          outcome: resposta?.assistida ? 'assistido' : resposta?.jaExistia ? 'duplicado' : 'importado',
          message: resposta?.assistida ? 'Enviada para classificação por IA' : (resposta?.chaveAcesso ?? ''),
        });
      } catch (error) {
        acumulado.push({
          fileName: file.name,
          outcome: 'falhou',
          message: error instanceof ApiError ? error.message : String(error),
        });
      }

      // Atualiza a cada arquivo: o usuário vê o progresso andar, não um salto no fim.
      setResults([...acumulado]);
      setCurrent(acumulado.length);
    }

    setIsRunning(false);
    abortRef.current = null;

    const entraram = acumulado.filter((r) => r.outcome === 'importado').length;
    if (entraram > 0)
      onFinished(entraram);
  }, [endpoint, files, onFinished]);

  useEffect(() => {
    if (isOpen && files.length > 0)
      void executar();

    return () => abortRef.current?.abort();
    // `executar` muda com `files`; disparar só quando o diálogo abre com arquivos novos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, files]);

  const fechar = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  if (!isOpen)
    return null;

  return (
    // `absolute`, não `fixed`: o diálogo pertence à área da App (o contêiner relative do
    // XApplicationView), como o XFormModal — não à janela inteira. Escurecer o cabeçalho e o menu
    // sugere que o sistema todo parou, quando quem está ocupado é só esta App.
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* ALTURA MEDIDA CONTRA O PAI, não contra a janela (dono, 2026-09-20). Era `max-h-[80vh]`, e
          `vh` é a VIEWPORT — 80% da janela inteira, enquanto o quadro deste diálogo é a área do App,
          que é menor (tem cabeçalho, abas e a barra de botões acima). Com arquivo bastante na lista
          (27, no caso observado) o conteúdo crescia até esse teto e passava por cima dos botões.
          `max-h-full` é 100% do contêiner — que já é a área da App, e já desconta o `p-4` do pai. A
          unidade certa é a do quadro a que o modal pertence; `vh` nunca é essa unidade aqui.
          CORES SÓ POR TOKEN DO TEMA (2026-09-22). Era `bg-white dark:bg-slate-800`, e o `dark:` do
          Tailwind v4 segue o SISTEMA OPERACIONAL (prefers-color-scheme), não o `data-theme` do app:
          o diálogo acertava por coincidência na máquina escura e ficava branco no navegador do e2e,
          que abre em modo claro — e em nenhum dos dois seguia o tema escolhido (Âmbar, Nublado…). */}
      <XCartaoDeModal className="flex max-h-full w-full max-w-2xl flex-col rounded-lg bg-brand-surface">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-brand-text-primary">
            {'Importar arquivos'}
          </h2>
          <button
            type="button"
            onClick={fechar}
            className="rounded p-1 text-brand-text-secondary hover:bg-hover"
            aria-label={'Fechar'}
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-6 py-4">
          {/* Medidor de progresso: arquivos concluídos sobre o total. */}
          <div>
            <div className="mb-1 flex justify-between text-sm text-brand-text-secondary">
              <span>{`${current} de ${total} arquivos`}</span>
              <span className="font-medium">{progresso}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted-bg"
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          {/* Contadores com testid E valor cru em data-*: o e2e afirma o NÚMERO sem ter de recortar
              texto ("3 importados"), que muda com o rótulo. */}
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-success"
              data-testid="import-importados" data-valor={importados}>
              <CheckCircle2 size={16} /> {`${importados} importados`}
            </span>
            <span className="flex items-center gap-1 text-warning"
              data-testid="import-duplicados" data-valor={duplicados}>
              <FileWarning size={16} /> {`${duplicados} já existiam`}
            </span>
            {assistidos > 0 && (
              <span className="flex items-center gap-1 text-info"
                data-testid="import-assistidos" data-valor={assistidos}>
                <Sparkles size={16} /> {`${assistidos} em classificação`}
              </span>
            )}
            <span className="flex items-center gap-1 text-danger"
              data-testid="import-falhas" data-valor={falhas}>
              <AlertCircle size={16} /> {`${falhas} falharam`}
            </span>
          </div>

          {/* Mensagem da IA: aparece só quando ao menos um arquivo entrou no fluxo assistido. Não é erro
              nem sucesso de importação — é aviso de que o trabalho continua em segundo plano (CE-20/21). */}
          {assistidos > 0 && !isRunning && (
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-bg px-3 py-2 text-sm text-info">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              <span>
                {`A IA está classificando ${assistidos} nota(s) enviada(s). Você será avisado no sino quando a importação concluir.`}
              </span>
            </div>
          )}
        </div>

        {/* `min-h-0` é o que faz o teto acima VALER. Item de flex não encolhe abaixo do próprio
            conteúdo por default (`min-height: auto`), então esta lista exigia a altura das 27
            linhas e EMPURRAVA o quadro para fora, teto ou não — o `overflow-y-auto` nunca chegava a
            rolar. Com ele, a lista cede, o rodapé (onde estão os botões) fica visível e o excedente
            vira rolagem, que é onde o excedente deve ir. */}
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-border px-6 py-2">
          {results.map((resultado) => (
            <li
              key={resultado.fileName}
              className="flex items-start gap-2 border-b border-border-light py-2 text-sm last:border-0"
            >
              {resultado.outcome === 'importado' && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />}
              {resultado.outcome === 'duplicado' && <FileWarning size={16} className="mt-0.5 shrink-0 text-warning" />}
              {resultado.outcome === 'falhou' && <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />}

              <div className="min-w-0">
                <p className="truncate font-medium text-brand-text-primary">{resultado.fileName}</p>
                {resultado.message && (
                  <p className="truncate text-xs text-brand-text-muted">{resultado.message}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          {isRunning && (
            <span className="mr-auto flex items-center gap-2 text-sm text-brand-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              {'Importando…'}
            </span>
          )}
          <button
            type="button"
            onClick={fechar}
            // `data-rodando` diz se a importação ainda corre: o e2e espera por ele virar "false"
            // em vez de contar tempo, que é como teste fica lento e instável.
            data-testid="import-fechar"
            data-rodando={isRunning}
            className="rounded bg-muted-bg px-4 py-2 text-sm font-medium text-brand-text-primary hover:bg-hover"
          >
            {isRunning ? 'Cancelar' : 'Fechar'}
          </button>
        </footer>
      </XCartaoDeModal>
    </div>
  );
}
