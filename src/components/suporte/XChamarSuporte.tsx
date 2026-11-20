/**
 * XChamarSuporte — o lado de QUEM CHAMA o suporte remoto. Aberto pelo menu do perfil ("Chamar suporte").
 *
 * O caminho, na ordem:
 *   1. disponibilidade — antes de pedir qualquer coisa, a tela pergunta ao servidor se a conta pode chamar
 *      (o assinante precisa estar num grupo de atendimento) e se há atendente online;
 *   2. senha — a de quem está logado, conferida no servidor: o atendente vai ver a tela e operar esta aba,
 *      e a sessão aberta não prova quem está diante dela. A descrição do problema é opcional. Sem atendente
 *      online a tela diz isso e mostra o horário de atendimento, mas a chamada entra na fila do mesmo jeito
 *      (dono, 2026-11-19): um atendente pode entrar durante a espera;
 *   3. espera — spinner, contagem regressiva do prazo, posição na fila e espera estimada (tudo do servidor;
 *      aqui é só exibição). O diálogo fica aberto até o prazo vencer, a chamada ser atendida ou o usuário
 *      desistir. É nesta etapa que o usuário libera a tela e o microfone, num clique próprio: o navegador só
 *      mostra o seletor de compartilhamento logo depois de um gesto, e o atendimento pode chegar minutos
 *      depois. Com a EXTENSÃO de suporte do SaaS instalada (dono, 2026-11-19), a aba é capturada sem seletor e sem a
 *      barra "Compartilhando esta aba": na primeira vez em cada aba, o usuário a libera pelo menu do botão direito,
 *      pelo atalho ou pelo ícone da extensão (que o Chrome esconde até ser fixado), e a tela diz isso; sem a extensão, a tela oferece instalá-la e, como reserva, a
 *      captura da janela, com o seletor;
 *   4. atendimento — o diálogo sai da frente e fica a JANELA DE CONTROLE: um cartão pequeno, arrastável, só de
 *      ícones (dono, 2026-11-19) — a situação da ligação, compartilhar/parar a tela, a câmera, o microfone e
 *      "Encerrar" —, com o texto de cada um no hint, para a aplicação continuar inteira à vista e em uso. Texto
 *      na janela só o que pede ação: aba errada, falha ao compartilhar, câmera recusada, ligação que não se fez. A barra que o navegador põe no alto enquanto compartilha
 *      ("compartilhando esta aba", "parar") é indicador de privacidade dele, e a página não a esconde; o botão
 *      de trocar a aba compartilhada, que ela também tinha, foi tirado (`surfaceSwitching`);
 *      Quando o atendente escreve num campo, aparece um CURSOR VIRTUAL no lugar do cursor de texto (dono,
 *      2026-11-19): o do navegador só pisca na janela em foco, e a de quem chamou quase nunca está;
 *   5. fim — o motivo do encerramento. Vencido o prazo, o chamado foi ao quadro de avisos e, se ainda não
 *      tem descrição, a tela pede uma (é o que o atendente lê antes de retornar). Depois de um atendimento,
 *      a pergunta: o caso foi resolvido?
 *
 * <b>A chamada sobrevive ao F5</b> (dono, 2026-11-19): o servidor a mantém enquanto um dos dois estiver nela. Ao
 * carregar, a tela pergunta se há chamada em aberto deste usuário e VOLTA a ela sozinha — sem senha, que é a mesma
 * sessão no mesmo navegador —; em atendimento e com a extensão instalada, já pede o compartilhamento de novo (falta só
 * o gesto de liberação da aba, que o navegador exige). E ninguém presume a presença do outro: o servidor conta a quem
 * entra se a outra ponta já está na chamada, e o painel diz quando o atendente saiu.
 *
 * <b>O retorno do atendente toca e pergunta</b> (dono, 2026-11-19): quando um atendente retorna o chamado do quadro,
 * o aviso chega pelo inbox em tempo real (pela referência `suporte:retorno:<chamada>`) e abre o `XRetornoDoSuporte`,
 * com o toque repetido até o usuário atender, recusar ou dispensar, ou até o atendimento cair. Por isso a retomada só
 * entra sozinha na chamada em que ESTA aba já tinha entrado (guardada no `sessionStorage`, que sobrevive ao F5):
 * atendimento em que ela nunca entrou é retorno, e pergunta.
 *
 * É diálogo DA CASCA (nasce do menu do perfil; App nenhum o aciona), o único tipo que usa overlay.
 *
 * O controle da aba é feito por eventos criados nesta página (`ReprodutorDeGestos`), com as travas de lá:
 * campo de senha não recebe digitação remota, e o gesto do próprio usuário tem prioridade.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Download, GripVertical, Headset, Loader2, Mic, MicOff, MonitorUp, MousePointer2, PhoneOff, ScreenShareOff, Puzzle, Send, TriangleAlert } from 'lucide-react';
import type { HubConnection } from '@microsoft/signalr';

import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XModalShell } from '@core/components/templates/XModalShell';
import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';
import { criarCanalDeSuporte, encerrarCanal, entrarNaChamada, sinalizar } from '@core/lib/suporte/canalDeSuporte';
import { ConexaoDeMidia, pararMidia, pedirMicrofone, pedirTela, superficieCompartilhada } from '@core/lib/suporte/conexaoDeMidia';
import {
  CapturaPorExtensao, FalhaDaCaptura, navegadorAceitaExtensoes, textoDeLiberacao, verificarExtensao,
} from '@core/lib/suporte/capturaPorExtensao';
import type { SuperficieCompartilhada } from '@core/lib/suporte/controleRemoto';
import { lerGesto, lerPedido, serializarGesto } from '@core/lib/suporte/controleRemoto';
import { ehCampoDeEscrita, posicaoDoCursor } from '@core/lib/suporte/cursorVirtual';
import { ATRIBUTO_DO_SUPORTE, ReprodutorDeGestos } from '@core/lib/suporte/reproducaoDeGesto';
import {
  CHAVE_DA_SESSAO_DE_SUPORTE, REFERENCIA_DO_RETORNO, ROTA_DAS_CHAMADAS, formatarEspera, formatarEstimativa,
  servidoresDoNavegador, type ChamadaDeSuporte, type DisponibilidadeDoSuporte, type ServidorICE, type TipoDeRecado,
} from '@core/lib/suporte/tipos';
import { ouvirMensagens } from '@core/lib/ouvintesDoInbox';

import { XBotaoDeCamera } from './XBotaoDeCamera';
import { XBotaoDeEnrolar } from './XBotaoDeEnrolar';
import { XRetornoDoSuporte } from './XRetornoDoSuporte';
import { useToqueDeChamada } from './useToqueDeChamada';
import { CHAVE_DO_PAINEL_DO_USUARIO, usePosicaoDoPainel } from './usePosicaoDoPainel';
import { XQuadrosDeCamera } from './XQuadrosDeCamera';
import { useCameraDeSuporte } from './useCameraDeSuporte';

interface XChamarSuporteProps {
  /** O menu do perfil pediu a chamada. Durante o atendimento a barra fica visível mesmo com `false`. */
  aberto: boolean;
  aoFechar: () => void;
}

type Fase = 'inativo' | 'consultando' | 'indisponivel' | 'extensao' | 'senha' | 'aguardando' | 'atendimento' | 'fim';

/** De quanto em quanto tempo a situação é relida do servidor, para o caso de o aviso em tempo real não chegar. */
const RELEITURA_MS = 15_000;

/** Tamanho máximo da descrição do problema (o mesmo do servidor). */
const TAMANHO_MAXIMO_DA_DESCRICAO = 2000;

