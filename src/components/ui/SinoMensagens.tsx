import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Bell, BellOff, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight,
  Info, XCircle, type LucideIcon,
} from 'lucide-react';
import { useInbox, type MensagemInbox } from '@core/hooks/useInbox';
import { useTabs } from '@core/hooks/useTabs';
import { useUserMenu } from '@core/hooks/useMenu';
import { formatDateTime, formatRelativeTime } from '@core/lib/formatting';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { MessageText, primeiroLinkDeApp, resumoDeMensagem } from './MessageText';

/**
 * Traje da severidade (CE-20: a cor e o ícone mudam, o quadro não). 1 Informação, 2 Sucesso,
 * 3 Aviso, 4 Erro. O ícone existe porque a cor sozinha não informa quem não a distingue — e porque,
 * numa lista recolhida, ele é lido antes do título.
 */
interface TrajeSeveridade {
  borda: string;
  icone: LucideIcon;
  corIcone: string;
  corLink: string;
}

const TRAJE_SEVERIDADE: Record<number, TrajeSeveridade> = {
  1: { borda: 'border-l-blue-400', icone: Info, corIcone: 'text-blue-400', corLink: 'text-blue-400' },
  2: { borda: 'border-l-green-500', icone: CheckCircle2, corIcone: 'text-green-500', corLink: 'text-green-500' },
  3: { borda: 'border-l-orange-500', icone: AlertTriangle, corIcone: 'text-orange-500', corLink: 'text-orange-500' },
  4: { borda: 'border-l-red-500', icone: XCircle, corIcone: 'text-red-500', corLink: 'text-red-400' },
};

const TRAJE_PADRAO: TrajeSeveridade = {
  borda: 'border-l-brand-primary',
  icone: Info,
  corIcone: 'text-brand-text-secondary',
  corLink: 'text-brand-primary',
};

function trajeDe(pSeveridade: number): TrajeSeveridade {
  return TRAJE_SEVERIDADE[pSeveridade] ?? TRAJE_PADRAO;
}

/**
 * A REFERÊNCIA da mensagem — `<App>:<chave>` ("LOGxRegistro:4271") —, que o remetente preenche ao
 * gravar no inbox e que aponta o registro de que a mensagem fala.
 *
 * <b>É ela que faz TODA mensagem ter destino</b> (dono, 2026-08-12), e não o texto: o corpo é imutável
 * depois de gravado, então mensagem escrita por uma versão anterior do servidor nunca ganharia um link
 * novo — a caixa do operador não melhoraria por mais que o código melhorasse. A referência é dado
 * estruturado, não prosa: quem grava diz para onde a mensagem leva, e o front só resolve.
 *
 * Continua genérico (CE-19): o front não conhece App nenhuma — pega o NOME que veio e o procura no
 * menu do próprio usuário, exatamente como faz com o link do corpo. Sem `:`, sem nome ou sem chave,
 * não há destino, e nada se inventa.
 */
function lerReferencia(pReferencia: string | undefined): { app: string; chave: string } | null {
  const corte = pReferencia?.indexOf(':') ?? -1;

  if (!pReferencia || corte <= 0)
    return null;

  const app = pReferencia.slice(0, corte).trim();
  const chave = pReferencia.slice(corte + 1).trim();

  return app && chave ? { app, chave } : null;
}

/**
 * Sino de mensagens da casca (não é modal de App — é elemento do shell, logo pode sobrepor). Mostra o
 * número de não lidas e, ao abrir, a lista; cada mensagem pode ser marcada como lida. As mensagens
 * chegam em tempo real (WebSocket) e sobrevivem ao navegador fechado (inbox durável). Fecha ao clicar
 * fora (listener no documento — sem véu que cubra a tela).
 *
 * <b>A mensagem entra RECOLHIDA</b> (dono, 2026-08-12): ícone da gravidade, título inteiro em duas
 * linhas, a idade do aviso e duas linhas de prévia. Aberta por inteiro de saída, uma dúzia de alertas
 * de log — que trazem repetição, mensagem, regra e link — viravam um rolo em que nada se acha; e o
 * título, que é o que se varre com o olho, saía cortado no meio da palavra.
 */
