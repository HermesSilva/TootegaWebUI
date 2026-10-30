import { useState, useEffect, version as REACT_VERSION, type JSX } from 'react';
import { X, Copy, Check, Server, Monitor, Database, Cpu, Globe, Sparkles } from 'lucide-react';
import { api, getIntlLocale } from '@core/lib';
import { Button } from './Button';
import { useSiteConfig } from '../../hooks/useSiteConfig';

// Provided by Vite define in each consuming project's vite.config.ts
declare const __BUILD_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
// Versões das TECNOLOGIAS do build (TypeScript, Vite, Tailwind) — OPCIONAL: o SaaS que quiser mostrá-las
// as injeta no `define` do vite.config a partir dos pacotes instalados (o ERP faz isso). Sem o define a
// tela diz "N/D", nunca um número inventado: até 2026-10-27 eram quatro literais aqui dentro
// ("19.0.0", "5.6.2", "6.0.5", "3.4.17") parados desde a criação, enquanto o projeto já rodava React 19.3,
// TypeScript 6, Vite 8 e Tailwind 4. A do React vem do próprio runtime e não depende de define.
declare const __TECNOLOGIAS__: { typescript?: string; vite?: string; tailwind?: string } | undefined;

const BUILD_VERSION = __BUILD_VERSION__;
const BUILD_DATE = new Date(parseInt(__BUILD_TIMESTAMP__)).toISOString();
const TECNOLOGIAS = typeof __TECNOLOGIAS__ === 'undefined' ? {} : __TECNOLOGIAS__;
import type { SystemInfo, ClientInfo } from '@core/types/system.types';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';
import { XNovidadesModal } from '../novidades/XNovidadesModal';

interface SystemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getClientInfo(): ClientInfo {
  const nav = navigator as Navigator & { 
    deviceMemory?: number; 
    hardwareConcurrency?: number;
    userAgentData?: { platform?: string };
  };

  // Browser detection
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+(\.\d+)?)/)?.[1] ?? '';
  } else if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
    browserVersion = ua.match(/Edg\/(\d+(\.\d+)?)/)?.[1] ?? '';
  } else if (ua.includes('Chrome/')) {
    browser = 'Google Chrome';
    browserVersion = ua.match(/Chrome\/(\d+(\.\d+)?)/)?.[1] ?? '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+(\.\d+)?)/)?.[1] ?? '';
  }

  // OS detection
  let os = 'Unknown';
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  return {
    version: BUILD_VERSION,
    buildDate: new Date(BUILD_DATE).toLocaleString(getIntlLocale()),
    browser,
    browserVersion,
    os,
    platform: nav.userAgentData?.platform ?? navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width} x ${screen.height}`,
    windowSize: `${window.innerWidth} x ${window.innerHeight}`,
    deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'N/D',
    cpuCores: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} cores` : 'N/D',
    userAgent: ua,
    react: REACT_VERSION,
    typescript: TECNOLOGIAS.typescript ?? 'N/D',
    vite: TECNOLOGIAS.vite ?? 'N/D',
    tailwind: TECNOLOGIAS.tailwind ?? 'N/D',
  };
}

function formatUptime(uptime: string): string {
  // Format: "HH:MM:SS.milliseconds" or "D.HH:MM:SS.milliseconds"
  // Example: "00:46:29.4745685" or "1.02:30:45.1234567"
  
  // Try format with days: D.HH:MM:SS
  const withDays = uptime.match(/^(\d+)\.(\d+):(\d+):(\d+)/);
  if (withDays) {
    const days = parseInt(withDays[1], 10);
    const hours = parseInt(withDays[2], 10);
    const mins = parseInt(withDays[3], 10);
    
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    return parts.join(' ') || '< 1m';
  }
  
  // Try format without days: HH:MM:SS
  const withoutDays = uptime.match(/^(\d+):(\d+):(\d+)/);
  if (withoutDays) {
    const hours = parseInt(withoutDays[1], 10);
    const mins = parseInt(withoutDays[2], 10);
    const secs = parseInt(withoutDays[3], 10);
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (parts.length === 0 && secs > 0) parts.push(`${secs}s`);
    return parts.join(' ') || '< 1m';
  }
  
  return uptime;
}