const MOTIVO_DO_FIM: Record<string, string> = {
  Encerrada: 'O atendimento foi encerrado.',
  Cancelada: 'A chamada foi cancelada. Nenhum atendente chegou a ver a sua tela.',
  Expirada: 'Nenhum atendente pôde atender dentro do prazo de espera. A sua tela não foi compartilhada com ninguém. '
    + 'Se ainda precisa de ajuda, chame o suporte de novo.',
  Registrada: 'Nenhum atendente assumiu a sua chamada dentro do prazo de espera, e por isso ela ficou registrada no quadro '
    + 'do suporte. A sua tela não foi compartilhada com ninguém. Assim que um atendente vir o chamado, ele retorna: você '
    + 'recebe um aviso no sino e, ao abrir "Chamar suporte" de novo, entra direto no atendimento.',
};

/** Prazo de espera mostrado enquanto o servidor não disse o dele. */
const MINUTOS_DE_ESPERA_PADRAO = 5;

/** Botão só de ícone da janela de controle: o texto vai no hint. */
const BOTAO_DE_ICONE = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-brand-text-primary bg-brand-surface hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed';

const BOTAO_NEUTRO = 'px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover';
const BOTAO_DESTAQUE = 'inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed';

/** A chamada em que esta aba entrou (sobrevive ao F5). Navegador que recusa o armazenamento: nenhuma. */
function lerChamadaDaAba(): string | null {
  try {
    return window.sessionStorage.getItem(CHAVE_DA_SESSAO_DE_SUPORTE);
  } catch {
    return null;
  }
}

function gravarChamadaDaAba(pID: string | null): void {
  try {
    if (pID)
      window.sessionStorage.setItem(CHAVE_DA_SESSAO_DE_SUPORTE, pID);
    else
      window.sessionStorage.removeItem(CHAVE_DA_SESSAO_DE_SUPORTE);
  } catch {
    // Sem armazenamento, o F5 mostra o aviso de atender em vez de entrar sozinho: nada se perde.
  }
}

/** De quanto em quanto tempo, no passo da instalação, a tela confere se a extensão já foi instalada. */
const CONFERENCIA_DA_EXTENSAO_MS = 2000;

/**
 * Marca, no `sessionStorage`, que a página foi recarregada no meio da instalação da extensão: ao voltar, o diálogo se
 * reabre sozinho. O navegador pode só expor a extensão nova à página depois de recarregá-la.
 */
const CHAVE_DE_REABRIR = 'tootega.suporte.reabrir';

/** De quanto em quanto tempo o aviso de retorno confere se o atendimento ainda espera (o atendente pode desistir). */
const CONFERENCIA_DO_RETORNO_MS = 5000;

