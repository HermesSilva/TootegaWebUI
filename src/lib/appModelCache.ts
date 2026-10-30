/**
 * Cache do MODELO (JSON) das Apps no navegador — estável até a versão do build mudar.
 *
 * O modelo de uma App (CE-19: estrutura, campos, rótulos, endpoints — tudo declarado no back) não
 * muda entre deploys: é código, e código só muda com uma nova versão do front. Logo, buscá-lo a
 * cada abertura de tela é ida ao servidor por algo que já se sabe. Este cache o guarda em
 * `localStorage`, servindo recargas e reaberturas de aba da memória local, sem tocar no back até a
 * versão mudar.
 *
 * **A versão é o buster, e é parte da chave.** Cada entrada mora sob `Tootega-appmodel-<versão>-<id>`.
 * Ao publicar uma versão nova:
 *   1. o `useVersionCheck` recarrega a aba e chama `clearStaleCache`, que apaga toda chave `Tootega-*`
 *      (o prefixo aqui garante que ESTE cache entra nessa varredura);
 *   2. mesmo que aquela limpeza falhe (storage negado, aba que não passou pelo guarda), uma entrada
 *      de versão ANTERIOR nunca é lida — a chave da versão corrente simplesmente não existe, e a
 *      leitura devolve nulo, forçando a busca no back.
 * `descartarVersoesAntigas` é o cinto-e-suspensório: na primeira gravação após um deploy, apaga as
 * entradas de modelo de qualquer versão que não seja a corrente, para o storage não crescer sem fim.
 *
 * Best-effort em tudo: storage cheio, indisponível ou em modo privado nunca derruba a tela — o cache
 * some e a busca no back assume, exatamente como sem cache.
 */

// A versão que carimba o cache vem do BACK (a App é definida no back, CE-19), não do build do front —
// ver appModelVersion. O back a incrementa a cada build, exatamente quando uma App pode ter mudado.
import { versaoDoModelo } from './appModelVersion';

/** Prefixo comum a toda entrada de modelo — é o que o `clearStaleCache` do useVersionCheck varre. */
const PREFIXO = 'Tootega-appmodel-';

/** Prefixo das entradas da versão CORRENTE. Fora dele, é resíduo de versão antiga. */
function prefixoDaVersao(pVersao: string): string {
  return `${PREFIXO}${pVersao}-`;
}

/** Chave de uma App (por id ou por nome — o chamador passa o identificador que usou na rota). */
function chave(pIdentificador: string): string {
  return `${prefixoDaVersao(versaoDoModelo())}${pIdentificador}`;
}

/**
 * Lê o modelo cacheado de uma App para a versão corrente. Devolve `null` quando não há entrada
 * (primeira visita nesta versão) ou quando o storage está indisponível/corrompido.
 */
export function lerModeloApp<T>(pIdentificador: string): T | null {
  try {
    const bruto = localStorage.getItem(chave(pIdentificador));
    if (!bruto)
      return null;
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

/**
 * Grava o modelo de uma App sob a versão corrente e, de passagem, descarta as entradas de modelo de
 * versões anteriores (mantém só a corrente). Best-effort: falha de storage é silenciosa.
 */
export function gravarModeloApp<T>(pIdentificador: string, pModelo: T): void {
  try {
    descartarVersoesAntigas();
    localStorage.setItem(chave(pIdentificador), JSON.stringify(pModelo));
  } catch {
    /* storage cheio/indisponível — o cache é best-effort; a busca no back continua servindo */
  }
}

/**
 * Apaga toda entrada de modelo de App que NÃO seja da versão corrente. Chamada na gravação, para que
 * um deploy que a limpeza global do useVersionCheck não tenha alcançado não deixe lixo acumulando.
 */
export function descartarVersoesAntigas(): void {
  try {
    const daVersao = prefixoDaVersao(versaoDoModelo());
    const remover: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXO) && !k.startsWith(daVersao))
        remover.push(k);
    }

    remover.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* sem storage, não há o que descartar */
  }
}
