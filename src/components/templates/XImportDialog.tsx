/**
 * XImportDialog — Diálogo de importação de arquivos, dirigido por modelo.
 *
 * Genérico: não conhece App alguma (CE-19). Recebe os arquivos escolhidos e o endpoint publicado em
 * `XApplication.importEndpoint`, envia UM arquivo por requisição e mostra o progresso.
 *
 * Enviar um a um (em vez de um lote) é o que permite dizer QUAL arquivo entrou, qual já existia e
 * qual falhou — e por quê. O importador de notas do contador recebe uma pasta inteira; saber que
 * "3 de 40 falharam" sem saber quais é inútil.
 *
 * RESOLUÇÃO (dono, 2026-11-09): a importação pode responder que o arquivo NÃO entrou porque falta uma decisão do
 * usuário (`resolucaoPendente` — na nota, o produto dos itens sem GTIN válido). Com o formulário de resolução
 * declarado pela App (`XApplication.importResolution`), a corrida para, o modal de coleta genérico abre com aqueles
 * valores e, confirmado, o MESMO arquivo volta com o campo multipart `resolucao` (JSON do que se preencheu).
 * Fechado sem confirmar, o arquivo fica de fora, e a lista diz por quê.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { AlertCircle, CheckCircle2, CircleSlash, FileWarning, Loader2, Sparkles, X } from 'lucide-react';

import { api, ApiError } from '@core/lib/api';
import type { XRowAction } from '@core/types';
import { XCartaoDeModal } from './XCartaoDeModal';
import { XRowActionFormModal } from './XRowActionFormModal';

// ============================================================================
// Types
// ============================================================================

/**
 * Desfecho de um arquivo. `duplicado` não é erro (o mesmo documento chega duas vezes na vida real).
 * `assistido` = não entrou na hora: foi para a fila da IA, que classifica em segundo plano — o sino
 * avisa ao concluir. Distingui-lo de `importado` evita a mentira do "verde" para o que ainda vai rodar.
 */
export type XImportOutcome = 'importado' | 'duplicado' | 'assistido' | 'falhou' | 'naoResolvido';

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
  /**
   * O arquivo NÃO entrou: falta uma decisão que só o usuário toma (os produtos dos itens sem GTIN válido, na nota).
   * São os valores iniciais do formulário de resolução da App (`importResolution`).
   */
  resolucaoPendente?: Record<string, unknown> | null;
}

/** Um arquivo à espera da resolução: os valores do formulário e as marcas da última recusa do servidor. */
interface ResolucaoEmAberto {
  file: File;
  valores: Record<string, unknown>;
  serverErrors?: Record<string, string>;
  /** Muda a cada pendência nova vinda do servidor: o modal renasce com os valores dela. */
  rodada: number;
}

export interface XImportDialogProps {
  isOpen: boolean;
  /** Endpoint multipart, campo `arquivo`. Vem do modelo da App. */
  endpoint: string;
  files: File[];
  /**
   * Formulário de RESOLUÇÃO declarado pela App (`importResolution`). Quando a resposta traz `resolucaoPendente`, a
   * corrida para nele; confirmado, o mesmo arquivo volta com o campo `resolucao`. Nulo ⇒ a importação não pergunta.
   */
  resolution?: XRowAction | null;
  /**
   * ARQUIVO ÚNICO (`XApplication.importSingleFile`, dono 2026-11-09): sem o quadro de progresso. Enquanto o arquivo
   * está em voo, um véu de espera cobre a área da App (dono, 2026-11-10). Importou ⇒ a grade recarrega e o véu
   * some; faltou decisão ⇒ só o formulário de resolução; desistiu ⇒ fecha calado; falhou ⇒ o aviso
   * de erro da área da App, que o `api` já emite com o motivo. Um quadro "1 de 1 arquivos" não diz nada que a grade
   * não diga.
   */
  arquivoUnico?: boolean;
  onClose: () => void;
  /** Chamado ao fim, quando ao menos um arquivo entrou — a grade se recarrega. */
  onFinished: (pImportados: number) => void;
}