export function XChamarSuporte({ aberto, aoFechar }: XChamarSuporteProps): JSX.Element | null {
  const [fase, setFase] = useState<Fase>('inativo');
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDoSuporte | null>(null);
  const [senha, setSenha] = useState('');
  const [descricao, setDescricao] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  const [chamada, setChamada] = useState<ChamadaDeSuporte | null>(null);
  const [restantes, setRestantes] = useState(0);
  const [telaPronta, setTelaPronta] = useState(false);
  const [pedindoTela, setPedindoTela] = useState(false);
  const [falhaDaTela, setFalhaDaTela] = useState('');
  // A extensão espera o clique de liberação no ícone dela: o texto que diz ao usuário o que fazer.
  const [liberacao, setLiberacao] = useState<string | null>(null);
  // A extensão não está instalada, e o SaaS tem onde instalá-la: a tela oferece a instalação.
  const [ofertaDeExtensao, setOfertaDeExtensao] = useState(false);
  // O diálogo aberto por ele mesmo (a volta da recarga no meio da instalação), sem o menu do perfil.
  const [abertoInterno, setAbertoInterno] = useState(false);
  // A extensão acabou de ser instalada neste passo: o formulário da senha diz que deu certo.
  const [extensaoInstalada, setExtensaoInstalada] = useState(false);
  const [conferindoExtensao, setConferindoExtensao] = useState(false);
  // O usuário escolheu seguir sem a extensão: o compartilhamento vai direto ao seletor, sem oferecer de novo.
  const semExtensao = useRef(false);
  const [capturaServe, setCapturaServe] = useState(true);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [ligacao, setLigacao] = useState<RTCPeerConnectionState>('new');
  const [motivoDoFim, setMotivoDoFim] = useState('');
  // A chamada encerrada depois de um atendimento: é sobre ela que se pergunta se o caso foi resolvido.
  const [aAvaliar, setAAvaliar] = useState<string | null>(null);
  const [avaliando, setAvaliando] = useState(false);
  // O chamado que foi ao quadro sem descrição: a tela do fim pede uma.
  const [aDescrever, setADescrever] = useState<string | null>(null);
  const [descrevendo, setDescrevendo] = useState(false);
  const [zIndex] = useState(() => ZIndexManager.next());

  // O que vive fora do ciclo de render: conexões, mídias e o que os ouvintes do hub precisam ler "agora".
  const canal = useRef<HubConnection | null>(null);
  const midia = useRef<ConexaoDeMidia | null>(null);
  const tela = useRef<MediaStream | null>(null);
  const microfone = useRef<MediaStream | null>(null);
  const reprodutor = useRef<ReprodutorDeGestos | null>(null);
  // O que foi compartilhado (aba, janela, tela inteira): é o que leva o ponto do vídeo ao ponto da página.
  const superficie = useRef<SuperficieCompartilhada | undefined>(undefined);
  // A captura pela extensão de suporte (sem seletor), enquanto a extensão está conectada a esta aba.
  const captura = useRef<CapturaPorExtensao | null>(null);
  const chamadaAtual = useRef<ChamadaDeSuporte | null>(null);
  const atendentePresente = useRef(false);
  // Espelho de `atendentePresente` para a tela: o painel diz quando o atendente não está na chamada.
  const [atendenteNaChamada, setAtendenteNaChamada] = useState(false);
  // A disponibilidade de agora, para quem a lê fora do ciclo de render (a retomada logo depois de carregá-la).
  const disponibilidadeAtual = useRef<DisponibilidadeDoSuporte | null>(null);
  const ofertando = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ponteiro = useRef<HTMLDivElement | null>(null);
  const cursorVirtual = useRef<HTMLDivElement | null>(null);

  const camera = useCameraDeSuporte(() => midia.current);

  // A janela de controle se arrasta pelo cabeçalho, para sair de cima do que o usuário precisa ver.
  // A posição em que o usuário deixou a janela fica no perfil: a próxima chamada a abre ali.
  const [posicaoDaJanela, gravarPosicaoDaJanela] = usePosicaoDoPainel(CHAVE_DO_PAINEL_DO_USUARIO);
  const janela = useMolduraDeModal({
    arrastavel: true, redimensionavel: false, conterAoMudarDeTamanho: true, aberto: fase === 'atendimento',
    quadroSalvo: posicaoDaJanela, aoMudarQuadro: gravarPosicaoDaJanela,
  });
  // Enrolada, a janela fica só na alça (situação e arrasto) e no botão de desenrolar.
  const [enrolada, setEnrolada] = useState(false);
  // O atendente retornou o chamado do quadro e espera (dono, 2026-11-19): o aviso de atender, com toque repetido até
  // atender, recusar, dispensar ou o atendimento cair.
  const [retorno, setRetorno] = useState<ChamadaDeSuporte | null>(null);
  const [respondendoRetorno, setRespondendoRetorno] = useState(false);
  useToqueDeChamada(retorno !== null);
  // O atendente pediu a janela recolhida e no topo da aba (ela aparece no vídeo dele): enrola, e depois de o tamanho
  // novo estar na tela, encosta no topo. Contador, para dois pedidos seguidos valerem os dois.
  const [pedidosDeTopo, setPedidosDeTopo] = useState(0);
  const recolherAoTopo = useCallback(() => {
    setEnrolada(true);
    setPedidosDeTopo((pAtual) => pAtual + 1);
  }, []);
  const { encostarNoTopo } = janela;

  useLayoutEffect(() => {
    if (pedidosDeTopo > 0)
      encostarNoTopo();
  }, [pedidosDeTopo, encostarNoTopo]);

  const { desligar: desligarCamera, esquecerRemota } = camera;

  const desligarMidia = useCallback(() => {
    midia.current?.fechar();
    midia.current = null;
    ofertando.current = false;
    esquecerRemota();
    setLigacao('new');
  }, [esquecerRemota]);

  const limpar = useCallback(() => {
    const id = chamadaAtual.current?.id ?? null;

    desligarMidia();
    reprodutor.current?.parar();
    reprodutor.current = null;
    pararMidia(tela.current);
    pararMidia(microfone.current);
    captura.current?.fechar();
    captura.current = null;
    setLiberacao(null);
    setOfertaDeExtensao(false);
    desligarCamera();
    tela.current = null;
    microfone.current = null;
    atendentePresente.current = false;
    setAtendenteNaChamada(false);
    chamadaAtual.current = null;
    gravarChamadaDaAba(null);

    void encerrarCanal(canal.current, id);
    canal.current = null;

    setTelaPronta(false);
    setTemMicrofone(false);
    setMudo(false);
    setFalhaDaTela('');
    setCapturaServe(true);
  }, [desligarMidia, desligarCamera]);

  const finalizar = useCallback((pChamada: ChamadaDeSuporte) => {
    // Só depois de um atendimento de verdade há o que avaliar.
    const atendida = pChamada.situacao === 'Encerrada' && !!pChamada.atendente;

    limpar();
    setChamada(null);
    setAAvaliar(atendida ? pChamada.id : null);
    setADescrever(pChamada.situacao === 'Registrada' && !pChamada.descricao.trim() ? pChamada.id : null);
    setDescricao('');
    setMotivoDoFim(MOTIVO_DO_FIM[pChamada.situacao] ?? `A chamada terminou: ${pChamada.situacaoTexto}.`);
    setFase('fim');
  }, [limpar]);

  // Inicia a negociação quando as três condições se cumprem: a chamada foi atendida, o atendente está na
  // chamada e a tela foi liberada. Cada uma chega por um caminho e em qualquer ordem; por isso esta função é
  // chamada de todos eles e só age quando nada falta.
  const tentarOfertar = useCallback(async () => {
    const atual = chamadaAtual.current;
    const hub = canal.current;

    if (!atual || atual.situacao !== 'EmAtendimento' || !hub || !tela.current || !atendentePresente.current)
      return;

    if (midia.current || ofertando.current)
      return;

    ofertando.current = true;

    try {
      const servidores = await api.get<ServidorICE[]>(`${ROTA_DAS_CHAMADAS}/${atual.id}/servidores-ice`);

      // Enquanto os servidores vinham, a chamada pode ter acabado ou a tela pode ter sido retirada.
      if (chamadaAtual.current?.id !== atual.id || !tela.current)
        return;

      const conexao = new ConexaoDeMidia({
        servidores: servidoresDoNavegador(servidores),
        enviarRecado: (pTipo, pDados) => sinalizar(hub, atual.id, pTipo, pDados),
        aoReceberMidia: (pRemota) => {
          if (audio.current)
            audio.current.srcObject = pRemota;
        },
        aoMudarEstado: setLigacao,
        aoReceberCamera: camera.aoReceberCamera,
        aoMudarCameraRemota: camera.aoMudarCameraRemota,
        aoReceberDados: (pTexto) => {
          if (lerPedido(pTexto)) {
            recolherAoTopo();
            return;
          }

          const gesto = lerGesto(pTexto);
          if (!gesto || !reprodutor.current)
            return;

          const desfecho = reprodutor.current.aplicar(gesto);

          // Depois que o gesto mexeu no foco ou no texto, o cursor virtual vai para onde o cursor está.
          requestAnimationFrame(() => atualizarCursorVirtual());

          if (desfecho === 'senha' || desfecho === 'usuario')
            conexao.enviarDados(serializarGesto({ t: 'bloqueio', motivo: desfecho }));
        },
      });

      conexao.adicionarMidia(tela.current);
      if (microfone.current)
        conexao.adicionarMidia(microfone.current);

      // A câmera ligada antes de a ligação existir (ou de ela ser refeita) entra já na oferta.
      await conexao.definirCamera(camera.faixa());

      midia.current = conexao;

      reprodutor.current ??= new ReprodutorDeGestos((pX, pY) => {
        if (ponteiro.current) {
          ponteiro.current.style.transform = `translate(${pX}px, ${pY}px)`;
          ponteiro.current.style.opacity = '1';
        }
      });
      reprodutor.current.definirSuperficie(superficie.current);
      // O quadro que sai daqui, lido a cada gesto: é por ele que as tarjas da captura são descontadas.
      reprodutor.current.definirQuadro(() => {
        const ajustes = tela.current?.getVideoTracks()[0]?.getSettings();
        return ajustes?.width && ajustes.height ? { largura: ajustes.width, altura: ajustes.height } : null;
      });

      await conexao.ofertar();
    } catch {
      // A recusa do servidor já saiu no diálogo de mensagem; a ligação fica por fazer e a barra o diz.
      desligarMidia();
    } finally {
      ofertando.current = false;
    }
  }, [desligarMidia, camera.aoReceberCamera, camera.aoMudarCameraRemota, camera.faixa]);

  const aplicarSituacao = useCallback((pChamada: ChamadaDeSuporte) => {
    if (chamadaAtual.current?.id !== pChamada.id)
      return;

    // O aviso em tempo real não traz a posição nem a estimativa (são de quem relê): não apaga as que há.
    const anterior = chamadaAtual.current;
    const atual = pChamada.situacao === 'Aguardando' && pChamada.posicao === 0
      ? { ...pChamada, posicao: anterior.posicao, esperaEstimadaSegundos: anterior.esperaEstimadaSegundos }
      : pChamada;

    chamadaAtual.current = atual;
    setChamada(atual);

    if (atual.situacao === 'Aguardando') {
      setRestantes(atual.segundosRestantes);
      return;
    }

    if (atual.situacao === 'EmAtendimento') {
      setFase('atendimento');
      void tentarOfertar();
      return;
    }

    finalizar(atual);
  }, [finalizar, tentarOfertar]);

  const reler = useCallback(async () => {
    const id = chamadaAtual.current?.id;
    if (!id)
      return;

    try {
      aplicarSituacao(await api.get<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${id}`, undefined, true));
    } catch {
      // Releitura é rede de segurança do aviso em tempo real: falhou agora, tenta de novo na próxima.
    }
  }, [aplicarSituacao]);

  const fechar = useCallback(() => {
    setMotivoDoFim('');
    setAAvaliar(null);
    setADescrever(null);
    setSenha('');
    setDescricao('');
    guardarDisponibilidade(null);
    setAbertoInterno(false);
    setExtensaoInstalada(false);
    setFase('inativo');
    aoFechar();
  }, [aoFechar]);

  // O menu pediu a chamada: primeiro pergunta-se ao servidor o que é possível. Havendo chamada em curso, o
  // pedido não a derruba.
  //
  // Antes da senha, a extensão de suporte (dono, 2026-11-19): no navegador que a aceita, sem ela instalada, o diálogo
  // conduz a instalação — é ela que mostra a aba ao atendente sem o seletor do navegador e sem a barra de
  // compartilhamento. O usuário pode seguir sem ela.
  useEffect(() => {
    if ((!aberto && !abertoInterno) || fase !== 'inativo')
      return;

    let vivo = true;

    setFase('consultando');

    void (async () => {
      try {
        const pDisponibilidade = await api.get<DisponibilidadeDoSuporte>(`${ROTA_DAS_CHAMADAS}/disponibilidade`);
        if (!vivo)
          return;

        guardarDisponibilidade(pDisponibilidade);

        if (!pDisponibilidade.disponivel) {
          setFase('indisponivel');
          return;
        }

        const precisaInstalar = !!pDisponibilidade.extensaoID && !semExtensao.current && navegadorAceitaExtensoes()
          && !(await verificarExtensao(pDisponibilidade.extensaoID));

        if (vivo)
          setFase(precisaInstalar ? 'extensao' : 'senha');
      } catch {
        // A falha já saiu no diálogo de mensagem, com o motivo: não há o que mostrar aqui.
        if (vivo)
          fechar();
      }
    })();

    return () => { vivo = false; };
    // Só a abertura dispara a consulta: `fase` muda dentro do próprio efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, abertoInterno]);

  // A página foi recarregada no meio da instalação: o diálogo volta sozinho, e confere a extensão de novo.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CHAVE_DE_REABRIR)) {
        window.sessionStorage.removeItem(CHAVE_DE_REABRIR);
        setAbertoInterno(true);
      }
    } catch {
      // Sem armazenamento, o usuário reabre pelo menu do perfil.
    }
  }, []);

  // No passo da instalação, a tela confere sozinha se a extensão já chegou: instalou na outra aba, voltou, e segue.
  const extensaoID = disponibilidade?.extensaoID ?? '';

  const conferirExtensao = useCallback(async (): Promise<boolean> => {
    if (!extensaoID || !(await verificarExtensao(extensaoID)))
      return false;

    setExtensaoInstalada(true);
    setFase((pAtual) => (pAtual === 'extensao' ? 'senha' : pAtual));

    return true;
  }, [extensaoID]);

  useEffect(() => {
    if (fase !== 'extensao')
      return;

    const conferencia = window.setInterval(() => void conferirExtensao(), CONFERENCIA_DA_EXTENSAO_MS);

    return () => window.clearInterval(conferencia);
  }, [fase, conferirExtensao]);

  // "Já instalei": confere na hora; se a página ainda não enxerga a extensão, recarrega — o navegador pode só
  // apresentá-la depois disso — e o diálogo se reabre sozinho.
  async function jaInstalei(): Promise<void> {
    setConferindoExtensao(true);
    try {
      if (await conferirExtensao())
        return;

      try {
        window.sessionStorage.setItem(CHAVE_DE_REABRIR, '1');
      } catch {
        // Sem armazenamento, o usuário reabre pelo menu do perfil depois da recarga.
      }
      window.location.reload();
    } finally {
      setConferindoExtensao(false);
    }
  }

  function seguirSemExtensao(): void {
    semExtensao.current = true;
    setFase('senha');
  }

  // Contagem regressiva da espera. No zero, quem decide é o servidor: relê-se a chamada.
  useEffect(() => {
    if (fase !== 'aguardando')
      return;

    const relogio = window.setInterval(() => {
      setRestantes((pAtual) => {
        if (pAtual <= 1)
          void reler();

        return Math.max(0, pAtual - 1);
      });
    }, 1000);

    return () => window.clearInterval(relogio);
  }, [fase, reler]);

  // Releitura periódica enquanto há chamada em aberto: traz também a posição na fila e a espera estimada.
  useEffect(() => {
    if (fase !== 'aguardando' && fase !== 'atendimento')
      return;

    const releitura = window.setInterval(() => void reler(), RELEITURA_MS);

    return () => window.clearInterval(releitura);
  }, [fase, reler]);

  // O cursor virtual segue o campo também quando a página rola ou a janela ganha e perde o foco (com foco, vale
  // o cursor do navegador e o virtual some).
  useEffect(() => {
    if (fase !== 'atendimento')
      return;

    const atualizar = (): void => atualizarCursorVirtual();

    window.addEventListener('focus', atualizar);
    window.addEventListener('blur', atualizar);
    document.addEventListener('scroll', atualizar, true);
    document.addEventListener('focusout', atualizar, true);

    return () => {
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('blur', atualizar);
      document.removeEventListener('scroll', atualizar, true);
      document.removeEventListener('focusout', atualizar, true);
    };
  }, [fase]);

  // Saiu da página com a chamada em aberto: as conexões e as mídias são soltas.
  useEffect(() => limpar, [limpar]);

  const semAtendente = disponibilidade !== null && !disponibilidade.atendenteOnline;
  const minutosDeEspera = disponibilidade?.minutosDeEspera || MINUTOS_DE_ESPERA_PADRAO;
  const prazoEmPalavras = minutosDeEspera === 1 ? '1 minuto' : `${minutosDeEspera} minutos`;

  function guardarDisponibilidade(pDisponibilidade: DisponibilidadeDoSuporte | null): void {
    disponibilidadeAtual.current = pDisponibilidade;
    setDisponibilidade(pDisponibilidade);
  }

  // Liga esta aba à chamada: o canal de tempo real, os ouvintes e a entrada na chamada. Serve à chamada recém-aberta e
  // à retomada depois do F5. Falha ⇒ lança, e quem chamou desfaz.
  async function entrarNaSessao(pChamada: ChamadaDeSuporte): Promise<void> {
    const hub = criarCanalDeSuporte();

    chamadaAtual.current = pChamada;
    canal.current = hub;
    gravarChamadaDaAba(pChamada.id);
    // Entrou (pelo aviso, por "Chamar suporte" ou pela retomada): o aviso de retorno, se havia, perdeu o sentido.
    setRetorno(null);

    hub.on('ChamadaMudou', (pAtual: ChamadaDeSuporte) => aplicarSituacao(pAtual));
    hub.on('ParticipanteEntrou', (pID: string) => {
      if (pID !== chamadaAtual.current?.id)
        return;

      // O atendente está na chamada: entrou agora, voltou depois de recarregar, ou já estava quando esta aba entrou
      // (o servidor conta). A ligação anterior, se havia, era com a aba antiga dele e não serve mais.
      atendentePresente.current = true;
      setAtendenteNaChamada(true);
      desligarMidia();
      void tentarOfertar();
    });
    hub.on('ParticipanteSaiu', (pID: string) => {
      if (pID !== chamadaAtual.current?.id)
        return;

      // O atendente caiu, mas a chamada continua dele: se voltar, a ligação se refaz.
      atendentePresente.current = false;
      setAtendenteNaChamada(false);
      desligarMidia();
    });
    hub.on('Recado', (pID: string, pTipo: TipoDeRecado, pDados: string) => {
      if (pID === chamadaAtual.current?.id)
        void midia.current?.receberRecado(pTipo, pDados).catch(() => desligarMidia());
    });
    // Reconectou: o hub esqueceu em que chamada esta conexão estava.
    hub.onreconnected(() => {
      const id = chamadaAtual.current?.id;
      if (id)
        void entrarNaChamada(hub, id).then(() => reler());
    });

    await hub.start();
    await entrarNaChamada(hub, pChamada.id);

    setChamada(pChamada);
    setRestantes(pChamada.segundosRestantes);
    setFase(pChamada.situacao === 'EmAtendimento' ? 'atendimento' : 'aguardando');
  }

  // Ao carregar a página: havendo chamada em aberto deste usuário (o F5 no meio da espera ou do atendimento), a tela
  // volta a ela sozinha. Uma vez por carga; falha de rede aqui não incomoda ninguém (sem diálogo de mensagem).
  const retomada = useRef(false);

  useEffect(() => {
    if (retomada.current)
      return;
    retomada.current = true;

    void (async () => {
      try {
        const minha = await api.get<ChamadaDeSuporte | null>(`${ROTA_DAS_CHAMADAS}/minha`, undefined, true);
        if (!minha?.id || !minha.emAberto || chamadaAtual.current)
          return;

        // Em atendimento numa chamada em que esta aba nunca entrou: é o retorno do atendente (o aviso chegou com o
        // sistema fechado, ou noutra aba). Entrar sozinho seria mostrar a tela sem o usuário saber: toca e pergunta.
        if (minha.situacao === 'EmAtendimento' && lerChamadaDaAba() !== minha.id) {
          setRetorno(minha);
          return;
        }

        const disponivel = await api.get<DisponibilidadeDoSuporte>(`${ROTA_DAS_CHAMADAS}/disponibilidade`, undefined, true);
        guardarDisponibilidade(disponivel);
        await entrarNaSessao(minha);

        // Em atendimento, a tela volta a ser mostrada — pela extensão, que não precisa de gesto na página.
        if (minha.situacao === 'EmAtendimento')
          void compartilhar(false, true);
      } catch {
        limpar();
      }
    })();
    // Uma vez por carga da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O aviso de retorno chega pelo inbox, em tempo real: confere no servidor e, havendo atendimento à espera em que
  // esta aba não está, abre o aviso de atender.
  useEffect(() => ouvirMensagens((pMensagem) => {
    if (!pMensagem.referencia?.startsWith(`${REFERENCIA_DO_RETORNO}:`) || chamadaAtual.current)
      return;

    void api.get<ChamadaDeSuporte | null>(`${ROTA_DAS_CHAMADAS}/minha`, undefined, true)
      .then((pMinha) => {
        if (pMinha?.id && pMinha.emAberto && pMinha.situacao === 'EmAtendimento' && !chamadaAtual.current)
          setRetorno(pMinha);
      })
      .catch(() => { /* sem resposta, o aviso segue no sino */ });
  }), []);

  // Enquanto o aviso está na tela, o atendimento pode cair (o atendente encerrou, ou o servidor o deu por abandonado):
  // o aviso sai e o toque para.
  const idDoRetorno = retorno?.id;

  useEffect(() => {
    if (!idDoRetorno)
      return;

    const conferencia = window.setInterval(() => {
      void api.get<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${idDoRetorno}`, undefined, true)
        .then((pAtual) => {
          if (!pAtual?.emAberto || pAtual.situacao !== 'EmAtendimento')
            setRetorno((pRetorno) => (pRetorno?.id === idDoRetorno ? null : pRetorno));
        })
        .catch(() => { /* rede oscilou: confere de novo no próximo ciclo */ });
    }, CONFERENCIA_DO_RETORNO_MS);

    return () => window.clearInterval(conferencia);
  }, [idDoRetorno]);

  async function atenderRetorno(): Promise<void> {
    const alvo = retorno;
    if (!alvo || respondendoRetorno)
      return;

    setRespondendoRetorno(true);
    try {
      guardarDisponibilidade(await api.get<DisponibilidadeDoSuporte>(`${ROTA_DAS_CHAMADAS}/disponibilidade`));
      await entrarNaSessao(alvo);
      setRetorno(null);
      // A tela vai sozinha pela extensão; sem ela, o painel oferece o botão de compartilhar.
      void compartilhar(false, true);
    } catch {
      // O motivo já saiu no diálogo de mensagem (o atendimento pode ter acabado no meio do caminho).
      limpar();
      setRetorno(null);
    } finally {
      setRespondendoRetorno(false);
    }
  }

  async function recusarRetorno(): Promise<void> {
    const alvo = retorno;
    if (!alvo || respondendoRetorno)
      return;

    setRespondendoRetorno(true);
    try {
      await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${alvo.id}/encerrar`);
      setRetorno(null);
    } catch {
      // O motivo já saiu no diálogo de mensagem; o aviso continua para o usuário decidir de novo.
    } finally {
      setRespondendoRetorno(false);
    }
  }

  async function abrir(pEvento: FormEvent): Promise<void> {
    pEvento.preventDefault();

    if (!senha || abrindo)
      return;

    setAbrindo(true);

    try {
      const nova = await api.post<ChamadaDeSuporte>(ROTA_DAS_CHAMADAS, { senha, descricao: descricao.trim() });

      setSenha('');

      // Chamada que não está mais em aberto (ficou no quadro, por exemplo): não há fila a esperar nem sessão
      // a abrir agora.
      if (!nova.emAberto) {
        finalizar(nova);
        return;
      }

      await entrarNaSessao(nova);
    } catch {
      // Senha recusada ou servidor fora: o motivo já saiu no diálogo de mensagem. Nada ficou aberto.
      limpar();
    } finally {
      setAbrindo(false);
    }
  }

  /**
   * Compartilha a tela: pela EXTENSÃO de suporte, quando o SaaS tem uma e ela está instalada (sem seletor e sem a
   * barra do navegador); senão, oferece instalá-la (quando há onde) ou cai na captura da janela, com o seletor.
   *
   * @param pSemExtensao O usuário escolheu compartilhar sem a extensão (a captura da janela).
   * @param pAutomatico   Pedido sem gesto do usuário (a retomada depois do F5): só pela extensão — o seletor do
   *                      navegador exige um clique na página, e sem ele nada se pede.
   */
  async function compartilhar(pSemExtensao = false, pAutomatico = false): Promise<void> {
    if (pedindoTela)
      return;

    const disponivel = disponibilidadeAtual.current;
    if (pAutomatico && !(disponivel?.extensaoID && await verificarExtensao(disponivel.extensaoID)))
      return;

    setPedindoTela(true);
    setFalhaDaTela('');
    setOfertaDeExtensao(false);

    const idDaExtensao = pSemExtensao ? '' : (disponivel?.extensaoID ?? '');
    let porExtensao = false;

    try {
      let novaTela: MediaStream;
      const extensao = idDaExtensao ? await verificarExtensao(idDaExtensao) : null;

      if (extensao) {
        porExtensao = true;
        captura.current ??= new CapturaPorExtensao(idDaExtensao, {
          aoPrecisarLiberar: () => setLiberacao(textoDeLiberacao(extensao)),
        });
        novaTela = await captura.current.pedir();
      } else if (idDaExtensao && disponivel?.extensaoURL && !semExtensao.current) {
        // Sem a extensão, e com onde instalá-la: a escolha é do usuário (instalar, ou seguir com o seletor).
        setOfertaDeExtensao(true);
        return;
      } else {
        novaTela = await pedirTela();
      }

      setLiberacao(null);

      // O usuário pode parar o compartilhamento pela barra do próprio navegador, a qualquer momento: é o
      // mesmo que parar pela janela de controle.
      novaTela.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (tela.current === novaTela)
          soltarTela();
      });

      tela.current = novaTela;
      // Pela extensão, o vídeo é ESTA aba: o ponto do vídeo é o ponto da página, sem moldura a descontar.
      superficie.current = porExtensao ? 'browser' : superficieCompartilhada(novaTela);
      reprodutor.current?.definirSuperficie(superficie.current);
      // Aba pelo seletor é OUTRA aba (a deste sistema não é oferecida): o atendente a vê, mas os cliques cairiam aqui.
      setCapturaServe(porExtensao || superficie.current !== 'browser');
      setTelaPronta(true);

      if (!microfone.current) {
        microfone.current = await pedirMicrofone();
        setTemMicrofone(microfone.current !== null);
      }

      // Com a ligação de pé (a tela tinha sido parada), a tela nova só entra no lugar da antiga; sem ligação,
      // é a tela que permite ofertá-la.
      if (midia.current)
        await midia.current.definirTela(novaTela.getVideoTracks()[0] ?? null);
      else
        void tentarOfertar();
    } catch (pErro) {
      setLiberacao(null);
      setFalhaDaTela(pErro instanceof FalhaDaCaptura ? pErro.message
        : porExtensao
          ? 'A captura desta aba pela extensão de suporte não abriu: o navegador recusou o vídeo da aba. Clique de novo '
            + 'em compartilhar; se repetir, use "Compartilhar sem a extensão".'
          : 'A tela não foi compartilhada: o pedido foi recusado ou a janela de escolha foi fechada. '
            + 'Sem a tela, o atendente não vê o que você vê. Clique de novo e escolha a janela deste navegador.');
    } finally {
      setPedindoTela(false);
    }
  }

  // O usuário desistiu de liberar a aba pela extensão: o ícone apaga, e o pedido em curso termina.
  function desistirDaLiberacao(): void {
    captura.current?.desistir();
    setLiberacao(null);
  }

  function instalarExtensao(): void {
    if (disponibilidade?.extensaoURL)
      window.open(disponibilidade.extensaoURL, '_blank', 'noopener');
  }

  // Para de mostrar a tela sem derrubar a ligação: a voz e a câmera seguem, e o atendente é avisado.
  function soltarTela(): void {
    captura.current?.avisarParou();
    pararMidia(tela.current);
    tela.current = null;
    setTelaPronta(false);
    setCapturaServe(true);
    void midia.current?.definirTela(null);
  }

  async function encerrar(): Promise<void> {
    const atual = chamadaAtual.current;

    if (!atual) {
      fechar();
      return;
    }

    const acao = atual.situacao === 'EmAtendimento' ? 'encerrar' : 'cancelar';

    try {
      // Cancelar uma chamada que acabou de ser atendida devolve "em atendimento": aí ela segue.
      aplicarSituacao(await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${atual.id}/${acao}`));
    } catch {
      // O motivo já saiu no diálogo de mensagem. A chamada segue como está no servidor.
      void reler();
    }
  }

  async function enviarDescricao(pEvento: FormEvent): Promise<void> {
    pEvento.preventDefault();

    const texto = descricao.trim();
    if (!aDescrever || !texto || descrevendo)
      return;

    setDescrevendo(true);

    try {
      await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${aDescrever}/descrever`, { descricao: texto });
      setADescrever(null);
      setDescricao('');
      setMotivoDoFim('Obrigado. A descrição ficou no chamado, e é o que o atendente lê antes de retornar. Você recebe um '
        + 'aviso no sino quando ele estiver pronto para atender.');
    } catch {
      // O motivo já saiu no diálogo de mensagem; o campo continua na tela, com o texto digitado.
    } finally {
      setDescrevendo(false);
    }
  }

  async function avaliar(pResolvido: boolean): Promise<void> {
    if (!aAvaliar || avaliando)
      return;

    setAvaliando(true);

    try {
      await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${aAvaliar}/avaliar`, { resolvido: pResolvido });
      setAAvaliar(null);
      setMotivoDoFim(pResolvido
        ? 'Obrigado. Ficou registrado que o seu caso foi resolvido.'
        : 'Obrigado. Ficou registrado que o seu caso não foi resolvido, e a equipe de suporte vê essa resposta. '
          + 'Se quiser continuar agora, chame o suporte de novo.');
    } catch {
      // O motivo já saiu no diálogo de mensagem; a pergunta continua na tela.
    } finally {
      setAvaliando(false);
    }
  }

  // Desenha o cursor virtual no campo em que o foco está, se a janela não está em foco (sem foco, o cursor do
  // navegador não aparece). Fora de campo de escrita, ou com a janela em foco, ele some.
  function atualizarCursorVirtual(): void {
    const traco = cursorVirtual.current;
    if (!traco)
      return;

    const ativo = document.activeElement;
    const posicao = !document.hasFocus() && ehCampoDeEscrita(ativo) ? posicaoDoCursor(ativo) : null;

    if (!posicao) {
      traco.style.visibility = 'hidden';
      return;
    }

    traco.style.transform = `translate(${posicao.x}px, ${posicao.y}px)`;
    traco.style.height = `${posicao.altura}px`;
    traco.style.visibility = 'visible';
  }

  function alternarMudo(): void {
    const novo = !mudo;

    microfone.current?.getAudioTracks().forEach((pFaixa) => { pFaixa.enabled = !novo; });
    setMudo(novo);
  }

  if (fase === 'inativo') {
    return retorno && (
      <XRetornoDoSuporte
        chamada={retorno} ocupado={respondendoRetorno}
        aoAtender={() => void atenderRetorno()} aoRecusar={() => void recusarRetorno()} aoDispensar={() => setRetorno(null)}
      />
    );
  }

  if (fase === 'consultando') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        <div role="status" aria-live="polite" className="flex items-center gap-3 p-6 text-ui text-brand-text-primary">
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{'Verificando o suporte disponível para a sua conta…'}</span>
        </div>
      </XModalShell>
    );
  }

  if (fase === 'indisponivel') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Fechar'} onClose={fechar}>
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-indisponivel">
          <p className="flex items-start gap-2">
            <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{disponibilidade?.motivo}</span>
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Fechar'}</button>
          </div>
        </div>
      </XModalShell>
    );
  }

  if (fase === 'extensao') {
    const temLoja = !!disponibilidade?.extensaoURL;

    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        <div className="w-full sm:w-[28rem] p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-extensao">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-indigo-600/15 text-indigo-500" aria-hidden="true">
              <Puzzle className="w-5 h-5" />
            </span>
            <div className="space-y-1">
              <p>
                {'Antes, instale a '}<strong>{'extensão de suporte'}</strong>
                {': com ela, o atendente vê esta aba sem você escolher o que compartilhar. É só uma vez.'}
              </p>
              <p className="text-ui-sm text-brand-text-secondary" role="status" aria-live="polite">
                {'Esta tela percebe sozinha quando a extensão estiver instalada.'}
              </p>
            </div>
          </div>

          {temLoja ? (
            <ol className="list-decimal pl-5 space-y-1 text-ui-sm" data-testid="suporte-extensao-passos">
              <li>{'Clique em '}<strong>{'Instalar a extensão'}</strong>{': a loja do Chrome abre numa aba nova.'}</li>
              <li>{'Lá, clique em '}<strong>{'Usar no Chrome'}</strong>{' e confirme em '}<strong>{'Adicionar extensão'}</strong>{'.'}</li>
              <li>{'Volte a esta aba. Se ela não seguir sozinha, clique em '}<strong>{'Já instalei'}</strong>{'.'}</li>
            </ol>
          ) : (
            <p className="flex items-start gap-2 text-ui-sm" data-testid="suporte-extensao-sem-loja">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <span>
                {'Neste ambiente a extensão ainda não está na loja do Chrome: quem a instala é a equipe que administra o '
                  + 'sistema. Se ela já foi instalada, clique em '}<strong>{'Já instalei'}</strong>
                {'; senão, siga sem ela — você escolhe a janela a compartilhar.'}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={seguirSemExtensao} data-testid="suporte-seguir-sem-extensao" className={`${BOTAO_NEUTRO} mr-auto`}>
              {'Seguir sem ela'}
            </button>
            <button
              type="button" onClick={() => void jaInstalei()} disabled={conferindoExtensao} data-testid="suporte-ja-instalei"
              className={BOTAO_NEUTRO}
            >
              {'Já instalei'}
            </button>
            {temLoja && (
              <button type="button" onClick={instalarExtensao} autoFocus data-testid="suporte-instalar-extensao-agora" className={BOTAO_DESTAQUE}>
                <Download className="w-4 h-4" aria-hidden="true" /> {'Instalar a extensão'}
              </button>
            )}
          </div>
        </div>
      </XModalShell>
    );
  }

  if (fase === 'senha') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        {/* Largura fixa e estreita (dono, 2026-11-19: "menor e mais elegante"): o texto quebra em vez de alargar o diálogo. */}
        <form onSubmit={abrir} className="w-full sm:w-[28rem] p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-senha">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-indigo-600/15 text-indigo-500" aria-hidden="true">
              <Headset className="w-5 h-5" />
            </span>
            <div className="space-y-1">
              <p>
                {'Um atendente vai '}<strong>{'ver a sua tela'}</strong>{', falar com você e poderá '}
                <strong>{'operar esta aba'}</strong>{'. Você encerra quando quiser.'}
              </p>
              <p className="text-ui-sm text-brand-text-secondary" data-testid="suporte-prazo">
                {`A chamada espera na fila por até ${prazoEmPalavras}; depois, vai ao quadro do suporte e um atendente `
                  + 'retorna, com aviso no sino.'}
              </p>
            </div>
          </div>
          {extensaoInstalada && (
            <p className="flex items-center gap-2 text-ui-sm" role="status" data-testid="suporte-extensao-instalada">
              <CheckCircle className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
              <span>{'Extensão de suporte instalada: o atendente verá esta aba sem você escolher o que compartilhar.'}</span>
            </p>
          )}
          {semAtendente && (
            <div className="space-y-2 p-3 rounded-lg border border-border-light" data-testid="suporte-sem-atendente">
              <p className="flex items-start gap-2 text-ui-sm">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <strong>{'Não há atendente online agora.'}</strong>
                  {` Você pode chamar assim mesmo: se um atendente entrar nos próximos ${prazoEmPalavras}, ele atende. `
                    + 'Descreva o problema, para ele saber do que se trata se precisar retornar.'}
                </span>
              </p>
              {disponibilidade.horarios.length > 0 && (
                <div className="text-ui-sm pl-6">
                  <p className="font-medium">{'Horário de atendimento'}</p>
                  <ul className="text-brand-text-secondary">
                    {disponibilidade.horarios.map((pLinha) => <li key={pLinha}>{pLinha}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="suporte-descricao-campo" className="block text-ui-sm font-medium">
              {semAtendente ? 'O problema (recomendado)' : 'O problema (opcional)'}
            </label>
            <textarea
              id="suporte-descricao-campo" value={descricao} rows={2} maxLength={TAMANHO_MAXIMO_DA_DESCRICAO}
              autoFocus={semAtendente} placeholder={'O que você fazia e o que aconteceu'}
              title={'É o que o atendente lê antes de falar com você.'}
              onChange={(pEvento) => setDescricao(pEvento.target.value)}
              className="w-full px-2.5 py-2 text-ui border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="suporte-senha-campo" className="block text-ui-sm font-medium">{'Sua senha'}</label>
            <input
              id="suporte-senha-campo" type="password" value={senha} autoComplete="current-password" autoFocus={!semAtendente}
              aria-describedby="suporte-senha-dica"
              onChange={(pEvento) => setSenha(pEvento.target.value)}
              className="w-full px-2.5 min-h-editor text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <p id="suporte-senha-dica" className="text-ui-xs text-brand-text-secondary">
              {'A de entrar no sistema: confirma que é você quem chama.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {!senha && (
              <p className="mr-auto text-ui-xs text-brand-text-secondary">{'Para chamar, falta digitar a sua senha.'}</p>
            )}
            <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Cancelar'}</button>
            <button type="submit" disabled={!senha || abrindo} data-testid="suporte-chamar" className={BOTAO_DESTAQUE}>
              {abrindo && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {'Chamar'}
            </button>
          </div>
        </form>
      </XModalShell>
    );
  }

  if (fase === 'fim') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Suporte'} closeLabel={'Fechar'} onClose={fechar}>
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-fim">
          <p>{motivoDoFim}</p>
          {aDescrever ? (
            <form onSubmit={enviarDescricao} className="space-y-2" data-testid="suporte-descrever">
              <label htmlFor="suporte-descricao-quadro" className="block font-medium">{'Descreva o problema para o atendente'}</label>
              <p className="text-ui-sm text-brand-text-secondary">
                {'O chamado foi ao quadro sem descrição. Conte o que você estava fazendo e o que aconteceu: é o que o '
                  + 'atendente lê antes de retornar.'}
              </p>
              <textarea
                id="suporte-descricao-quadro" value={descricao} rows={3} maxLength={TAMANHO_MAXIMO_DA_DESCRICAO} autoFocus
                onChange={(pEvento) => setDescricao(pEvento.target.value)}
                className="w-full px-2.5 py-2 text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <div className="flex items-center justify-end gap-2">
                {!descricao.trim() && (
                  <p className="mr-auto text-ui-sm text-brand-text-secondary">{'Para enviar, falta escrever a descrição.'}</p>
                )}
                <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Fechar sem descrever'}</button>
                <button type="submit" disabled={!descricao.trim() || descrevendo} data-testid="suporte-enviar-descricao" className={BOTAO_DESTAQUE}>
                  {descrevendo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                  {'Enviar a descrição'}
                </button>
              </div>
            </form>
          ) : aAvaliar ? (
            <div className="space-y-2" data-testid="suporte-avaliacao">
              <p className="font-medium">{'O seu caso foi resolvido?'}</p>
              <div className="flex gap-2">
                <button type="button" disabled={avaliando} onClick={() => void avaliar(true)} className={BOTAO_DESTAQUE}>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" /> {'Sim, foi resolvido'}
                </button>
                <button type="button" disabled={avaliando} onClick={() => void avaliar(false)} className={BOTAO_NEUTRO}>
                  {'Não foi resolvido'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Fechar'}</button>
            </div>
          )}
        </div>
      </XModalShell>
    );
  }

  // O que pede ação sobre a tela: liberar a aba na extensão, instalar a extensão, aba errada, ou o pedido que falhou.
  const avisosDaTela = (
    <>
      {liberacao && (
        <div className="flex items-start gap-2 text-ui-sm" role="status" aria-live="polite" data-testid="suporte-liberar-extensao">
          <Puzzle className="w-4 h-4 mt-0.5 shrink-0 text-indigo-700" aria-hidden="true" />
          <span className="flex-1">{liberacao}</span>
          <button type="button" onClick={desistirDaLiberacao} className="shrink-0 underline text-brand-text-secondary hover:text-brand-text-primary">
            {'Cancelar'}
          </button>
        </div>
      )}
      {ofertaDeExtensao && (
        <div className="space-y-2 text-ui-sm" data-testid="suporte-oferta-extensao">
          <p className="flex items-start gap-2">
            <Puzzle className="w-4 h-4 mt-0.5 shrink-0 text-indigo-700" aria-hidden="true" />
            <span>
              {'Com a '}<strong>{'extensão de suporte'}</strong>{' instalada, o atendente vê esta aba sem você precisar '
                + 'escolher o que compartilhar. Instale (leva um minuto) e clique de novo em compartilhar.'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={instalarExtensao} data-testid="suporte-instalar-extensao"
              className="inline-flex items-center gap-2 px-3 py-1.5 font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800"
            >
              <Download className="w-4 h-4" aria-hidden="true" /> {'Instalar a extensão'}
            </button>
            <button
              type="button" onClick={() => void compartilhar(true)} data-testid="suporte-compartilhar-sem-extensao"
              className="px-3 py-1.5 font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover"
            >
              {'Compartilhar sem a extensão'}
            </button>
          </div>
        </div>
      )}
      {telaPronta && !capturaServe && (
        <p className="flex items-start gap-2 text-ui-sm" data-testid="suporte-aba-errada">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {'Você compartilhou uma aba do navegador, e não a janela dele. O atendente vê aquela aba, mas os cliques '
              + 'dele não vão cair no lugar certo. Para ele poder operar, pare o compartilhamento e escolha a janela '
              + 'deste navegador.'}
          </span>
        </p>
      )}
      {falhaDaTela && (
        <p className="flex items-start gap-2 text-ui-sm" role="alert">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>{falhaDaTela}</span>
        </p>
      )}
    </>
  );

  const blocoDaTela = (
    <div className="space-y-2">
      {telaPronta ? (
        <p className="flex items-center gap-2 text-ui-sm">
          <CheckCircle className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            {'Tela liberada'}
            {temMicrofone ? ' e microfone ligado.' : '. O microfone não foi liberado: você ouve o atendente, mas ele não ouve você.'}
          </span>
        </p>
      ) : (
        <button
          type="button" onClick={() => void compartilhar()} disabled={pedindoTela} data-testid="suporte-compartilhar"
          className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50"
        >
          {pedindoTela ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MonitorUp className="w-4 h-4" aria-hidden="true" />}
          {'Compartilhar a tela e o microfone'}
        </button>
      )}
      {avisosDaTela}
    </div>
  );

  if (fase === 'aguardando') {
    return (
      <XModalShell
        variant="overlay" size="sm" title={'Chamando o suporte'} closeLabel={'Cancelar a chamada'}
        onClose={() => void encerrar()}
      >
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-espera">
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 shrink-0 animate-spin text-brand-primary" aria-hidden="true" />
            <span>{'Aguardando um atendente assumir a sua chamada…'}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {chamada && chamada.posicao > 0 && (
              <>
                <dt className="text-brand-text-secondary">{'Sua posição na fila'}</dt>
                <dd className="font-semibold tabular-nums" data-testid="suporte-posicao">{`${chamada.posicao}º`}</dd>
                <dt className="text-brand-text-secondary">{'Atendimento estimado'}</dt>
                <dd className="font-semibold" data-testid="suporte-estimativa">{formatarEstimativa(chamada.esperaEstimadaSegundos)}</dd>
              </>
            )}
            <dt className="text-brand-text-secondary">{'Tempo máximo de espera'}</dt>
            <dd className="font-semibold tabular-nums text-lg" role="timer" data-testid="suporte-contador">{formatarEspera(restantes)}</dd>
          </dl>
          <p className="text-ui-sm text-brand-text-secondary">
            {semAtendente
              ? 'Não há atendente online agora, mas um pode entrar enquanto você espera. Se ninguém assumir até o fim do prazo, '
                + 'a chamada fica registrada no quadro do suporte e um atendente retorna.'
              : 'Se ninguém assumir até o fim do prazo, a chamada fica registrada no quadro do suporte e um atendente retorna.'}
          </p>
          <div className="pt-3 border-t border-border-light space-y-2">
            <p className="font-medium">{'Enquanto espera, libere a tela'}</p>
            <p className="text-ui-sm text-brand-text-secondary">
              {'O navegador vai perguntar o que compartilhar: escolha a janela deste navegador. Nada é transmitido antes de um atendente assumir a chamada.'}
            </p>
            {blocoDaTela}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => void encerrar()} data-testid="suporte-cancelar" className={BOTAO_NEUTRO}>
              {'Cancelar a chamada'}
            </button>
          </div>
        </div>
      </XModalShell>
    );
  }

  // Em atendimento: uma barra fixa embaixo, fora do caminho. A aplicação fica inteira à vista e em uso —
  // é ela que o atendente precisa ver. O ponteiro dele aparece por cima de tudo e não recebe clique.
  const situacaoDaLigacao = !atendenteNaChamada
    ? 'O atendente não está na chamada agora (saiu da página ou perdeu a conexão). A chamada continua aberta e se refaz '
      + 'sozinha quando ele voltar.'
    : !telaPronta
    ? (midia.current && ligacao === 'connected'
      ? 'A sua tela não está sendo compartilhada: o atendente ouve você, mas não vê a tela.'
      : 'Falta liberar a tela para o atendente ver.')
    : ligacao === 'connected' ? 'O atendente vê a sua tela e pode operar esta aba.'
      : ligacao === 'failed' ? 'A conexão de tela e áudio não se estabeleceu: as duas redes não se alcançaram. Encerre e chame de novo.'
        : ligacao === 'disconnected' ? 'A conexão com o atendente caiu; tentando retomar…'
          : 'Conectando tela e áudio ao atendente…';

  const tituloDaJanela = `${atendenteNaChamada ? 'Suporte conectado' : 'Suporte aguardando o atendente'}${chamada?.atendente ? ` · ${chamada.atendente}` : ''}`;


  const dicaDoMicrofone = !temMicrofone
    ? 'O microfone não foi liberado: você ouve o atendente, mas ele não ouve você'
    : mudo ? 'Microfone desligado: clique para ligar' : 'Microfone ligado: clique para desligar';

  return createPortal(
    <>
      <audio ref={audio} autoPlay />
      <div
        ref={cursorVirtual} aria-hidden="true" data-testid="suporte-cursor-virtual"
        className="fixed top-0 left-0 w-0.5 bg-indigo-600 pointer-events-none invisible animate-pulse"
        style={{ zIndex: zIndex + 1 }}
      />
      <div
        ref={ponteiro} aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none opacity-0 transition-opacity"
        style={{ zIndex: zIndex + 1 }}
      >
        <MousePointer2 className="w-6 h-6 text-indigo-700 fill-indigo-300 drop-shadow" />
      </div>
      {/* A janela de controle: começa embaixo, no meio, e o usuário a arrasta para onde não atrapalhe. */}
      <div className="fixed inset-0 flex items-end justify-center p-4 pointer-events-none" style={{ zIndex }}>
      <div
        ref={janela.ref}
        {...{ [ATRIBUTO_DO_SUPORTE]: '' }}
        role="region" aria-label={'Atendimento de suporte em curso'} data-testid="suporte-barra"
        className="pointer-events-auto max-w-[24rem] x-moldura-modal bg-brand-surface rounded-xl shadow-lg p-1.5 space-y-1.5 text-ui text-brand-text-primary will-change-transform transition-none"
      >
        {/* A situação também vai, inteira, a quem usa leitor de tela. */}
        <p className="sr-only" role="status" aria-live="polite" data-testid="suporte-situacao">
          {`${tituloDaJanela}. ${situacaoDaLigacao}`}
        </p>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center px-0.5 h-9 cursor-move select-none touch-none text-brand-text-secondary"
            {...janela.alca}
            title={`${tituloDaJanela}\n${situacaoDaLigacao}\nArraste para mudar a janela de lugar.`}
            data-testid="suporte-barra-alca"
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </div>
          {!enrolada && (<>
          {telaPronta ? (
            <button
              type="button" onClick={soltarTela} data-testid="suporte-parar-tela"
              aria-label={'Parar de compartilhar a tela'} title={'Parar de compartilhar a tela (a voz continua)'}
              className={BOTAO_DE_ICONE}
            >
              <ScreenShareOff className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button" onClick={() => void compartilhar()} disabled={pedindoTela} data-testid="suporte-compartilhar"
              aria-label={'Compartilhar a tela'} title={'Compartilhar a tela: escolha a janela deste navegador'}
              className={`${BOTAO_DE_ICONE} !text-white !bg-indigo-700 !border-indigo-700 hover:!bg-indigo-800`}
            >
              {pedindoTela ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MonitorUp className="w-4 h-4" aria-hidden="true" />}
            </button>
          )}
          <XBotaoDeCamera camera={camera} compacto className={BOTAO_DE_ICONE} />
          <button
            type="button" onClick={alternarMudo} disabled={!temMicrofone} aria-pressed={temMicrofone ? mudo : undefined}
            aria-label={dicaDoMicrofone} title={dicaDoMicrofone} data-testid="suporte-microfone"
            className={BOTAO_DE_ICONE}
          >
            {mudo || !temMicrofone ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button
            type="button" onClick={() => void encerrar()} data-testid="suporte-encerrar"
            aria-label={'Encerrar o atendimento'} title={'Encerrar o atendimento'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white bg-red-700 hover:bg-red-800"
          >
            <PhoneOff className="w-4 h-4" aria-hidden="true" />
          </button>
          </>)}
          <XBotaoDeEnrolar enrolado={enrolada} aoAlternar={() => setEnrolada((pAtual) => !pAtual)} />
        </div>
        {ligacao === 'failed' && (
          <p className="flex items-start gap-2 px-1 text-ui-sm" role="alert">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{situacaoDaLigacao}</span>
          </p>
        )}
        {avisosDaTela}
        {!enrolada && <XQuadrosDeCamera camera={camera} nomeDaOutraPonta={'o atendente'} />}
        {janela.alcasDeRedimensionar}
      </div>
      </div>
    </>,
    document.body
  );
}
