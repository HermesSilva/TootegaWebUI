import { useContext, useState, type JSX } from 'react';
import { Maximize2, Menu, Minimize2 } from 'lucide-react';
import { AppTabBar, Avatar, Logo, SystemInfoModal, IconButton, CompanyLogo, SinoMensagens } from '@core/components/ui';
import { useSidebar, useCompany, useSiteConfig } from '@core/hooks';
import { TabsContext } from '@core/contexts/TabsContext';
import { PainelJaci } from '@core/components/jaci';

interface HeaderProps {
  onManageDeleted?: () => void;
}

export function Header({ onManageDeleted }: HeaderProps): JSX.Element {
  const { isMobile, toggle } = useSidebar();
  const { company, openSelector } = useCompany();
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  // O nome do produto vem do back (SYS:Aplicacao:Nome): o motor serve a todos os SaaS e não crava marca.
  const { config } = useSiteConfig();
  // ÁREA DE TRABALHO EXPANDIDA (dono, 2026-10-25): as abas sobem para cá, entre a empresa e a Jaci, e o nome do
  // produto sai (o logo fica). O estado mora no contexto das abas, lembrado no perfil; sem provider de abas (tela
  // sem casca), não há botão. No celular não cabe: o modo não se aplica.
  const abas = useContext(TabsContext);
  const expandido = !!abas?.abasNoCabecalho && !isMobile;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 h-header bg-brand-surface border-b border-border-light z-40"
        data-tour="app-header"
      >
        <div className="h-full px-2 sm:px-4 flex items-center gap-3">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            {isMobile && (
              <IconButton onClick={toggle} aria-label={'Abrir menu'}>
                <Menu size={22} className="text-brand-text-secondary" />
              </IconButton>
            )}
            <div data-tour="app-logo">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setShowSystemInfo(true)}
                  className="text-ui font-semibold text-brand-text-primary whitespace-nowrap"
                >
                  {config.nome}
                </button>
              ) : (
                <Logo size="sm" showText={!expandido} name={config.nome} description={config.descricao} onClick={() => setShowSystemInfo(true)} />
              )}
            </div>

            {/* Empresa corrente — destacada ao lado do nome do produto; clicar troca de empresa. O nome vem inteiro,
                numa linha (dono, 2026-10-25): quem cede espaço é a barra de abas, que rola. */}
            {company && (
              <button
                type="button"
                onClick={openSelector}
                data-testid="header-company"
                title={`${company.razaoSocial} — ${'Trocar de empresa'}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-primary/40 bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors duration-200 shrink-0`}
              >
                <CompanyLogo companyID={company.sysxPessoaID} />
                <span className="text-ui font-semibold text-brand-primary whitespace-nowrap">{company.nome}</span>
              </button>
            )}
          </div>

          {/* As abas das Apps, quando a área de trabalho está expandida. */}
          <div className="flex-1 min-w-0 h-full">
            {expandido && abas && (
              <AppTabBar
                tabs={abas.tabs}
                activeTabId={abas.activeTabId}
                onTabChange={abas.setActiveTab}
                onTabClose={abas.closeTab}
                noCabecalho
              />
            )}
          </div>

          {/* Ajuda (a Jaci, ADR-0007), sino, avatar e o botão de expandir. O manual continua a um clique — dentro do painel. */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <PainelJaci />
            <SinoMensagens />
            <Avatar onManageDeleted={onManageDeleted} />
            {abas && !isMobile && (
              <button
                type="button"
                onClick={() => abas.definirAbasNoCabecalho(!abas.abasNoCabecalho)}
                aria-pressed={expandido}
                aria-label={expandido ? 'Contrair a área de trabalho' : 'Expandir a área de trabalho'}
                title={expandido
                  ? 'Contrair: as abas voltam para baixo do cabeçalho e o nome do produto reaparece'
                  : 'Expandir: as abas sobem para o cabeçalho, e o conteúdo ganha uma linha'}
                data-testid="header-expandir"
                className="-ml-1 sm:-ml-2 flex items-center justify-center w-7 h-7 rounded-md text-brand-text-muted hover:text-brand-text-primary hover:bg-hover transition-colors duration-150"
              >
                {expandido ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
          </div>
        </div>
      </header>

      <SystemInfoModal
        isOpen={showSystemInfo}
        onClose={() => setShowSystemInfo(false)}
      />
    </>
  );
}
