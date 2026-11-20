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
 *      depois;
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
 * É diálogo DA CASCA (nasce do menu do perfil; App nenhum o aciona), o único tipo que usa overlay.
 *
 * O controle da aba é feito por eventos criados nesta página (`ReprodutorDeGestos`), com as travas de lá:
 * campo de senha não recebe digitação remota, e o gesto do próprio usuário tem prioridade.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, GripVertical, Headset, Loader2, Mic, MicOff, MonitorUp, MousePointer2, PhoneOff, ScreenShareOff, Send, TriangleAlert } from 'lucide-react';
import type { HubConnection } from '@microsoft/signalr';

import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XModalShell } from '@core/components/templates/XModalShell';
import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';
import { criarCanalDeSuporte, encerrarCanal, entrarNaChamada, sinalizar } from '@core/lib/suporte/canalDeSuporte';
import { ConexaoDeMidia, pararMidia, pedirMicrofone, pedirTela, superficieCompartilhada } from '@core/lib/suporte/conexaoDeMidia';
import type { SuperficieCompartilhada } from '@core/lib/suporte/controleRemoto';
import { lerGesto, serializarGesto } from '@core/lib/suporte/controleRemoto';
import { ehCampoDeEscrita, posicaoDoCursor } from '@core/lib/suporte/cursorVirtual';
import { ATRIBUTO_DO_SUPORTE, ReprodutorDeGestos } from '@core/lib/suporte/reproducaoDeGesto';
import {
  ROTA_DAS_CHAMADAS, formatarEspera, formatarEstimativa, servidoresDoNavegador,
  type ChamadaDeSuporte, type DisponibilidadeDoSuporte, type ServidorICE, type TipoDeRecado,
} from '@core/lib/suporte/tipos';

import { XBotaoDeCamera } from './XBotaoDeCamera';
import { XBotaoDeEnrolar } from './XBotaoDeEnrolar';
import { XQuadrosDeCamera } from './XQuadrosDeCamera';
import { useCameraDeSuporte } from './useCameraDeSuporte';

interface XChamarSuporteProps {
  /** O menu do perfil pediu a chamada. Durante o atendimento a barra fica visível mesmo com `false`. */
  aberto: boolean;
  aoFechar: () => void;
}

