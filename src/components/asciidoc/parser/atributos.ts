/**
 * Lista de atributos do AsciiDoc (`[a, b, nome=valor, outro="com, vírgula"]`): posicionais e nomeados, com aspas.
 */

export interface AtributosLidos {
  posicionais: string[];
  nomeados: Record<string, string>;
  /** Papéis vindos do atalho `.papel` no primeiro posicional (`[#id.papel%opcao]`). */
  papeis: string[];
  /** Id vindo do atalho `#id`. */
  id?: string;
  /** Opções vindas do atalho `%opcao` ou de `options=`/`opts=`. */
  opcoes: string[];
}

function dividirPorVirgula(pTexto: string): string[] {
  const partes: string[] = [];
  let atual = '';
  let aspas: string | null = null;
  for (let i = 0; i < pTexto.length; i++) {
    const c = pTexto[i];
    if (aspas) {
      if (c === aspas)
        aspas = null;
      else
        atual += c;
      continue;
    }
    if (c === '"' || c === "'") {
      // Aspas só abrem no começo de um valor (depois de `,` ou `=`); no meio do texto são literais.
      const anterior = atual.trimEnd();
      if (anterior === '' || anterior.endsWith('=')) {
        aspas = c;
        continue;
      }
    }
    if (c === ',') {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  partes.push(atual);
  return partes;
}

export function lerAtributos(pTexto: string): AtributosLidos {
  const lidos: AtributosLidos = { posicionais: [], nomeados: {}, papeis: [], opcoes: [] };
  if (pTexto.trim() === '')
    return lidos;
  const partes = dividirPorVirgula(pTexto);
  partes.forEach((pParte, pIndice) => {
    const parte = pParte.trim();
    const igual = parte.indexOf('=');
    if (igual > 0 && /^[A-Za-z0-9_-]+$/.test(parte.slice(0, igual))) {
      const nome = parte.slice(0, igual).trim();
      const valor = parte.slice(igual + 1).trim();
      lidos.nomeados[nome] = valor;
      if (nome === 'options' || nome === 'opts')
        lidos.opcoes.push(...valor.split(',').map((pO) => pO.trim()).filter(Boolean));
      if (nome === 'role')
        lidos.papeis.push(...valor.split(/\s+/).filter(Boolean));
      if (nome === 'id')
        lidos.id = valor;
      return;
    }
    if (pIndice === 0 && /^[#.%]/.test(parte)) {
      // Atalho: `#id.papel%opcao`, em qualquer ordem e quantidade.
      const pedacos = parte.match(/[#.%][^#.%]+/g) ?? [];
      for (const pedaco of pedacos) {
        if (pedaco.startsWith('#'))
          lidos.id = pedaco.slice(1);
        else if (pedaco.startsWith('.'))
          lidos.papeis.push(pedaco.slice(1));
        else
          lidos.opcoes.push(pedaco.slice(1));
      }
      lidos.posicionais.push('');
      return;
    }
    lidos.posicionais.push(parte);
  });
  return lidos;
}

/** Monta a lista de volta (`nome=valor`, com aspas quando o valor tem vírgula). */
export function escreverAtributos(pPosicionais: string[], pNomeados: Record<string, string>): string {
  const partes: string[] = [];
  const posicionais = [...pPosicionais];
  while (posicionais.length > 0 && posicionais[posicionais.length - 1] === '')
    posicionais.pop();
  partes.push(...posicionais);
  for (const [nome, valor] of Object.entries(pNomeados))
    partes.push(/[,"]/.test(valor) ? `${nome}="${valor.replace(/"/g, '\\"')}"` : `${nome}=${valor}`);
  return partes.join(',');
}