function formatMemory(mb: number): string {
  if (mb >= 1024)
    return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function SystemInfoModal({ isOpen, onClose }: SystemInfoModalProps): JSX.Element | null {
  const [serverInfo, setServerInfo] = useState<SystemInfo | null>(null);
  // Atalho para as NOVIDADES DA VERSÃO (dono, 2026-10-25): o histórico inteiro, da mais nova para a mais velha.
  const [novidadesAbertas, setNovidadesAbertas] = useState(false);
  const [clientInfo] = useState<ClientInfo>(getClientInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { config } = useSiteConfig();

  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    setError(null);
    
    api.get<SystemInfo>('/sys/info')
      .then(setServerInfo)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  function generateReport(): string {
    // Título centrado na largura da moldura (63); o nome do produto vem do back, não do motor.
    const title = `${config.nome} - SYSTEM INFO`;
    const leftPad = Math.max(0, Math.floor((63 - title.length) / 2));
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      (' '.repeat(leftPad) + title).padEnd(63),
      '═══════════════════════════════════════════════════════════════',
      '',
      '┌─────────────────────────────────────────────────────────────┐',
      `│  ${'Front-end'.toUpperCase().padEnd(58)}│`,
      '├─────────────────────────────────────────────────────────────┤',
      `│  ${('Versão' + ':').padEnd(17)}${clientInfo.version.padEnd(40)}│`,
      `│  ${('Compilação' + ':').padEnd(17)}${clientInfo.buildDate.padEnd(40)}│`,
      `│  ${('Navegador' + ':').padEnd(17)}${(clientInfo.browser + ' ' + clientInfo.browserVersion).padEnd(40)}│`,
      `│  ${('Sistema operacional' + ':').padEnd(17)}${clientInfo.os.padEnd(40)}│`,
      `│  ${('Plataforma' + ':').padEnd(17)}${clientInfo.platform.padEnd(40)}│`,
      `│  ${('Idioma' + ':').padEnd(17)}${clientInfo.language.padEnd(40)}│`,
      `│  ${('Resolução da tela' + ':').padEnd(17)}${clientInfo.screenResolution.padEnd(40)}│`,
      `│  ${('Tamanho da janela' + ':').padEnd(17)}${clientInfo.windowSize.padEnd(40)}│`,
      `│  ${('Memória' + ':').padEnd(17)}${clientInfo.deviceMemory.padEnd(40)}│`,
      `│  ${('Processador' + ':').padEnd(17)}${clientInfo.cpuCores.padEnd(40)}│`,
      '├─────────────────────────────────────────────────────────────┤',
      '│  FRAMEWORKS                                                  │',
      '├─────────────────────────────────────────────────────────────┤',
      `│  React:            ${clientInfo.react.padEnd(40)}│`,
      `│  TypeScript:       ${clientInfo.typescript.padEnd(40)}│`,
      `│  Vite:             ${clientInfo.vite.padEnd(40)}│`,
      `│  Tailwind CSS:     ${clientInfo.tailwind.padEnd(40)}│`,
      '└─────────────────────────────────────────────────────────────┘',
    ];

    if (serverInfo) {
      lines.push('');
      lines.push('┌─────────────────────────────────────────────────────────────┐');
      lines.push(`│  ${'Back-end'.toUpperCase().padEnd(58)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${('Aplicação' + ':').padEnd(17)}${serverInfo.application.name.padEnd(40)}│`);
      lines.push(`│  ${('Versão' + ':').padEnd(17)}${serverInfo.application.version.padEnd(40)}│`);
      lines.push(`│  ${('Ambiente' + ':').padEnd(17)}${serverInfo.application.environment.padEnd(40)}│`);
      lines.push(`│  ${('Iniciado em' + ':').padEnd(17)}${new Date(serverInfo.application.startedAt).toLocaleString(getIntlLocale()).padEnd(40)}│`);
      lines.push(`│  ${('Tempo no ar' + ':').padEnd(17)}${formatUptime(serverInfo.application.uptime).padEnd(40)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${'Sistema operacional'.toUpperCase().padEnd(58)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${('Nome' + ':').padEnd(17)}${serverInfo.operatingSystem.name.padEnd(40)}│`);
      lines.push(`│  ${('Versão' + ':').padEnd(17)}${serverInfo.operatingSystem.version.substring(0, 40).padEnd(40)}│`);
      lines.push(`│  ${('Arquitetura' + ':').padEnd(17)}${serverInfo.operatingSystem.architecture.padEnd(40)}│`);
      lines.push(`│  ${('Máquina' + ':').padEnd(17)}${serverInfo.operatingSystem.machineName.padEnd(40)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push('│  HARDWARE                                                   │');
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${('Processadores' + ':').padEnd(17)}${(serverInfo.hardware.processorCount + ' cores').padEnd(40)}│`);
      lines.push(`│  ${('Memória total' + ':').padEnd(17)}${formatMemory(serverInfo.hardware.totalMemoryMB).padEnd(40)}│`);
      lines.push(`│  ${('Memória usada' + ':').padEnd(17)}${formatMemory(serverInfo.hardware.usedMemoryMB).padEnd(40)}│`);
      lines.push(`│  ${('Memória livre' + ':').padEnd(17)}${formatMemory(serverInfo.hardware.availableMemoryMB).padEnd(40)}│`);
      lines.push(`│  ${('Uso de memória' + ':').padEnd(17)}${(serverInfo.hardware.memoryUsagePercent + '%').padEnd(40)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${'Banco de dados'.toUpperCase().padEnd(58)}│`);
      lines.push('├─────────────────────────────────────────────────────────────┤');
      lines.push(`│  ${('Provedor' + ':').padEnd(17)}${serverInfo.database.provider.padEnd(40)}│`);
      lines.push(`│  ${('Versão' + ':').padEnd(17)}${(serverInfo.database.version ?? 'N/D').padEnd(40)}│`);
      lines.push(`│  ${('Conectado' + ':').padEnd(17)}${(serverInfo.database.isConnected ? 'Sim' : 'Não').padEnd(40)}│`);
      lines.push('└─────────────────────────────────────────────────────────────┘');
    }

    lines.push('');
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│  USER AGENT                                                 │');
    lines.push('├─────────────────────────────────────────────────────────────┤');
    
    // Break user agent into multiple lines
    const uaLines = clientInfo.userAgent.match(/.{1,57}/g) ?? [clientInfo.userAgent];
    for (const line of uaLines)
      lines.push(`│  ${line.padEnd(58)}│`);
    
    lines.push('└─────────────────────────────────────────────────────────────┘');
    lines.push('');
    lines.push(`${'Gerado em'}: ${new Date().toLocaleString(getIntlLocale())}`);
    
    return lines.join('\n');
  }

  async function handleCopy(): Promise<void> {
    const report = generateReport();
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen) return null;

  return (
    <>
    {novidadesAbertas && <XNovidadesModal modo="historico" onFechar={() => setNovidadesAbertas(false)} />}
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      {/* Teto duro de modal: 80% da área, largura e altura (dono, 2026-07-12). */}
      <XCartaoDeModal className="bg-brand-surface rounded-xl w-full max-w-[min(900px,80vw)] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-border-light bg-brand-background shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt={'Logotipo'} className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-brand-text-primary whitespace-nowrap">{'Informações do sistema'}</h2>
              <p className="text-ui-xs text-brand-text-muted whitespace-nowrap">{'Detalhes técnicos do ambiente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setNovidadesAbertas(true)}
              data-testid="system-info-novidades"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-ui-sm font-medium text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
            >
              <Sparkles size={16} />
              {'Novidades da versão'}
            </button>
            <button
              onClick={onClose}
              aria-label={'Fechar'}
              className="min-h-touch min-w-touch flex items-center justify-center rounded-lg hover:bg-hover transition-colors text-brand-text-muted hover:text-brand-text-primary shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-brand-text-secondary">{'Carregando…'}</div>
            </div>
          )}

          {error && (
            <div className="bg-danger-bg border border-danger rounded-lg p-4 mb-4">
              <p className="text-danger text-ui-sm">{'Falha ao carregar as informações.'}: {error}</p>
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Client Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-brand-primary mb-3">
                  <Monitor size={18} />
                  <h3 className="font-semibold text-brand-text-primary">{'Front-end'}</h3>
                </div>

                <div className="bg-brand-background rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Versão'}</span>
                    <span className="text-ui-sm text-brand-text-primary font-medium">{clientInfo.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Compilação'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.buildDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Navegador'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.browser} {clientInfo.browserVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Sistema operacional'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.os}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Resolução'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.screenResolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Memória'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.deviceMemory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">{'Processador'}</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.cpuCores}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-brand-primary mt-4 mb-3">
                  <Globe size={18} />
                  <h3 className="font-semibold text-brand-text-primary">{'Tecnologias'}</h3>
                </div>

                <div className="bg-brand-background rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">React</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.react}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">TypeScript</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.typescript}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">Vite</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.vite}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ui-sm text-brand-text-muted">Tailwind CSS</span>
                    <span className="text-ui-sm text-brand-text-primary">{clientInfo.tailwind}</span>
                  </div>
                </div>
              </div>

              {/* Server Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-brand-primary mb-3">
                  <Server size={18} />
                  <h3 className="font-semibold text-brand-text-primary">{'Back-end'}</h3>
                </div>

                {serverInfo ? (
                  <>
                    <div className="bg-brand-background rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Aplicação'}</span>
                        <span className="text-ui-sm text-brand-text-primary font-medium">{serverInfo.application.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Versão'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.application.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Ambiente'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.application.environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Tempo no ar'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{formatUptime(serverInfo.application.uptime)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-brand-primary mt-4 mb-3">
                      <Cpu size={18} />
                      <h3 className="font-semibold text-brand-text-primary">{'Hardware'}</h3>
                    </div>

                    <div className="bg-brand-background rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Máquina'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.operatingSystem.machineName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'SO'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.operatingSystem.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Processadores'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.hardware.processorCount} {'Núcleos'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Memória total'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{formatMemory(serverInfo.hardware.totalMemoryMB)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Uso de memória'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.hardware.memoryUsagePercent}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-brand-primary mt-4 mb-3">
                      <Database size={18} />
                      <h3 className="font-semibold text-brand-text-primary">{'Banco de dados'}</h3>
                    </div>

                    <div className="bg-brand-background rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Provedor'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.database.provider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Versão'}</span>
                        <span className="text-ui-sm text-brand-text-primary">{serverInfo.database.version ?? 'N/D'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ui-sm text-brand-text-muted">{'Estado'}</span>
                        <span className={`text-ui-sm font-medium ${serverInfo.database.isConnected ? 'text-success' : 'text-danger'}`}>
                          {serverInfo.database.isConnected ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : !loading && (
                  <div className="bg-brand-background rounded-lg p-4 text-center text-brand-text-muted">
                    {'Servidor indisponível'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-border-light bg-brand-background shrink-0">
          <Button
            variant="secondary"
            onClick={handleCopy}
            className="flex items-center gap-2"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button onClick={onClose}>
            {'Fechar'}
          </Button>
        </div>
      </XCartaoDeModal>
    </div>
    </>
  );
}
