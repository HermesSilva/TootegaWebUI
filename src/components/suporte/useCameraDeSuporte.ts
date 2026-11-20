/**
 * useCameraDeSuporte — a câmera numa chamada de suporte, igual dos dois lados (quem chamou e quem atende).
 *
 * A câmera começa DESLIGADA e cada um a liga por um botão (dono, 2026-11-19). Ligar pede a câmera ao
 * navegador naquele clique; desligar para a câmera de verdade (a luz dela apaga) e avisa a outra ponta.
 * Nada disso refaz a ligação: a faixa de câmera foi reservada na negociação (`ConexaoDeMidia`).
 *
 * O hook guarda as mídias fora do ciclo de render e entrega:
 *   - o estado da câmera local (ligada, ligando, a falha em palavras) e o da outra ponta;
 *   - `faixa()`, para quem cria uma ligação nova entregar a câmera que já está ligada;
 *   - os dois retornos que a `ConexaoDeMidia` chama (`aoReceberCamera`, `aoMudarCameraRemota`);
 *   - as referências dos dois elementos de vídeo, que recebem a mídia quando aparecem na tela.
 *
 * Todas as funções são estáveis: podem entrar em efeito sem reiniciá-lo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { motivoDaFalhaDaCamera, pararMidia, pedirCamera, type ConexaoDeMidia } from '@core/lib/suporte/conexaoDeMidia';

export interface CameraDeSuporte {
  ligada: boolean;
  ligando: boolean;
  /** Por que a câmera não ligou; vazio quando não houve falha. */
  falha: string;
  /** A outra ponta está com a câmera ligada. */
  remotaLigada: boolean;
  alternar: () => Promise<void>;
  /** A faixa da câmera local, para entregar a uma ligação nova; `null` com a câmera desligada. */
  faixa: () => MediaStreamTrack | null;
  aoReceberCamera: (pMidia: MediaStream) => void;
  aoMudarCameraRemota: (pLigada: boolean) => void;
  /** A ligação caiu ou foi refeita: a câmera da outra ponta some até ela avisar de novo. */
  esquecerRemota: () => void;
  /** Desliga a câmera local, sem avisar ninguém (a chamada acabou). */
  desligar: () => void;
  refLocal: (pElemento: HTMLVideoElement | null) => void;
  refRemota: (pElemento: HTMLVideoElement | null) => void;
}

function ligarVideo(pElemento: HTMLVideoElement | null, pMidia: MediaStream | null): void {
  if (pElemento && pElemento.srcObject !== pMidia)
    pElemento.srcObject = pMidia;
}

/**
 * @param pConexao Devolve a ligação corrente (ou `null` enquanto não há): é nela que a câmera entra e sai.
 */
export function useCameraDeSuporte(pConexao: () => ConexaoDeMidia | null): CameraDeSuporte {
  const [ligada, setLigada] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [falha, setFalha] = useState('');
  const [remotaLigada, setRemotaLigada] = useState(false);

  const local = useRef<MediaStream | null>(null);
  const remota = useRef<MediaStream | null>(null);
  const elementoLocal = useRef<HTMLVideoElement | null>(null);
  const elementoRemoto = useRef<HTMLVideoElement | null>(null);
  const conexao = useRef(pConexao);
  conexao.current = pConexao;

  const desligar = useCallback(() => {
    pararMidia(local.current);
    local.current = null;
    ligarVideo(elementoLocal.current, null);
    setLigada(false);
    setLigando(false);
    setFalha('');
  }, []);

  const alternar = useCallback(async () => {
    if (local.current) {
      desligar();
      await conexao.current()?.definirCamera(null);
      return;
    }

    setLigando(true);
    setFalha('');

    try {
      const midia = await pedirCamera();
      const faixa = midia.getVideoTracks()[0] ?? null;

      // A câmera desconectada no meio da chamada encerra a faixa: a tela volta a mostrar a câmera desligada.
      faixa?.addEventListener('ended', () => {
        if (local.current !== midia)
          return;

        desligar();
        void conexao.current()?.definirCamera(null);
      });

      local.current = midia;
      ligarVideo(elementoLocal.current, midia);
      setLigada(true);

      await conexao.current()?.definirCamera(faixa);
    } catch (pErro) {
      setFalha(motivoDaFalhaDaCamera(pErro));
    } finally {
      setLigando(false);
    }
  }, [desligar]);

  const faixa = useCallback(() => local.current?.getVideoTracks()[0] ?? null, []);

  const aoReceberCamera = useCallback((pMidia: MediaStream) => {
    remota.current = pMidia;
    ligarVideo(elementoRemoto.current, pMidia);
  }, []);

  const aoMudarCameraRemota = useCallback((pLigada: boolean) => setRemotaLigada(pLigada), []);

  const esquecerRemota = useCallback(() => {
    remota.current = null;
    ligarVideo(elementoRemoto.current, null);
    setRemotaLigada(false);
  }, []);

  const refLocal = useCallback((pElemento: HTMLVideoElement | null) => {
    elementoLocal.current = pElemento;
    ligarVideo(pElemento, local.current);
  }, []);

  const refRemota = useCallback((pElemento: HTMLVideoElement | null) => {
    elementoRemoto.current = pElemento;
    ligarVideo(pElemento, remota.current);
  }, []);

  // Saiu da tela com a câmera ligada: ela é solta, e a luz da câmera apaga.
  useEffect(() => () => pararMidia(local.current), []);

  return {
    ligada, ligando, falha, remotaLigada,
    alternar, faixa, aoReceberCamera, aoMudarCameraRemota, esquecerRemota, desligar, refLocal, refRemota,
  };
}
