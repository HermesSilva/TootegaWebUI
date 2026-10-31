/**
 * MODELO DE DOCUMENTO — a declaração do que um texto precisa ter (dono, 2026-10-28). É a régua sobre o modelo do
 * editor: seções obrigatórias em ordem, cada uma com a explicação que orienta quem escreve. Quem declara é o back,
 * como toda App (CE-19); o editor recebe a declaração, monta o esqueleto, mostra a explicação numa área não editável
 * no topo e aponta, na barra de status, o que ainda falta.
 *
 * Primeiro passo da camada: explicação + esqueleto + avaliação. Travar as seções e restringir o que cada uma aceita
 * entram em cima destes tipos.
 */

import { folhasDoDocumento, textoPuro } from './documento';
import type { Bloco, Documento } from './tipos';
import { inserirBlocosApos, paragrafoVazio } from '../editor/transacoes';

export interface SecaoDoModelo {
  /** O título da seção, exatamente como aparece no documento (`== Título`). */
  titulo: string;
  /** Nível do título (1 = `==`). */
  nivel: 1 | 2 | 3;
  /** O que escrever ali — a orientação que a área de explicação mostra. AsciiDoc inline (`*negrito*`, `` `mono` ``…). */
  explicacao: string;
  /** Exemplo curto do conteúdo esperado (opcional). AsciiDoc inline. */
  exemplo?: string;
  obrigatoria: boolean;
  /** Conteúdo inicial da seção no esqueleto (AsciiDoc). Ausente ⇒ parágrafo vazio. */
  esqueleto?: string;
}

export interface ModeloDeDocumento {
  /** Identificador estável (`item-de-trabalho`). */
  nome: string;
  /** Rótulo exibido ("Item de trabalho"). */
  rotulo: string;
  /** Para que serve o documento e quem o lê depois: o parágrafo de abertura da explicação. AsciiDoc inline. */
  explicacao: string;
  /** O título inicial do documento no esqueleto (`= …`). */
  tituloInicial?: string;
  secoes: SecaoDoModelo[];
}

/** O estado do documento diante do modelo. */
export interface AvaliacaoDoModelo {
  /** Seções obrigatórias que não existem no documento. */
  faltantes: SecaoDoModelo[];
  /** Seções obrigatórias que existem, mas não têm texto algum abaixo. */
  vazias: SecaoDoModelo[];
  /** Seções do modelo que estão fora da ordem declarada. */
  foraDeOrdem: SecaoDoModelo[];
  completo: boolean;
}

/** O AsciiDoc inicial de um documento do modelo: título e todas as seções, cada uma com um parágrafo. */
export function esqueletoDoModelo(pModelo: ModeloDeDocumento): string {
  const linhas: string[] = [];
  if (pModelo.tituloInicial)
    linhas.push(`= ${pModelo.tituloInicial}`, '');
  for (const secao of pModelo.secoes) {
    linhas.push(`${'='.repeat(secao.nivel + 1)} ${secao.titulo}`, '');
    linhas.push(secao.esqueleto ?? '', '');
  }
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n');
}

function titulosDeNivelAlto(pBlocos: Bloco[], pSaida: { titulo: string; nivel: number; indice: number; bloco: Bloco }[] = []): typeof pSaida {
  for (const bloco of pBlocos) {
    if (bloco.tipo === 'titulo')
      pSaida.push({ titulo: textoPuro(bloco.conteudo).trim(), nivel: bloco.nivel, indice: pSaida.length, bloco });
    if (bloco.tipo === 'admonicao' || bloco.tipo === 'container')
      titulosDeNivelAlto(bloco.filhos, pSaida);
  }
  return pSaida;
}

