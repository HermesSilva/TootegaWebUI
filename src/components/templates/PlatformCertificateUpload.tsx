/**
 * PlatformCertificateUpload — custom button action (platformCertificateAdd) for the Platform
 * Certificates app (SaaS-admin). A slimmer sibling of CertificateBatchUpload: a platform certificate
 * has NO company and NO "by proxy" — it is the SaaS's own A1, used to authenticate SEFAZ diagnostic
 * calls (the endpoint status test). Flow: pick .pfx files → dialog lists them, one password each →
 * submit multipart, one request per file, to {apiBaseURL}/add. Data-driven (CE-19): endpoint from
 * the app model.
 */

import { useState, useRef, useEffect, useCallback, type JSX } from 'react';
import { Loader2, X, ShieldCheck, UploadCloud } from 'lucide-react';
import { api } from '@core/lib/api';
import { useSeletorDeArquivo } from '@core/hooks/useSeletorDeArquivo';
import type { XButtonActionComponentProps } from './XButtonActionRegistry';
import { XModalShell } from './XModalShell';
import { baseDaApp } from '@core/lib';

interface Linha {
  file: File;
  senha: string;
  /** A senha veio do nome do arquivo (e não do teclado) — some assim que o usuário a edita. */
  resultado?: { sucesso: boolean; mensagem: string };
}

export function PlatformCertificateUpload({ application, onCancel, onDone }: XButtonActionComponentProps): JSX.Element {
  const base = baseDaApp(application.apiBaseURL);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [enviando, setEnviando] = useState(false);

  // O número de linhas entra por ref porque quem o lê é o callback de CANCELAMENTO, preso uma vez.
  const linhasRef = useRef(0);
  linhasRef.current = linhas.length;

  const seletor = useSeletorDeArquivo({
    onEscolher: (pArquivos) => setLinhas((prev) => [
      ...prev,
      ...pArquivos.map((f) => ({ file: f, senha: '' })),
    ]),
    onCancelar: () => { if (linhasRef.current === 0) onCancel(); },
  });

  // Abre o seletor UMA vez, quando a ação monta (mesmo guarda do CertificateBatchUpload).
  const jaAbriu = useRef(false);
  useEffect(() => {
    if (jaAbriu.current) return;
    jaAbriu.current = true;
    seletor.abrir();
  }, [seletor]);

  const atualizar = useCallback((pIdx: number, pPatch: Partial<Linha>) => {
    setLinhas((prev) => prev.map((l, i) => (i === pIdx ? { ...l, ...pPatch } : l)));
  }, []);

  const remover = useCallback((pIdx: number) => {
    setLinhas((prev) => prev.filter((_, i) => i !== pIdx));
  }, []);

  const podeEnviar = linhas.length > 0 && linhas.every((l) => l.senha.trim().length > 0);

  const enviar = useCallback(async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      // Um upload por arquivo: o endpoint de plataforma recebe um PFX + senha por requisição.
      const comResultado: Linha[] = [];
      for (const l of linhas) {
        const form = new FormData();
        form.append('arquivo', l.file, l.file.name);
        form.append('senha', l.senha);
        try {
          const r = await api.postForm<{ arquivoNome: string; sucesso: boolean; mensagem: string }>(`${base}/add`, form);
          comResultado.push({ ...l, resultado: { sucesso: r.sucesso, mensagem: r.mensagem } });
        } catch (e) {
          comResultado.push({ ...l, resultado: { sucesso: false, mensagem: e instanceof Error ? e.message : 'Falha ao enviar o certificado.' } });
        }
      }
      setLinhas(comResultado);
      if (comResultado.every((l) => l.resultado?.sucesso)) onDone?.();
    } finally {
      setEnviando(false);
    }
  }, [podeEnviar, linhas, base, onDone]);

  return (
    <>
      <input ref={seletor.ref} type="file" accept=".pfx,.p12" multiple className="hidden" onChange={seletor.aoMudar} />
      {linhas.length > 0 && (
        <XModalShell
          variant="inline" size="lg" title={'Adicionar certificados de plataforma'} closeLabel={'Cancelar'} onClose={onCancel}
          footer={
            <div className="flex items-center justify-between w-full gap-3">
              <button type="button" onClick={seletor.abrir}
                className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-primary hover:bg-brand-primary/10 rounded-lg">
                <UploadCloud className="w-4 h-4" /> {'Adicionar mais'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onCancel}
                  className="px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover">
                  {'Cancelar'}
                </button>
                <button type="button" onClick={enviar} disabled={!podeEnviar || enviando}
                  className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {'Enviar'}
                </button>
              </div>
            </div>
          }
        >
          <div className="p-4 space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_180px_32px] gap-2 px-1 text-ui-xs tracking-wider text-brand-text-secondary">
              <span>{'Arquivo'}</span><span>{'Senha'}</span><span />
            </div>
            {linhas.map((l, i) => (
              <div key={`${l.file.name}-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_32px] gap-2 items-center p-2 rounded-lg border border-border-light bg-brand-surface">
                <div className="min-w-0">
                  <span className="block text-ui-sm font-medium text-brand-text-primary break-all" title={l.file.name}>{l.file.name}</span>
                  {l.resultado && !l.resultado.sucesso && (
                    <span className="block text-ui-xs text-danger">{(l.resultado.mensagem ?? '')}</span>
                  )}
                  {l.resultado?.sucesso && <span className="block text-ui-xs text-success">{'Adicionado'}</span>}
                </div>
                <div className="min-w-0">
                  <input
                    type="password" value={l.senha}
                    onChange={(e) => atualizar(i, { senha: e.target.value })}
                    placeholder={'Senha'}
                    className="w-full px-2.5 min-h-editor text-ui-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
                <button type="button" onClick={() => remover(i)} className="p-1.5 text-brand-text-muted hover:text-danger rounded justify-self-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </XModalShell>
      )}
    </>
  );
}
