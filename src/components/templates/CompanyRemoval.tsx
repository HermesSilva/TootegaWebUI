/**
 * CompanyRemoval — custom button action (companyRemoval) of the platform app "Remoção de empresa".
 *
 * Removing a company deletes it and everything that belongs to it, in every module, and there is no
 * undo other than the exported package. So the dialog walks the operator through a fixed order and the
 * back end enforces each step:
 *   1. preview — what the company has, and what blocks the removal (records of other companies tied to it);
 *   2. export — download the package (a ZIP with one CSV per table);
 *   3. remove — pick the downloaded file FROM DISK, type the company document and the operator's own
 *      password (checked by the identity service: an open session is not proof of who is at the screen).
 *
 * The package is deliberately NOT re-sent from memory: picking it from disk is the proof that the
 * download actually landed. The server then checks the file against the database, table by table, and
 * removes nothing if they differ. Data-driven (CE-19): endpoints come from the app model.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { AlertTriangle, Download, FileArchive, Loader2, Trash2 } from 'lucide-react';
import { api } from '@core/lib/api';
import { baseDaApp, formatDocument, getFieldValue } from '@core/lib';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import type { XButtonActionComponentProps } from './XButtonActionRegistry';
import { XModalShell } from './XModalShell';

interface Contagem {
  registro: string;
  quantidade: number;
}

interface Previa {
  assinante: string;
  nome: string;
  documento: string;
  totalDeRegistros: number;
  registros: Contagem[];
  impedimentos: Contagem[];
}

interface Resultado {
  nome: string;
  totalDeRegistros: number;
}

const soDigitos = (pTexto: string): string => pTexto.replace(/[^0-9a-zA-Z]/g, '');

export function CompanyRemoval({ application, selectedRow, onCancel, onDone }: XButtonActionComponentProps): JSX.Element | null {
  const base = baseDaApp(application.apiBaseURL);
  const id = String(getFieldValue(selectedRow ?? {}, 'RowKey') ?? '');

  const [previa, setPrevia] = useState<Previa | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [pacote, setPacote] = useState<File | null>(null);
  const [documento, setDocumento] = useState('');
  const [senha, setSenha] = useState('');
  const [removendo, setRemovendo] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const seletor = useSeletorDeArquivo({
    onEscolher: (pArquivos) => setPacote(pArquivos[0] ?? null),
    onCancelar: () => undefined,
  });

  // A prévia é a primeira coisa: sem saber o que sai, não há o que confirmar. Se ela falhar, o motivo
  // já foi mostrado pelo diálogo de mensagem, e a ação se fecha.
  // O `onCancel` entra por ref: quem monta a ação o recria a cada render, e como dependência do efeito
  // ele faria a contagem — que percorre todos os módulos — ser refeita a cada render da tela.
  const cancelar = useRef(onCancel);
  cancelar.current = onCancel;

  useEffect(() => {
    if (!id) {
      cancelar.current();
      return;
    }

    let vivo = true;

    api.get<Previa>(`${base}/${id}/preview`)
      .then((pPrevia) => { if (vivo) setPrevia(pPrevia); })
      .catch(() => { if (vivo) cancelar.current(); });

    return () => { vivo = false; };
  }, [base, id]);

  const baixar = useCallback(async () => {
    setBaixando(true);
    try {
      const { blob, filename } = await api.downloadBlob(`${base}/${id}/export`, {});

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // A recusa do servidor já saiu no diálogo de mensagem, com o motivo.
    } finally {
      setBaixando(false);
    }
  }, [base, id]);

  const documentoConfere = previa !== null && soDigitos(documento) === soDigitos(previa.documento) && documento.trim().length > 0;
  const impedida = previa !== null && previa.impedimentos.length > 0;

  // O que ainda falta, dito na tela: botão desabilitado sem motivo à vista é o usuário adivinhando. Baixar
  // o pacote NESTA abertura não é condição — quem já o tem em disco o envia direto, e é o servidor que
  // confere se o arquivo é a exportação atual da empresa.
  const faltas = [
    pacote === null ? 'enviar o arquivo do pacote' : null,
    documento.trim().length === 0 ? 'digitar o documento da empresa'
      : !documentoConfere ? 'corrigir o documento, que não é o desta empresa' : null,
    senha.length === 0 ? 'digitar a sua senha' : null,
  ].filter((pFalta): pFalta is string => pFalta !== null);
  const podeRemover = !impedida && faltas.length === 0 && !removendo;

  const remover = useCallback(async () => {
    if (!podeRemover || !pacote) return;

    setRemovendo(true);
    try {
      const form = new FormData();
      form.append('arquivo', pacote, pacote.name);
      form.append('documento', documento);
      form.append('senha', senha);

      setResultado(await api.postForm<Resultado>(`${base}/${id}/remove`, form));
    } catch {
      // A recusa do servidor já saiu no diálogo de mensagem, com o motivo; nada foi removido.
    } finally {
      setRemovendo(false);
    }
  }, [podeRemover, pacote, documento, senha, base, id]);

  if (!id) return null;

  // Contar o que a empresa tem percorre todos os módulos e pode demorar: enquanto a contagem não
  // chega, o diálogo já abre e diz o que está sendo feito, em vez de o botão parecer não ter respondido.
  if (!previa) {
    return (
      <XModalShell variant="inline" size="md" title={'Exportar e remover empresa'} closeLabel={'Cancelar'} onClose={onCancel}>
        <div role="status" aria-live="polite" className="flex items-center gap-3 p-6 text-ui text-brand-text-primary">
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{'Contando os registros da empresa em todos os módulos…'}</span>
        </div>
      </XModalShell>
    );
  }

  if (resultado) {
    return (
      <XModalShell variant="inline" size="md" title={'Empresa removida'} closeLabel={'Fechar'} onClose={() => onDone?.()}>
        <div className="p-4 space-y-2 text-ui text-brand-text-primary">
          <p><strong>{resultado.nome}</strong>{' foi removida, com '}<strong>{resultado.totalDeRegistros}</strong>{' registro(s).'}</p>
          <p>{'Guarde o pacote exportado: ele é a única forma de restaurar a empresa, pela ação "Restaurar empresa" desta tela.'}</p>
        </div>
      </XModalShell>
    );
  }

  return (
    <>
      <input ref={seletor.ref} type="file" accept=".zip" className="hidden" onChange={seletor.aoMudar} />
      <XModalShell
        variant="inline" size="lg" title={'Exportar e remover empresa'} closeLabel={'Cancelar'} onClose={onCancel}
        footer={
          <div className="flex items-center justify-end w-full gap-2">
            {!impedida && faltas.length > 0 && (
              <p className="mr-auto text-ui-sm text-brand-text-secondary">
                {'Para remover, falta '}{faltas.join(', ')}{'.'}
              </p>
            )}
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover">
              {'Cancelar'}
            </button>
            <button type="button" onClick={remover} disabled={!podeRemover}
              className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed">
              {removendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {'Remover a empresa'}
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-4 text-ui text-brand-text-primary">
          <div>
            <p className="font-semibold">{previa.nome}</p>
            <p className="text-ui-sm text-brand-text-secondary">{formatDocument(previa.documento)}{' · assinante '}{previa.assinante}</p>
          </div>

          {impedida && (
            <div className="flex gap-2 p-3 rounded-lg border border-border bg-brand-surface">
              <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-semibold">{'Esta empresa não pode ser removida agora.'}</p>
                <p className="text-ui-sm">
                  {'Há registros de outras empresas ligados a ela (ela aparece neles como cliente, fornecedor ou transportadora): '}
                  {previa.impedimentos.map((pI) => `${pI.registro} (${pI.quantidade})`).join(', ')}
                  {'. Desfaça essas ligações nas outras empresas e abra esta ação de novo.'}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 font-medium">{'O que será removido: '}{previa.totalDeRegistros}{' registro(s)'}</p>
            <div className="max-h-48 overflow-auto rounded-lg border border-border-light">
              <table className="w-full text-ui-sm">
                <tbody>
                  {previa.registros.map((pR) => (
                    <tr key={pR.registro} className="border-b border-border-light last:border-b-0">
                      <td className="px-3 py-1">{pR.registro}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{pR.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!impedida && (
            <ol className="space-y-3">
              <li className="space-y-1">
                <p className="font-medium">{'1. Baixe o pacote com todos os dados da empresa'}</p>
                <button type="button" onClick={baixar} disabled={baixando}
                  className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover disabled:opacity-50">
                  {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {'Baixar o pacote (.zip)'}
                </button>
              </li>
              <li className="space-y-1">
                <p className="font-medium">{'2. Envie o arquivo que você baixou'}</p>
                <p className="text-ui-sm text-brand-text-secondary">
                  {'O sistema confere o arquivo com os dados da empresa antes de apagar. Só é removido o que está no arquivo que você tem em mãos.'}
                </p>
                <button type="button" onClick={seletor.abrir}
                  className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover">
                  <FileArchive className="w-4 h-4" /> {pacote ? pacote.name : 'Escolher o arquivo baixado'}
                </button>
              </li>
              <li className="space-y-1">
                <label htmlFor="company-removal-documento" className="block font-medium">
                  {'3. Digite o documento da empresa para confirmar'}
                </label>
                <input
                  id="company-removal-documento" type="text" value={documento} autoComplete="off"
                  onChange={(e) => setDocumento(e.target.value)}
                  className="w-full max-w-xs px-2.5 min-h-editor text-ui-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </li>
              <li className="space-y-1">
                <label htmlFor="company-removal-senha" className="block font-medium">
                  {'4. Digite a sua senha'}
                </label>
                <p className="text-ui-sm text-brand-text-secondary">
                  {'A senha com que você entra no sistema. Ela é pedida de novo porque a remoção não tem volta.'}
                </p>
                <input
                  id="company-removal-senha" type="password" value={senha} autoComplete="current-password"
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full max-w-xs px-2.5 min-h-editor text-ui-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </li>
            </ol>
          )}
        </div>
      </XModalShell>
    </>
  );
}