export function SinoMensagens(): JSX.Element {
  const { mensagens, naoLidas, conectado, falha, marcarLida, marcarTodasLidas } = useInbox();
  const { data: menu } = useUserMenu();
  const { openTab, setActiveTab, getTabsByMenuItemID } = useTabs();
  const [aberto, setAberto] = useState(false);
  const [expandidas, setExpandidas] = useState<ReadonlySet<string>>(new Set());
  const [ancora, setAncora] = useState<{ top: number; right: number; z: number } | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  /**
   * Abre/fecha o painel — e, ao abrir, mede onde ele cai e em que camada.
   *
   * <b>Por que medir e portar.</b> O painel vivia dentro do cabeçalho, que é `fixed z-40`. Um
   * elemento posicionado com z-index cria contexto de empilhamento: nenhum `z` do filho escapa dele.
   * Como o conteúdo do App usa o `ZIndexManager` (a partir de 1000), a lista de mensagens saía POR
   * TRÁS do formulário aberto — observado 2026-08-12. Fora do cabeçalho, ancorada ao botão e com a
   * próxima camada do gerenciador, ela fica acima do que estiver aberto, que é o que se espera de um
   * elemento da casca.
   */
  const alternarPainel = useCallback(() => {
    setAberto((pAtual) => {
      if (pAtual)
        return false;

      const botao = raizRef.current?.getBoundingClientRect();

      setAncora({
        top: (botao?.bottom ?? 0) + 8,
        right: Math.max(8, window.innerWidth - (botao?.right ?? 0)),
        z: ZIndexManager.next(),
      });

      return true;
    });
  }, []);

  const alternar = useCallback((pID: string) => {
    setExpandidas((pAtuais) => {
      const proximas = new Set(pAtuais);

      if (!proximas.delete(pID))
        proximas.add(pID);

      return proximas;
    });
  }, []);

  /**
   * Resolve o App que a mensagem cita — pelo texto (`[[app:Nome|Rótulo]]`) ou pela referência — contra
   * o MENU DO PRÓPRIO USUÁRIO. Mesma mecânica do diálogo de erro, e pela mesma razão: o back manda um
   * NOME de App, nunca um endereço, e o que não está no menu dele não vira link (sem permissão, ou nome
   * que não existe mais).
   *
   * Com RECORTE ou REGISTRO, abre aba nova mesmo já havendo uma: focar a existente entregaria a tela
   * no estado em que ela estava, e não o evento que a mensagem cita — o link pareceria não funcionar.
   */
  const resolverLinkApp = useCallback((
    pNomeApp: string,
    pRecorte?: Record<string, string>,
    pRegistroID?: string
  ): (() => void) | null => {
    const item = menu?.groups
      .flatMap((pGrupo) => pGrupo.items)
      .find((pItem) => pItem.name.toLowerCase() === pNomeApp.toLowerCase());

    if (!item)
      return null;

    return () => {
      const abertas = getTabsByMenuItemID(item.id);

      if (abertas.length > 0 && !pRecorte && !pRegistroID)
        setActiveTab(abertas[0].id);
      else
        openTab(item, pRecorte, pRegistroID);

      // O painel sai da frente: quem clicou já está indo para outra tela.
      setAberto(false);
    };
  }, [menu, openTab, setActiveTab, getTabsByMenuItemID]);

  useEffect(() => {
    if (!aberto)
      return;

    // O painel mora FORA desta árvore (portal), então o clique-fora tem de olhar os dois: o botão e
    // a lista. Sem isso, clicar dentro da própria lista a fecharia.
    const aoClicar = (pEvento: MouseEvent) => {
      const alvo = pEvento.target as Node;

      if (!raizRef.current?.contains(alvo) && !painelRef.current?.contains(alvo))
        setAberto(false);
    };

    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  return (
    <div className="relative" ref={raizRef}>
      <button
        type="button"
        onClick={alternarPainel}
        aria-label={naoLidas > 0 ? `Mensagens: ${naoLidas} não lida(s)` : 'Mensagens'}
        data-testid="header-inbox"
        className="relative flex items-center p-2 rounded-lg text-brand-text-primary hover:bg-brand-background transition-colors duration-200"
      >
        <Bell size={18} className="text-brand-text-secondary" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && createPortal(
        // FORA do cabeçalho, e em camada do `ZIndexManager`: quem abre por último fica por cima, sem
        // ninguém ter de adivinhar um número. Ancorada ao botão (`fixed`), a lista acompanha a
        // posição do sino sem herdar o contexto de empilhamento dele.
        //
        // 400px, e não 320: o alerta de log traz rota, duração e limiar numa frase só, e a largura
        // anterior a quebrava em cinco linhas. `scrollbar-thin` é a barra discreta da casca.
        <div
          ref={painelRef}
          data-testid="inbox-painel"
          style={{ top: ancora?.top ?? 0, right: ancora?.right ?? 0, zIndex: ancora?.z }}
          className="fixed w-[25rem] max-h-[70vh] overflow-y-auto scrollbar-thin rounded-lg border border-border-light bg-brand-surface shadow-lg"
        >
          {/* Barra de título: o rótulo com a contagem à esquerda e, à direita, o "Limpar tudo". Ele só
              existe quando há o que limpar — botão que não faz nada é ruído. */}
          <div className="sticky top-0 z-10 px-4 py-2 border-b border-border-light bg-brand-surface flex items-center justify-between gap-2">
            <span className="text-ui font-semibold text-brand-text-primary">
              {'Mensagens'}
              {mensagens.length > 0 && (
                <span className="ml-2 text-ui-sm font-normal text-brand-text-muted">{mensagens.length}</span>
              )}
            </span>

            {mensagens.length > 0 && (
              <button
                type="button"
                onClick={marcarTodasLidas}
                aria-label={'Limpar tudo'}
                // O título diz o que acontece E o que NÃO acontece: quem vê 44 avisos sumirem de uma
                // vez precisa saber, antes de clicar, que não está apagando nada.
                title={'Marca todas como lidas. As mensagens continuam no histórico.'}
                data-testid="inbox-limpar-tudo"
                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-ui
                           text-brand-text-secondary hover:bg-brand-background hover:text-brand-text-primary
                           transition-colors"
              >
                <CheckCheck size={16} />
                <span>{'Limpar tudo'}</span>
              </button>
            )}
          </div>

          {/* CAIXA VAZIA e CAIXA QUE NÃO CARREGOU são coisas diferentes, e a tela precisa dizer qual
              das duas é (CE-21-quater). O texto vem do servidor; na falta dele, o `mensagemDeFalha`
              nomeia a operação com método, rota e status, em vez de uma frase que serviria para
              qualquer falha. */}
          {falha && (
            <div
              data-testid="inbox-falha"
              className="px-4 py-3 border-b border-border-light border-l-4 border-l-red-500 text-ui text-brand-text-secondary"
            >
              <div className="flex items-start gap-2">
                <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                <div className="min-w-0">
                  <div className="font-semibold text-brand-text-primary">{'Não foi possível carregar as mensagens'}</div>
                  <p className="mt-0.5 break-words">{falha}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sem tempo real, a caixa ainda funciona — só não se atualiza sozinha. Dizer isso evita a
              conclusão errada de que "não está chegando aviso nenhum". */}
          {!conectado && !falha && (
            <div
              data-testid="inbox-sem-tempo-real"
              className="px-4 py-2 border-b border-border-light text-ui-sm text-brand-text-muted"
            >
              {'Sem conexão em tempo real: as mensagens aparecem ao reabrir o sino.'}
            </div>
          )}

          {mensagens.length === 0 ? (
            falha ? null : (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-center text-ui text-brand-text-secondary">
              <BellOff size={22} className="text-brand-text-muted" />
              {'Sem mensagens novas.'}
            </div>
            )
          ) : (
            <ul>
              {mensagens.map((pMensagem: MensagemInbox) => {
                const traje = trajeDe(pMensagem.severidade);
                const Icone = traje.icone;
                const expandida = expandidas.has(pMensagem.id);
                const Seta = expandida ? ChevronDown : ChevronRight;

                // O destino da mensagem, disponível JÁ NA LINHA RECOLHIDA (dono, 2026-08-12): quem lê
                // "GET /hub/mensagens levou 5185 ms" decide ali mesmo que quer ver o evento, e obrigá-lo
                // a abrir a mensagem antes de encontrar o link é cobrar dois gestos por uma decisão.
                // Por isso o próprio TEXTO da prévia é o link.
                //
                // DUAS fontes para o mesmo destino, nesta ordem: o link escrito no corpo e a
                // REFERÊNCIA da mensagem (`<App>:<chave>`). A referência é dado estruturado e existe
                // em toda mensagem que fala de um registro — é ela que garante destino mesmo quando o
                // texto foi escrito por uma versão anterior do servidor e não cita App nenhuma.
                const link = primeiroLinkDeApp(pMensagem.corpo);
                const referencia = lerReferencia(pMensagem.referencia);
                const destino = link
                  ? { app: link.app, filtro: link.filtro, registro: link.registro ?? referencia?.chave, rotulo: link.rotulo }
                  : referencia
                    ? { app: referencia.app, filtro: undefined, registro: referencia.chave, rotulo: 'Abrir o registro' }
                    : null;
                const abrirLink = destino
                  ? resolverLinkApp(destino.app, destino.filtro, destino.registro)
                  : null;

                return (
                  <li
                    key={pMensagem.id}
                    className={`border-b border-border-light border-l-4 ${traje.borda}
                                hover:bg-brand-background/60 transition-colors`}
                  >
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <Icone size={16} className={`mt-0.5 flex-shrink-0 ${traje.corIcone}`} />

                      {/* Título e prévia são IRMÃOS, não aninhados: o título alterna o recolhimento e a
                          prévia é o link. Um botão dentro do outro tornaria ambíguo cada clique — e é
                          marcação inválida. */}
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => alternar(pMensagem.id)}
                          aria-expanded={expandida}
                          data-testid={`inbox-mensagem-${pMensagem.id}`}
                          className="w-full flex items-start gap-2 text-left"
                        >
                          {/* Duas linhas, não `truncate`: o título do alerta começa pela gravidade
                              ("AVISO: 2 ocorrências do mesmo problema…") e cortado na primeira linha
                              some justamente com o assunto. */}
                          <span className="min-w-0 text-ui font-semibold text-brand-text-primary line-clamp-2">
                            {pMensagem.titulo}
                          </span>
                          <span
                            className="ml-auto flex-shrink-0 flex items-center gap-1 text-ui-sm text-brand-text-muted"
                            title={formatDateTime(pMensagem.criacao)}
                          >
                            {formatRelativeTime(pMensagem.criacao)}
                            <Seta size={14} />
                          </span>
                        </button>

                        {!expandida && (
                          // Prévia em texto puro: `resumoDeMensagem` achata a marcação, senão a
                          // sintaxe do link apareceria crua para o usuário. Havendo destino, ela É o
                          // link; não havendo, é texto — mensagem sem para onde ir não ganha um clique
                          // que não leva a lugar nenhum.
                          abrirLink ? (
                            <button
                              type="button"
                              onClick={abrirLink}
                              title={destino!.rotulo}
                              data-testid={`inbox-link-${pMensagem.id}`}
                              className={`mt-0.5 block w-full text-left text-ui-sm line-clamp-2
                                          underline decoration-dotted decoration-1 underline-offset-2
                                          hover:decoration-solid ${traje.corLink}`}
                            >
                              {resumoDeMensagem(pMensagem.corpo)}
                            </button>
                          ) : (
                            <p className="mt-0.5 text-ui-sm text-brand-text-secondary line-clamp-2">
                              {resumoDeMensagem(pMensagem.corpo)}
                            </p>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => marcarLida(pMensagem.id)}
                        aria-label={'Marcar como lida'}
                        title={'Marcar como lida'}
                        className="flex-shrink-0 p-1 rounded hover:bg-brand-background text-brand-text-secondary"
                      >
                        <Check size={16} />
                      </button>
                    </div>

                    {expandida && (
                      // Alinhado ao título (o recuo do ícone), e não à borda: recolhido e expandido são
                      // a mesma mensagem, e o texto não pode dançar de lugar ao abrir.
                      <div className="pl-9 pr-9 pb-3 -mt-1">
                        {/* O MESMO renderizador de toda mensagem da plataforma (CE-21): destaque,
                            parágrafo, passo numerado — e o link que ABRE a App citada, no registro que
                            a mensagem cita. */}
                        <MessageText
                          text={pMensagem.corpo}
                          className="text-ui text-brand-text-secondary"
                          // Mesma regra da prévia: sem chave no link, vale a da referência. Fossem
                          // dois caminhos, o mesmo link abriria coisas diferentes conforme o usuário
                          // tivesse ou não expandido a mensagem.
                          resolveAppLink={(pApp, pFiltro, pRegistro) =>
                            resolverLinkApp(pApp, pFiltro, pRegistro ?? referencia?.chave)}
                          linkClassName={traje.corLink}
                        />

                        {/* Mensagem antiga não cita App no texto — e mesmo assim tem destino, pela
                            referência. Aberta, ela precisa oferecer o mesmo caminho que a prévia
                            oferece fechada. */}
                        {!link && abrirLink && (
                          <button
                            type="button"
                            onClick={abrirLink}
                            data-testid={`inbox-link-aberto-${pMensagem.id}`}
                            className={`mt-2 inline font-semibold underline underline-offset-2
                                        hover:no-underline text-ui ${traje.corLink}`}
                          >
                            {destino!.rotulo}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