function normalizar(pTexto: string): string {
  return pTexto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Há texto (em folha ou código) entre o título da seção e o próximo título de nível igual ou maior? */
function secaoTemConteudo(pDocumento: Documento, pTituloID: string, pNivel: number): boolean {
  const folhas = folhasDoDocumento(pDocumento);
  const inicio = folhas.findIndex((pF) => pF.folha.id === pTituloID);
  if (inicio === -1)
    return false;
  for (let i = inicio + 1; i < folhas.length; i++) {
    const folha = folhas[i];
    if (folha.especie === 'titulo') {
      const titulo = folha.cadeia[folha.cadeia.length - 1];
      if (titulo.tipo === 'titulo' && titulo.nivel <= pNivel)
        return false;
      continue;
    }
    if (textoPuro(folha.folha.conteudo).trim().length > 0)
      return true;
  }
  // Bloco de código logo abaixo também conta como conteúdo.
  const tituloIndice = pDocumento.blocos.findIndex((pB) => pB.id === pTituloID);
  if (tituloIndice !== -1) {
    for (let i = tituloIndice + 1; i < pDocumento.blocos.length; i++) {
      const bloco = pDocumento.blocos[i];
      if (bloco.tipo === 'titulo' && bloco.nivel <= pNivel)
        break;
      if (bloco.tipo === 'codigo' && bloco.codigo.trim().length > 0)
        return true;
      if (bloco.tipo === 'tabela' || bloco.tipo === 'imagem')
        return true;
    }
  }
  return false;
}

/** Os títulos do documento que pertencem ao modelo: id do bloco → seção. São as folhas TRAVADAS no editor. */
export function secoesTravadas(pDocumento: Documento, pModelo: ModeloDeDocumento): Map<string, SecaoDoModelo> {
  const titulos = titulosDeNivelAlto(pDocumento.blocos);
  const saida = new Map<string, SecaoDoModelo>();
  for (const secao of pModelo.secoes) {
    const achado = titulos.find((pT) => normalizar(pT.titulo) === normalizar(secao.titulo) && pT.nivel === secao.nivel && !saida.has(pT.bloco.id));
    if (achado)
      saida.set(achado.bloco.id, secao);
  }
  return saida;
}

/**
 * A transação `pAntes → pDepois` fere o modelo? Devolve a mensagem da recusa (nomeando a seção) ou `null`. Uma seção
 * do modelo que existia antes precisa continuar existindo, com o mesmo texto, o mesmo nível e na mesma ordem.
 */
export function violacaoDoModelo(pAntes: Documento, pDepois: Documento, pModelo: ModeloDeDocumento): string | null {
  const antes = secoesTravadas(pAntes, pModelo);
  if (antes.size === 0)
    return null;
  const depois = secoesTravadas(pDepois, pModelo);
  const titulosDepois = titulosDeNivelAlto(pDepois.blocos);
  let ultimoIndice = -1;
  for (const [id, secao] of antes) {
    const bloco = titulosDepois.find((pT) => pT.bloco.id === id);
    if (!bloco || !depois.has(id))
      return `A seção «${secao.titulo}» é fixa do modelo ${pModelo.rotulo}: não pode ser alterada nem removida.`;
    if (bloco.indice < ultimoIndice)
      return `A seção «${secao.titulo}» é fixa do modelo ${pModelo.rotulo} e precisa ficar na ordem declarada.`;
    ultimoIndice = bloco.indice;
  }
  return null;
}

/**
 * Um título fixo do modelo não pode ficar colado ao próximo título fixo nem no fim do documento: como ele não se
 * edita, o autor não teria onde clicar para escrever a seção. Garante um parágrafo vazio nesses casos (o AsciiDoc
 * não tem como escrever um parágrafo vazio, então o esqueleto chega sem eles).
 */
export function garantirEspacoDasSecoes(pDocumento: Documento, pModelo: ModeloDeDocumento): Documento {
  const travadas = secoesTravadas(pDocumento, pModelo);
  if (travadas.size === 0)
    return pDocumento;
  let documento = pDocumento;
  for (let i = 0; i < documento.blocos.length; i++) {
    const bloco = documento.blocos[i];
    if (!travadas.has(bloco.id))
      continue;
    const proximo = documento.blocos[i + 1];
    if (!proximo || (proximo.tipo === 'titulo' && travadas.has(proximo.id)))
      documento = inserirBlocosApos(documento, bloco.id, [paragrafoVazio()]);
  }
  return documento;
}

export function avaliarModelo(pDocumento: Documento, pModelo: ModeloDeDocumento): AvaliacaoDoModelo {
  const titulos = titulosDeNivelAlto(pDocumento.blocos);
  const faltantes: SecaoDoModelo[] = [];
  const vazias: SecaoDoModelo[] = [];
  const foraDeOrdem: SecaoDoModelo[] = [];
  let ultimoIndice = -1;
  for (const secao of pModelo.secoes) {
    const achado = titulos.find((pT) => normalizar(pT.titulo) === normalizar(secao.titulo) && pT.nivel === secao.nivel);
    if (!achado) {
      if (secao.obrigatoria)
        faltantes.push(secao);
      continue;
    }
    if (achado.indice < ultimoIndice)
      foraDeOrdem.push(secao);
    ultimoIndice = Math.max(ultimoIndice, achado.indice);
    if (secao.obrigatoria && !secaoTemConteudo(pDocumento, achado.bloco.id, secao.nivel))
      vazias.push(secao);
  }
  return { faltantes, vazias, foraDeOrdem, completo: faltantes.length === 0 && vazias.length === 0 && foraDeOrdem.length === 0 };
}
