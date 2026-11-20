/**
 * XAvisoDeChamadas — no cabeçalho, avisa o atendente de que há chamada de suporte esperando na fila ou
 * chamado registrado no quadro, nos grupos dele.
 *
 * A chamada da fila espera poucos minutos; sem aviso à vista, ela expiraria antes de alguém abrir o quadro.
 * Por isso o aviso mora na casca, e não dentro da App de atendimento: aparece em qualquer tela em que o
 * atendente esteja, com os números e o atalho para o quadro.
 *
 * <b>Este componente é também o que mantém o atendente ONLINE.</b> A conexão que ele abre no hub de suporte
 * é a que o servidor conta como presença: enquanto o atendente tem o sistema aberto, as chamadas do grupo
 * dele entram na fila; sem nenhum atendente conectado, viram chamado no quadro.
 *
 * <b>Chamada nova abre o aviso de chamada recebida</b> (dono, 2026-11-19): quando entra na fila uma chamada que o
 * atendente ainda não viu, aparece o diálogo com quem chamou e o botão "Atender", que abre a App de atendimento
 * já iniciando o atendimento, e toca um som curto. "Agora não" dispensa AQUELA chamada (o número continua no
 * cabeçalho); a seguinte avisa de novo. O aviso chega por PUSH (o hub manda `FilaMudou` quando a fila muda) e
 * aparece MESMO durante um atendimento (dono, 2026-11-19): aí ele diz que é preciso encerrar o atendimento em
 * curso para atender esta, porque o atendente cuida de uma chamada por vez.
 *
 * Quem é atendente não se decide aqui: é quem tem a App "Atendimento de suporte" no próprio menu (o menu
 * já vem podado pelo back). Para todos os outros o componente não conecta nada e não desenha nada.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Headset } from 'lucide-react';

import { api } from '@core/lib/api';
import { useUserMenu } from '@core/hooks/useMenu';
import { useResolvedorLinkApp } from '@core/hooks/useResolvedorLinkApp';
import { useTabs } from '@core/hooks/useTabs';
import { criarCanalDeSuporte, encerrarCanal } from '@core/lib/suporte/canalDeSuporte';
import { tocarAvisoDeChamada } from '@core/lib/suporte/toqueDeChamada';
import {
  APP_DE_ATENDIMENTO, COMANDO_DE_ATENDER, ROTA_DAS_CHAMADAS, type ChamadaDeSuporte, type PendenciasDoSuporte,
} from '@core/lib/suporte/tipos';

import { XChamadaRecebida } from './XChamadaRecebida';

const SEM_PENDENCIAS: PendenciasDoSuporte = { naFila: 0, noQuadro: 0, emAtendimento: false, proxima: null };

/** Releitura periódica: cobre o aviso em tempo real que não chegou e a chamada que expirou sem aviso. */
const RELEITURA_MS = 30_000;

const plural = (pQuantas: number, pUma: string, pVarias: string): string => `${pQuantas} ${pQuantas === 1 ? pUma : pVarias}`;