/** O corpo multipart da volta da resolução: o MESMO arquivo e o que se escolheu (JSON), no campo `resolucao`. */
function corpoDaResolucao(pArquivo: File, pResolucao: Record<string, unknown>): FormData {
  const corpo = new FormData();
  corpo.append('arquivo', pArquivo, pArquivo.name);
  corpo.append('resolucao', JSON.stringify(pResolucao));
  return corpo;
}

/** Os erros por campo da recusa, no formato do modal de coleta (campo → frase). */
function errosDeCampo(pErro: unknown): Record<string, string> | undefined {
  if (!(pErro instanceof ApiError) || pErro.fieldErrors.length === 0)
    return undefined;

  return Object.fromEntries(pErro.fieldErrors.map((pCampo) => [pCampo.field, pCampo.messages.join(' ')]));
}

// ============================================================================
// Component
// ============================================================================

export function XImportDialog({
  isOpen,
  endpoint,
  files,
  resolution,
  arquivoUnico = false,
  onClose,
  onFinished,
}: XImportDialogProps): JSX.Element | null {

  const [results, setResults] = useState<XImportResult[]>([]);
  const [current, setCurrent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Cancelamento: fechar o diálogo no meio da corrida aborta o que está em voo.
  const abortRef = useRef<AbortController | null>(null);

  // RESOLUÇÃO (dono, 2026-11-09): o arquivo que voltou com `resolucaoPendente` espera aqui. A corrida aguarda a
  // promessa; o modal a resolve com a resposta da importação confirmada, ou com `null` quando se fecha sem importar.
  const [emAberto, setEmAberto] = useState<ResolucaoEmAberto | null>(null);
  const [enviandoResolucao, setEnviandoResolucao] = useState(false);
  const resolverRef = useRef<((pResposta: XImportResponse | null) => void) | null>(null);
  const rodadaRef = useRef(0);

  const aguardarResolucao = useCallback((pArquivo: File, pValores: Record<string, unknown>) =>
    new Promise<XImportResponse | null>((pResolver) => {
      resolverRef.current = pResolver;
      rodadaRef.current += 1;
      setEmAberto({ file: pArquivo, valores: pValores, rodada: rodadaRef.current });
    }), []);

  const encerrarResolucao = useCallback((pResposta: XImportResponse | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setEmAberto(null);
    resolver?.(pResposta);
  }, []);

  // Confirmou a escolha: o MESMO arquivo volta com o que se preencheu. Nova pendência ⇒ o modal se refaz com os
  // valores novos; recusa ⇒ o modal fica, com os campos marcados (a mensagem sai no diálogo da área do App).
  const confirmarResolucao = useCallback(async (pValores: Record<string, unknown>) => {
    if (!emAberto)
      return;

    setEnviandoResolucao(true);
    try {
      const resposta = await api.postForm<XImportResponse>(
        endpoint, corpoDaResolucao(emAberto.file, pValores), abortRef.current?.signal);

      if (resposta?.resolucaoPendente) {
        rodadaRef.current += 1;
        setEmAberto({ file: emAberto.file, valores: resposta.resolucaoPendente, rodada: rodadaRef.current });
      } else
        encerrarResolucao(resposta ?? {});
    } catch (error) {
      setEmAberto({ ...emAberto, valores: pValores, serverErrors: errosDeCampo(error) });
    } finally {
      setEnviandoResolucao(false);
    }
  }, [emAberto, endpoint, encerrarResolucao]);

  const total = files.length;
  const progresso = total === 0 ? 0 : Math.round((current / total) * 100);
  const importados = results.filter((r) => r.outcome === 'importado').length;
  const duplicados = results.filter((r) => r.outcome === 'duplicado').length;
  const assistidos = results.filter((r) => r.outcome === 'assistido').length;
  const falhas = results.filter((r) => r.outcome === 'falhou').length;
  const naoResolvidos = results.filter((r) => r.outcome === 'naoResolvido').length;

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
        let resposta = await api.postFile<XImportResponse>(endpoint, file, 'arquivo', controller.signal);

        // O arquivo não entrou: falta uma escolha do usuário. A corrida PARA aqui até o modal de resolução
        // confirmar (o arquivo volta e entra) ou fechar (o arquivo fica de fora, e diz-se por quê).
        if (resposta?.resolucaoPendente && resolution) {
          const resolvida = await aguardarResolucao(file, resposta.resolucaoPendente);

          if (resolvida === null) {
            acumulado.push({
              fileName: file.name,
              outcome: 'naoResolvido',
              message: `Não importado: a janela "${resolution.formTitle || resolution.title}" foi fechada sem confirmar.`,
            });
            setResults([...acumulado]);
            setCurrent(acumulado.length);
            continue;
          }

          resposta = resolvida;
        }

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

    // Arquivo único: não há quadro para ler o desfecho — terminou, fecha. A falha já foi dita no aviso de erro.
    if (arquivoUnico && !controller.signal.aborted)
      onClose();
  }, [endpoint, files, onFinished, onClose, arquivoUnico, resolution, aguardarResolucao]);

  useEffect(() => {
    if (isOpen && files.length > 0)
      void executar();

    return () => abortRef.current?.abort();
    // `executar` muda com `files`; disparar só quando o diálogo abre com arquivos novos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, files]);

  const fechar = useCallback(() => {
    abortRef.current?.abort();
    // A corrida parada na resolução é liberada (como "fechada sem confirmar") antes de o diálogo sair.
    encerrarResolucao(null);
    onClose();
  }, [onClose, encerrarResolucao]);

  if (!isOpen)
    return null;

  return (
    <>
    {/* `absolute`, não `fixed`: o diálogo pertence à área da App (o contêiner relative do
        XApplicationView), como o XFormModal — não à janela inteira. Escurecer o cabeçalho e o menu
        sugere que o sistema todo parou, quando quem está ocupado é só esta App.
        ARQUIVO ÚNICO não desenha este quadro (ver `arquivoUnico`). */}
    {!arquivoUnico && (
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
            {naoResolvidos > 0 && (
              <span className="flex items-center gap-1 text-warning"
                data-testid="import-nao-resolvidos" data-valor={naoResolvidos}>
                <CircleSlash size={16} /> {`${naoResolvidos} não importados`}
              </span>
            )}
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
              {resultado.outcome === 'naoResolvido' && <CircleSlash size={16} className="mt-0.5 shrink-0 text-warning" />}

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
    )}

    {/* ARQUIVO ÚNICO TEM VÉU DE ESPERA (dono, 2026-11-10). Sem o quadro de progresso, a importação corria sem
        sinal nenhum: a tela parecia parada, o usuário mandava o mesmo arquivo de novo e as duas requisições
        disputavam o mesmo documento. O véu cobre a área da App (não a janela) enquanto o arquivo está em voo —
        diz o que está acontecendo e impede o segundo envio. Some quando a resolução abre: aí quem fala é o
        formulário dela, que tem o próprio indicador ao confirmar. */}
    {arquivoUnico && isRunning && !emAberto && (
      <div
        className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
        data-testid="import-ocupado"
      >
        <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
        <span className="text-ui text-white/90">{`Importando ${files[0]?.name ?? 'o arquivo'}…`}</span>
      </div>
    )}

    {/* O formulário de RESOLUÇÃO, irmão do diálogo e no mesmo quadro (a área da App), por cima dele: é o modal de
        coleta genérico, com os campos que a App declarou e os valores que a importação devolveu. A `key` muda a
        cada pendência nova, para o modal renascer com os valores dela. */}
    {emAberto && resolution && (
      <XRowActionFormModal
        key={emAberto.rodada}
        action={resolution}
        initialValues={emAberto.valores}
        serverErrors={emAberto.serverErrors}
        confirmaPorQuemAbriu
        isBusy={enviandoResolucao}
        onSubmit={(pValores) => { void confirmarResolucao(pValores); }}
        onCancel={() => encerrarResolucao(null)}
      />
    )}
    </>
  );
}
