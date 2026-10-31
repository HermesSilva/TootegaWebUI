/**
 * O que os blocos renderizados precisam da vista: as ações sobre o modelo (atualizar, remover, marcar tarefa,
 * selecionar bloco) e o estado de seleção de bloco. Vai por contexto para o render dos blocos ficar memoizável.
 */

import { createContext, useContext } from 'react';
import type { Bloco } from '../modelo/tipos';
import type { SecaoDoModelo } from '../modelo/modeloDeDocumento';

export interface AcoesDaVista {
  atualizarBloco: (pID: string, pMudanca: Partial<Bloco>) => void;
  removerBloco: (pID: string) => void;
  alternarTarefa: (pItemID: string) => void;
  selecionarBloco: (pID: string | null) => void;
  /** Abre o diálogo de edição do bloco (imagem, link…), quando o editor o oferece. */
  editarBloco: (pID: string) => void;
  somenteLeitura: boolean;
  blocoSelecionado: string | null;
  /** A versão de cada folha (incrementada quando relemos o DOM, para o React remontá-la). */
  versaoDaFolha: (pID: string) => number;
  /** Folha fixa do modelo de documento (título de seção): devolve a seção, ou `null` quando a folha é livre. */
  folhaTravada: (pID: string) => SecaoDoModelo | null;
}

export const ContextoDaVista = createContext<AcoesDaVista>({
  atualizarBloco: () => undefined,
  removerBloco: () => undefined,
  alternarTarefa: () => undefined,
  selecionarBloco: () => undefined,
  editarBloco: () => undefined,
  somenteLeitura: false,
  blocoSelecionado: null,
  versaoDaFolha: () => 0,
  folhaTravada: () => null,
});

export function useVista(): AcoesDaVista {
  return useContext(ContextoDaVista);
}