type Fase = 'inativo' | 'consultando' | 'indisponivel' | 'senha' | 'aguardando' | 'atendimento' | 'fim';

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
  const chamadaAtual = useRef<ChamadaDeSuporte | null>(null);
  const atendentePresente = useRef(false);
  const ofertando = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ponteiro = useRef<HTMLDivElement | null>(null);
  const cursorVirtual = useRef<HTMLDivElement | null>(null);

  const camera = useCameraDeSuporte(() => midia.current);

  // A janela de controle se arrasta pelo cabeçalho, para sair de cima do que o usuário precisa ver.
  const janela = useMolduraDeModal({
    arrastavel: true, redimensionavel: false, conterAoMudarDeTamanho: true, aberto: fase === 'atendimento',
  });
  // Enrolada, a janela fica só na alça (situação e arrasto) e no botão de desenrolar.
  const [enrolada, setEnrolada] = useState(false);

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
    desligarCamera();
    tela.current = null;
    microfone.current = null;
    atendentePresente.current = false;
    chamadaAtual.current = null;

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
    setDisponibilidade(null);
    setFase('inativo');
    aoFechar();
  }, [aoFechar]);

  // O menu pediu a chamada: primeiro pergunta-se ao servidor o que é possível. Havendo chamada em curso, o
  // pedido não a derruba.
  useEffect(() => {
    if (!aberto || fase !== 'inativo')
      return;

    let vivo = true;

    setFase('consultando');

    api.get<DisponibilidadeDoSuporte>(`${ROTA_DAS_CHAMADAS}/disponibilidade`)
      .then((pDisponibilidade) => {
        if (!vivo)
          return;

        setDisponibilidade(pDisponibilidade);
        setFase(pDisponibilidade.disponivel ? 'senha' : 'indisponivel');
      })
      // A falha já saiu no diálogo de mensagem, com o motivo: não há o que mostrar aqui.
      .catch(() => { if (vivo) fechar(); });

    return () => { vivo = false; };
    // Só a abertura dispara a consulta: `fase` muda dentro do próprio efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

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

      const hub = criarCanalDeSuporte();

      chamadaAtual.current = nova;
      canal.current = hub;

      hub.on('ChamadaMudou', (pChamada: ChamadaDeSuporte) => aplicarSituacao(pChamada));
      hub.on('ParticipanteEntrou', (pID: string) => {
        if (pID !== chamadaAtual.current?.id)
          return;

        // O atendente entrou (ou voltou, depois de recarregar a página): a ligação anterior, se havia, era
        // com a aba antiga dele e não serve mais.
        atendentePresente.current = true;
        desligarMidia();
        void tentarOfertar();
      });
      hub.on('ParticipanteSaiu', (pID: string) => {
        if (pID !== chamadaAtual.current?.id)
          return;

        // O atendente caiu, mas a chamada continua dele: se voltar, a ligação se refaz.
        atendentePresente.current = false;
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
      await entrarNaChamada(hub, nova.id);

      setChamada(nova);
      setRestantes(nova.segundosRestantes);

      // Em atendimento logo de saída: é o retorno de um chamado do quadro. O atendente já espera na chamada,
      // e entrou nela antes desta conexão existir — por isso conta como presente sem aviso de entrada.
      if (nova.situacao === 'EmAtendimento') {
        atendentePresente.current = true;
        setFase('atendimento');
      } else {
        setFase('aguardando');
      }
    } catch {
      // Senha recusada ou servidor fora: o motivo já saiu no diálogo de mensagem. Nada ficou aberto.
      limpar();
    } finally {
      setAbrindo(false);
    }
  }

  async function compartilhar(): Promise<void> {
    if (pedindoTela)
      return;

    setPedindoTela(true);
    setFalhaDaTela('');

    try {
      const novaTela = await pedirTela();

      // O usuário pode parar o compartilhamento pela barra do próprio navegador, a qualquer momento: é o
      // mesmo que parar pela janela de controle.
      novaTela.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (tela.current === novaTela)
          soltarTela();
      });

      tela.current = novaTela;
      superficie.current = superficieCompartilhada(novaTela);
      reprodutor.current?.definirSuperficie(superficie.current);
      // Aba é OUTRA aba (a deste sistema não é oferecida): o atendente a vê, mas os cliques cairiam aqui.
      setCapturaServe(superficie.current !== 'browser');
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
    } catch {
      setFalhaDaTela(
        'A tela não foi compartilhada: o pedido foi recusado ou a janela de escolha foi fechada. '
        + 'Sem a tela, o atendente não vê o que você vê. Clique de novo e escolha a janela deste navegador.');
    } finally {
      setPedindoTela(false);
    }
  }

  // Para de mostrar a tela sem derrubar a ligação: a voz e a câmera seguem, e o atendente é avisado.
  function soltarTela(): void {
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

  if (fase === 'inativo')
    return null;

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

  if (fase === 'senha') {
    return (
      <XModalShell variant="overlay" size="md" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        <form onSubmit={abrir} className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-senha">
          <p>
            {'Um atendente vai '}<strong>{'ver a sua tela'}</strong>{', falar com você por áudio (e por vídeo, se vocês ligarem a câmera) e poderá '}
            <strong>{'operar esta aba'}</strong>{'. Você encerra quando quiser.'}
          </p>
          <p className="text-ui-sm text-brand-text-secondary" data-testid="suporte-prazo">
            {`A sua chamada espera na fila por até ${prazoEmPalavras}. Se nenhum atendente a assumir nesse tempo, ela fica `
              + 'registrada no quadro do suporte, e um atendente retorna: você recebe um aviso no sino.'}
          </p>
          {semAtendente && (
            <div className="space-y-2" data-testid="suporte-sem-atendente">
              <p className="flex items-start gap-2">
                <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <strong>{'Não há atendente online agora.'}</strong>
                  {` Você pode chamar assim mesmo: se um atendente entrar nos próximos ${prazoEmPalavras}, ele atende. `
                    + 'Descreva o problema, para o atendente saber do que se trata se precisar retornar.'}
                </span>
              </p>
              {disponibilidade.horarios.length > 0 && (
                <div className="text-ui-sm">
                  <p className="font-medium">{'Horário de atendimento'}</p>
                  <ul className="text-brand-text-secondary">
                    {disponibilidade.horarios.map((pLinha) => <li key={pLinha}>{pLinha}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="suporte-descricao-campo" className="block font-medium">
              {semAtendente ? 'Descreva o problema (recomendado)' : 'Descreva o problema (opcional)'}
            </label>
            <p className="text-ui-sm text-brand-text-secondary">
              {'O que você estava fazendo e o que aconteceu. É o que o atendente lê antes de falar com você.'}
            </p>
            <textarea
              id="suporte-descricao-campo" value={descricao} rows={3} maxLength={TAMANHO_MAXIMO_DA_DESCRICAO}
              autoFocus={semAtendente}
              onChange={(pEvento) => setDescricao(pEvento.target.value)}
              className="w-full px-2.5 py-2 text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="suporte-senha-campo" className="block font-medium">{'Sua senha'}</label>
            <p className="text-ui-sm text-brand-text-secondary">
              {'A senha com que você entra no sistema. Ela é pedida de novo para confirmar que é você quem está chamando.'}
            </p>
            <input
              id="suporte-senha-campo" type="password" value={senha} autoComplete="current-password" autoFocus={!semAtendente}
              onChange={(pEvento) => setSenha(pEvento.target.value)}
              className="w-full px-2.5 min-h-editor text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            {!senha && (
              <p className="mr-auto text-ui-sm text-brand-text-secondary">{'Para chamar, falta digitar a sua senha.'}</p>
            )}
            <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Cancelar'}</button>
            <button type="submit" disabled={!senha || abrindo} data-testid="suporte-chamar" className={BOTAO_DESTAQUE}>
              {abrindo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Headset className="w-4 h-4" aria-hidden="true" />}
              {'Chamar suporte'}
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

  // O que pede ação sobre a tela: aba errada, ou o pedido de compartilhar que falhou.
  const avisosDaTela = (
    <>
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
  const situacaoDaLigacao = !telaPronta
    ? (midia.current && ligacao === 'connected'
      ? 'A sua tela não está sendo compartilhada: o atendente ouve você, mas não vê a tela.'
      : 'Falta liberar a tela para o atendente ver.')
    : ligacao === 'connected' ? 'O atendente vê a sua tela e pode operar esta aba.'
      : ligacao === 'failed' ? 'A conexão de tela e áudio não se estabeleceu: as duas redes não se alcançaram. Encerre e chame de novo.'
        : ligacao === 'disconnected' ? 'A conexão com o atendente caiu; tentando retomar…'
          : 'Conectando tela e áudio ao atendente…';

  const tituloDaJanela = `Suporte conectado${chamada?.atendente ? ` · ${chamada.atendente}` : ''}`;

  // A situação em ícone, de FORMA diferente por estado (não só pela cor): o texto inteiro fica no hint.
  const iconeDaSituacao = telaPronta && ligacao === 'connected'
    ? <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />
    : ligacao === 'failed' || !telaPronta
      ? <TriangleAlert className="w-4 h-4 text-warning" aria-hidden="true" />
      : <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />;

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
            className="flex items-center gap-1 px-1 h-9 rounded-lg cursor-move select-none touch-none text-brand-text-secondary hover:bg-hover"
            {...janela.alca}
            title={`${tituloDaJanela}\n${situacaoDaLigacao}\nArraste para mudar a janela de lugar.`}
            data-testid="suporte-barra-alca"
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
            <Headset className="w-5 h-5 text-indigo-700" aria-hidden="true" />
            {iconeDaSituacao}
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
