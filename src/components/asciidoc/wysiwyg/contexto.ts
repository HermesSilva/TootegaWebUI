/**
 * O que os blocos renderizados precisam da vista: as ações sobre o modelo (atualizar, remover, marcar tarefa,
 * selecionar bloco), o estado de seleção de bloco e, desde 2026-10-31, como alcançar o mundo fora do documento
 * (resolver o endereço de uma imagem; abrir um include, uma referência ou um link). Vai por contexto para o render
 * dos blocos ficar memoizável.
 */

import { createContext, useContext } from 'react';
import type { Bloco } from '../modelo/tipos';
import type { SecaoDoModelo } from '../modelo/modeloDeDocumento';

/** Tipo de recurso que o documento referencia e o hospedeiro resolve ou abre. */
export type TipoDeRecurso = 'imagem' | 'video' | 'audio' | 'inclusao' | 'referencia' | 'link';

/**
 * Converte o alvo escrito no documento (`imagens/figura.png`) no endereço que o navegador carrega. O padrão
 * devolve o alvo como está; quem embute o editor fora da web (VS Code) dá o endereço seguro da pasta do documento.
 * Devolver `''` significa "não carregar" (o bloco mostra o marcador com o alvo).
 */
export type ResolvedorDeRecurso = (pAlvo: string, pTipo: TipoDeRecurso) => string;

/** Chamado quando o usuário pede para abrir um recurso (botão do include, Ctrl+clique num link ou referência). */
export type AcionadorDeReferencia = (pAlvo: string, pTipo: TipoDeRecurso) => void;

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
  resolverRecurso: ResolvedorDeRecurso;
  /** `undefined` = ninguém abre recursos (o botão do include não aparece, links não reagem ao Ctrl+clique). */
  acionarReferencia?: AcionadorDeReferencia;
  /** O valor de `:stem:` no cabeçalho (`''` quando declarado vazio; `undefined` sem ele) — decide a notação de `stem`. */
  atributoStem?: string;
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
  resolverRecurso: (pAlvo) => pAlvo,
});

export function useVista(): AcoesDaVista {
  return useContext(ContextoDaVista);
}
