/**
 * Versão do MODELO das Apps — vinda do BACK, não do build do front.
 *
 * A App é definida no back (CE-19): o front é genérico e não tem ligação direta com as Apps. Logo,
 * quem sabe que o modelo de uma App mudou é o back, e é o back que dita a versão do cache local do
 * modelo (appModelCache). O back expõe essa versão em `GET /api/sys/application/version` — a versão
 * do assembly (1.0.0.<BuildNumber>), que incrementa a cada build do back, exatamente quando uma App
 * pode ter mudado.
 *
 * Aqui: a versão é guardada em `localStorage` (chave abaixo) e mantida numa variável de módulo para
 * uso SÍNCRONO (o appModelCache precisa da chave no primeiro render). No boot, `sincronizarVersaoDoModelo`
 * busca a do back; se mudou, limpa o cache de modelos (para o front rebuscar as Apps novas) e grava a
 * nova. Best-effort: falha de rede/storage nunca derruba a tela — segue com a última versão conhecida.
 */

import { api } from './api';

const STORAGE_KEY = 'Tootega-appmodel-version';
const PREFIXO_MODELO = 'Tootega-appmodel-';   // as entradas de modelo são Tootega-appmodel-<versao>-<id>

/** Última versão conhecida do modelo (do back). Vazio até o primeiro sincronismo. */
let _versaoAtual = lerDoStorage();

function lerDoStorage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Versão corrente do modelo das Apps, para compor a chave do cache. Síncrona. */
export function versaoDoModelo(): string {
  // Relê do storage se a memória está vazia (ainda não sincronizou, ou o storage foi setado depois do
  // import — caso dos testes). Mantém a leitura síncrona e sempre coerente com o que está gravado.
  if (!_versaoAtual)
    _versaoAtual = lerDoStorage();
  return _versaoAtual;
}

/**
 * Busca a versão do modelo no back e, se ela mudou desde a guardada, LIMPA o cache local de modelos
 * (para o front rebuscar as Apps atualizadas) e grava a nova. Chamado no boot, antes de abrir Apps.
 * Devolve true se a versão mudou (o chamador pode invalidar caches em memória, se quiser).
 */
export async function sincronizarVersaoDoModelo(): Promise<boolean> {
  let doBack = '';
  try {
    const r = await api.get<{ version: string }>('/sys/application/version');
    doBack = (r?.version ?? '').trim();
  } catch {
    return false;   // back indisponível — segue com a última versão conhecida.
  }

  if (!doBack || doBack === _versaoAtual)
    return false;

  limparCacheDeModelos();
  _versaoAtual = doBack;
  try {
    localStorage.setItem(STORAGE_KEY, doBack);
  } catch {
    /* storage indisponível — best-effort */
  }
  return true;
}

/**
 * O RECARREGAMENTO FORÇADO (Ctrl+F5 / Cmd+Shift+R) invalida o cache de modelos (dono, 2026-09-17).
 *
 * O gesto já significa "esqueça o que você guardou" para todo o resto da página — mas o modelo das
 * Apps vive no `localStorage`, que o navegador NÃO limpa, e por isso sobrevivia ao Ctrl+F5. O
 * sintoma é caro de diagnosticar: o back novo está no ar, a App mudou, e a tela continua a antiga
 * sem nenhum erro à vista. Aconteceu com o botão "Conferir nota" do pedido.
 *
 * `reload` distingue F5 de Ctrl+F5? Não — a API não expõe essa diferença. O que se usa é o
 * `PerformanceNavigationTiming`: no recarregamento forçado o navegador ignora o cache HTTP, e a
 * entrada de navegação vem com `type: 'reload'`. Limpar o modelo em QUALQUER reload é aceitável e
 * até desejável: custa uma busca ao back — a mesma que o boot já faz — e elimina uma classe inteira
 * de "está diferente na minha máquina".
 */
export function invalidarModeloEmRecarregamento(): void {
  try {
    const navegacao = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navegacao?.type !== 'reload')
      return;

    limparCacheDeModelos();
    _versaoAtual = '';
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort: nenhuma falha aqui pode derrubar o boot */
  }
}

/** Apaga toda entrada de modelo de App do localStorage (qualquer versão). */
function limparCacheDeModelos(): void {
  try {
    const remover: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXO_MODELO) && k !== STORAGE_KEY)
        remover.push(k);
    }
    for (const k of remover)
      localStorage.removeItem(k);
  } catch {
    /* best-effort */
  }
}
