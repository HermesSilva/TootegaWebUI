/**
 * CompanyRestore — custom button action (companyRestore) of the platform app "Remoção de empresa".
 *
 * Sends a package exported by CompanyRemoval back to the server, which writes the company and all its
 * records again. The server validates the package (integrity, version, records it cites) and writes
 * nothing when it is refused. Data-driven (CE-19): the endpoint comes from the app model.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ArchiveRestore, FileArchive, Loader2 } from 'lucide-react';
import { api } from '@core/lib/api';
import { baseDaApp } from '@core/lib';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import type { XButtonActionComponentProps } from './XButtonActionRegistry';
import { XModalShell } from './XModalShell';

interface Contagem {
  registro: string;
  quantidade: number;
}

interface Resultado {
  nome: string;
  totalDeRegistros: number;
  registros: Contagem[];
  comIdentificadorNovo: string[];
}

export function CompanyRestore({ application, onCancel, onDone }: XButtonActionComponentProps): JSX.Element | null {
  const base = baseDaApp(application.apiBaseURL);

  const [pacote, setPacote] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // O arquivo escolhido entra por ref porque quem o lê é o callback de CANCELAMENTO, preso uma vez.
  const temPacote = useRef(false);
  temPacote.current = pacote !== null;

  const seletor = useSeletorDeArquivo({
    onEscolher: (pArquivos) => setPacote(pArquivos[0] ?? null),
    onCancelar: () => { if (!temPacote.current) onCancel(); },
  });

  // Abre o seletor UMA vez, quando a ação monta.
  const jaAbriu = useRef(false);
  useEffect(() => {
    if (jaAbriu.current) return;
    jaAbriu.current = true;
    seletor.abrir();
  }, [seletor]);

  const restaurar = useCallback(async () => {
    if (!pacote) return;

    setEnviando(true);
    try {
      const form = new FormData();
      form.append('arquivo', pacote, pacote.name);

      setResultado(await api.postForm<Resultado>(`${base}/restore`, form));
    } catch {
      // A recusa do servidor já saiu no diálogo de mensagem, com o motivo; nada foi gravado.
    } finally {
      setEnviando(false);
    }
  }, [pacote, base]);

  if (resultado) {
    return (
      <XModalShell variant="inline" size="md" title={'Empresa restaurada'} closeLabel={'Fechar'} onClose={() => onDone?.()}>
        <div className="p-4 space-y-3 text-ui text-brand-text-primary">
          <p><strong>{resultado.nome}</strong>{' foi restaurada, com '}<strong>{resultado.totalDeRegistros}</strong>{' registro(s).'}</p>
          {resultado.comIdentificadorNovo.length > 0 && (
            <p className="text-ui-sm">
              {'Estes registros receberam identificador novo, porque o original já estava em uso: '}
              {resultado.comIdentificadorNovo.join(', ')}
              {'. As ligações entre eles foram refeitas; um número anotado fora do sistema pode não valer mais.'}
            </p>
          )}
          <div className="max-h-48 overflow-auto rounded-lg border border-border-light">
            <table className="w-full text-ui-sm">
              <tbody>
                {resultado.registros.map((pR) => (
                  <tr key={pR.registro} className="border-b border-border-light last:border-b-0">
                    <td className="px-3 py-1">{pR.registro}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{pR.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </XModalShell>
    );
  }

  return (
    <>
      <input ref={seletor.ref} type="file" accept=".zip" className="hidden" onChange={seletor.aoMudar} />
      {pacote && (
        <XModalShell
          variant="inline" size="md" title={'Restaurar empresa'} closeLabel={'Cancelar'} onClose={onCancel}
          footer={
            <div className="flex items-center justify-end w-full gap-2">
              <button type="button" onClick={onCancel}
                className="px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover">
                {'Cancelar'}
              </button>
              <button type="button" onClick={restaurar} disabled={enviando}
                className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />} {'Restaurar'}
              </button>
            </div>
          }
        >
          <div className="p-4 space-y-3 text-ui text-brand-text-primary">
            <p>{'A empresa e todos os registros do pacote serão gravados de volta. Se o pacote não puder ser restaurado, nada é gravado e o motivo é mostrado.'}</p>
            <button type="button" onClick={seletor.abrir}
              className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover">
              <FileArchive className="w-4 h-4" /> {pacote.name}
            </button>
          </div>
        </XModalShell>
      )}
    </>
  );
}