export function XAvisoDeChamadas(): JSX.Element | null {
  const { data: menu } = useUserMenu();
  const resolver = useResolvedorLinkApp();
  const { openTab, getTabsByMenuItemID, pedirAcao } = useTabs();
  const [pendencias, setPendencias] = useState<PendenciasDoSuporte>(SEM_PENDENCIAS);
  // As chamadas que este atendente já viu no aviso (atendeu ou dispensou): não avisam de novo.
  const [vistas, setVistas] = useState<ReadonlySet<string>>(() => new Set());
  const tocada = useRef<string | null>(null);

  const itemDoAtendimento = menu?.groups
    .flatMap((pGrupo) => pGrupo.items)
    .find((pItem) => pItem.name.toLowerCase() === APP_DE_ATENDIMENTO.toLowerCase());
  const atende = !!itemDoAtendimento;

  const contar = useCallback(async () => {
    try {
      const resposta = await api.get<PendenciasDoSuporte>(`${ROTA_DAS_CHAMADAS}/pendentes`, undefined, true);

      setPendencias({
        naFila: Number(resposta?.naFila) || 0,
        noQuadro: Number(resposta?.noQuadro) || 0,
        emAtendimento: resposta?.emAtendimento === true,
        proxima: resposta?.proxima?.id ? resposta.proxima : null,
      });
    } catch {
      // Sem resposta, valem os últimos números: o aviso não some nem aparece por causa de uma falha de rede.
    }
  }, []);

  useEffect(() => {
    if (!atende) {
      setPendencias(SEM_PENDENCIAS);
      return;
    }

    const hub = criarCanalDeSuporte();

    hub.on('FilaMudou', () => void contar());
    hub.onreconnected(() => void contar());
    void hub.start().catch(() => { /* sem tempo real, a releitura periódica mantém os números */ });

    void contar();

    const releitura = window.setInterval(() => void contar(), RELEITURA_MS);

    return () => {
      window.clearInterval(releitura);
      void encerrarCanal(hub);
    };
  }, [atende, contar]);

  // A chamada a avisar: a próxima da fila que o atendente ainda não viu — esteja ele livre ou em atendimento.
  const aAvisar: ChamadaDeSuporte | null = atende && pendencias.proxima
    && !vistas.has(pendencias.proxima.id)
    ? pendencias.proxima
    : null;

  // O som sai uma vez por chamada, quando o aviso dela aparece.
  useEffect(() => {
    if (aAvisar && tocada.current !== aAvisar.id) {
      tocada.current = aAvisar.id;
      tocarAvisoDeChamada();
    }
  }, [aAvisar]);

  const marcarVista = (pID: string): void => setVistas((pAtuais) => new Set(pAtuais).add(pID));

  // Abre a App de atendimento apertando "Atender a próxima"; já aberta, ela vem para a frente e o botão é apertado nela.
  const atender = (): void => {
    if (!aAvisar || !itemDoAtendimento || pendencias.emAtendimento)
      return;

    marcarVista(aAvisar.id);

    const abertas = getTabsByMenuItemID(itemDoAtendimento.id);

    if (abertas.length > 0)
      pedirAcao(abertas[0].id, COMANDO_DE_ATENDER);
    else
      openTab(itemDoAtendimento, undefined, undefined, { acao: COMANDO_DE_ATENDER });
  };

  const avisoDeChamada = aAvisar && (
    <XChamadaRecebida
      chamada={aAvisar} naFila={pendencias.naFila} emAtendimento={pendencias.emAtendimento}
      aoAtender={atender} aoDispensar={() => marcarVista(aAvisar.id)}
    />
  );

  if (!atende || (pendencias.naFila === 0 && pendencias.noQuadro === 0))
    return avisoDeChamada || null;

  const abrir = resolver(APP_DE_ATENDIMENTO);

  const partes = [
    pendencias.naFila > 0 ? plural(pendencias.naFila, 'chamada na fila', 'chamadas na fila') : '',
    pendencias.noQuadro > 0 ? plural(pendencias.noQuadro, 'chamado no quadro', 'chamados no quadro') : '',
  ].filter((pParte) => pParte.length > 0);

  // Fila é urgência (o prazo corre); quadro sozinho é pendência, e o tom do botão diz a diferença sem
  // depender só da cor: o texto já diz o que é cada número.
  const urgente = pendencias.naFila > 0;

  return (
    <>
    {avisoDeChamada}
    <button
      type="button" onClick={() => abrir?.()} data-testid="aviso-chamadas-suporte"
      title={'Abrir o Atendimento de suporte'}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-ui-sm font-semibold whitespace-nowrap ${
        urgente
          ? 'text-white bg-indigo-700 hover:bg-indigo-800'
          : 'text-brand-text-primary bg-brand-surface border border-border hover:bg-hover'}`}
    >
      <Headset className="w-4 h-4" aria-hidden="true" />
      <span role="status" aria-live="polite">{`Suporte: ${partes.join(' · ')}`}</span>
    </button>
    </>
  );
}
