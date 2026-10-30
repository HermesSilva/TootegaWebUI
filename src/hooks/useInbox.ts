import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { api, getAccessToken } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { useAuth } from './useAuth';

/**
 * Uma mensagem do inbox durável, como o back a envia (MensagemDTO, camelCase). A severidade muda a
 * COR e o tom, nunca o quadro (CE-20): 1 Informação, 2 Sucesso, 3 Aviso, 4 Erro.
 */
export interface MensagemInbox {
  id: string;
  severidade: number;
  titulo: string;
  corpo: string;
  referencia: string;
  criacao: string;
}

// Rota REST do inbox (via SYS) e o hub de tempo real. O hub fica na RAIZ (não sob /api): o SignalR
// resolve '/hub/mensagens' contra a origem. O token vai pelo accessTokenFactory (query no WebSocket).
const BASE_MENSAGENS = '/sys/mensagens';
const HUB_MENSAGENS = '/hub/mensagens';

/**
 * Inbox de mensagens do usuário: carrega as não lidas ao abrir, conecta o WebSocket (SignalR) e recebe
 * as novas em tempo real. Fechou o navegador e reabriu? A reconexão reentrega as pendentes (o hub as
 * empurra no OnConnected). Confirma a entrega ao receber e marca lida sob demanda. Só conecta quando há
 * usuário autenticado.
 */
export function useInbox(): {
  mensagens: MensagemInbox[];
  naoLidas: number;
  conectado: boolean;
  falha: string | null;
  marcarLida: (pID: string) => void;
  marcarTodasLidas: () => void;
} {
  const { isAuthenticated } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemInbox[]>([]);
  const [conectado, setConectado] = useState(false);
  /**
   * O que impediu a caixa de carregar, se algo impediu.
   *
   * <b>Caixa vazia e caixa que não carregou são coisas diferentes</b>, e até 2026-08-12 a tela dizia
   * "Sem mensagens novas." para as duas: a carga inicial tinha `catch` vazio, então servidor fora do
   * ar, 500 no endpoint ou sessão expirada apareciam como silêncio — e o operador concluía que não
   * havia aviso nenhum. Erro mudo é defeito (CE-21-quater): quem não pôde ler a caixa precisa saber
   * disso, e por quê.
   */
  const [falha, setFalha] = useState<string | null>(null);
  const conexaoRef = useRef<HubConnection | null>(null);

  // Acrescenta sem duplicar (a carga inicial e o empurrão do hub podem trazer a mesma mensagem).
  const acrescentar = useCallback((pMensagem: MensagemInbox) => {
    setMensagens(pAtuais =>
      pAtuais.some(m => m.id === pMensagem.id) ? pAtuais : [pMensagem, ...pAtuais]);
  }, []);

  const marcarLida = useCallback((pID: string) => {
    // Otimista: some da lista já; o back registra Lida. Silencioso (pSilent) — marcar não deve
    // interromper o usuário com diálogo de erro se falhar; a mensagem volta na próxima carga.
    setMensagens(pAtuais => pAtuais.filter(m => m.id !== pID));
    void api.post(`${BASE_MENSAGENS}/${pID}/lida`).catch(() => { /* reentrega na próxima carga */ });
  }, []);

  /**
   * Limpa a caixa inteira. UMA requisição, não uma por mensagem: quem tem dezenas de avisos de rotina
   * acumulados pagaria dezenas de idas ao servidor para o mesmo efeito — e a lista sumiria aos pedaços.
   *
   * Otimista como o `marcarLida`, e pela mesma razão: limpar a caixa não pode travar a interface
   * esperando o servidor. Falhou? As mensagens voltam na próxima carga — nada se perde, porque marcar
   * lida não apaga nada; elas continuam no histórico.
   */
  const marcarTodasLidas = useCallback(() => {
    setMensagens([]);
    void api.post(`${BASE_MENSAGENS}/lidas`).catch(() => { /* reentrega na próxima carga */ });
  }, []);

  useEffect(() => {
    if (!isAuthenticated)
      return;

    let ativo = true;

    // Carga inicial das não lidas. Silenciosa quanto ao DIÁLOGO — o sino não interrompe ninguém com
    // uma caixa de erro global —, nunca quanto ao FATO: a falha fica no estado e o painel a mostra.
    void api.get<MensagemInbox[]>(`${BASE_MENSAGENS}/nao-lidas`, undefined, true)
      .then(pLista => {
        if (!ativo)
          return;

        if (Array.isArray(pLista)) {
          setMensagens(pLista);
          setFalha(null);
        }
      })
      .catch((pErro: unknown) => {
        if (ativo)
          setFalha(mensagemDeFalha(pErro, 'carregar as mensagens'));
      });

    const conexao = new HubConnectionBuilder()
      .withUrl(HUB_MENSAGENS, { accessTokenFactory: () => getAccessToken() ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    conexao.on('Mensagem', (pMensagem: MensagemInbox) => {
      if (!ativo || !pMensagem?.id)
        return;
      acrescentar(pMensagem);
      // Confirma o recebimento (Entregue) — o back registra que chegou ao cliente.
      void api.post(`${BASE_MENSAGENS}/${pMensagem.id}/entregue`).catch(() => { /* reentrega depois */ });
    });

    conexao.onreconnected(() => { if (ativo) setConectado(true); });
    conexao.onreconnecting(() => { if (ativo) setConectado(false); });
    conexao.onclose(() => { if (ativo) setConectado(false); });

    conexaoRef.current = conexao;
    conexao.start()
      .then(() => { if (ativo) setConectado(true); })
      .catch(() => { /* WebSocket indisponível; o REST já trouxe as não lidas */ });

    return () => {
      ativo = false;
      conexaoRef.current = null;
      if (conexao.state !== HubConnectionState.Disconnected)
        void conexao.stop();
    };
  }, [isAuthenticated, acrescentar]);

  return { mensagens, naoLidas: mensagens.length, conectado, falha, marcarLida, marcarTodasLidas };
}
