/**
 * Acesso a campo de DTO tolerante a casing.
 *
 * O modelo de aplicação identifica o campo pelo `fieldName` em PascalCase — o nome da
 * propriedade C# —, pois é por esse nome que o `XQueryEngine` reflete filtros e ordenação
 * no servidor. Porém a serialização de saída usa `JsonSerializerDefaults.Web` (camelCase),
 * de modo que a linha que chega ao front tem as chaves em camelCase (ex.: `nome`,
 * `estadoTexto`, `sySxInquilinoID`).
 *
 * Na escrita não há problema: o back desserializa case-insensitive. Na leitura, o front
 * precisa espelhar o mesmo comportamento — é o que esta função faz: casa o `fieldName` do
 * modelo com a chave serializada, independentemente da caixa.
 *
 * <b>E desce por CAMINHO ANINHADO</b> (dono, 2026-09-20). O `fieldName` do modelo pode nomear uma
 * propriedade dentro de outra — `Identificacao.Ambiente`, `Emitente.Documento`, `Totais.ValorNota` —
 * porque nem todo DTO é plano: o relatório de conferência da nota é um agregado de blocos, e
 * achatá-lo só para caber num acessador seria deformar o contrato por limitação da leitura. Sem a
 * travessia, TODO campo aninhado saía vazio na tela (o cabeçalho inteiro da conferência, observado
 * em 2026-09-20) — e vazio em silêncio, que é o pior modo de falhar: a tela desenha os rótulos
 * certos, com um traço em cada valor, e parece um problema de DADO.
 */
export function getFieldValue(
  pRow: Record<string, unknown> | null | undefined,
  pFieldName: string
): unknown {
  if (!pRow || !pFieldName)
    return undefined;

  const direto = valorNoNivel(pRow, pFieldName);
  if (direto !== undefined)
    return direto;

  // Sem chave plana correspondente: o nome pode ser um CAMINHO. A chave plana tem precedência de
  // propósito — um campo que realmente se chame "a.b" continua vencendo a travessia.
  if (!pFieldName.includes('.'))
    return undefined;

  let atual: unknown = pRow;
  for (const parte of pFieldName.split('.')) {
    if (atual === null || typeof atual !== 'object')
      return undefined;

    atual = valorNoNivel(atual as Record<string, unknown>, parte);
    if (atual === undefined)
      return undefined;
  }

  return atual;
}

/** Um nível só: a chave exata, ou a que difere apenas na caixa. */
function valorNoNivel(pRow: Record<string, unknown>, pChave: string): unknown {
  // Caminho rápido: a chave existe exatamente como pedida (ex.: valor já gravado no form em
  // PascalCase depois de uma edição do usuário).
  if (Object.prototype.hasOwnProperty.call(pRow, pChave))
    return pRow[pChave];

  const alvo = pChave.toLowerCase();
  for (const chave in pRow) {
    if (chave.toLowerCase() === alvo)
      return pRow[chave];
  }

  return undefined;
}

/**
 * Colapsa chaves que diferem SÓ na caixa, ficando com a EDITADA.
 *
 * O formulário carrega o registro do servidor em camelCase (`token`, `ativo`) e grava a alteração do
 * usuário sob o `fieldName` do editor, em PascalCase (`Token`, `Ativo`). Sem colapsar, o corpo do
 * PUT leva a mesma propriedade duas vezes — o valor antigo e o novo — e o servidor fica com o que a
 * ordem de serialização entregar por último. Funciona por acaso, e um dia deixa de funcionar.
 *
 * A chave que sobrevive é a do EDITOR (`pCamposDeEditor`), porque é o nome que o modelo declara; o
 * valor que sobrevive é o do usuário. Campos que o formulário só carregou (sem editor) passam intactos.
 */
export function colapsarChavesDuplicadas(
  pDados: Record<string, unknown>,
  pCamposDeEditor: Map<string, number> | Set<string>
): Record<string, unknown> {
  const nomesDeEditor = new Map<string, string>();
  for (const nome of (pCamposDeEditor instanceof Map ? pCamposDeEditor.keys() : pCamposDeEditor))
    nomesDeEditor.set(nome.toLowerCase(), nome);

  const resultado: Record<string, unknown> = {};
  const jaResolvido = new Set<string>();

  for (const [chave, valor] of Object.entries(pDados)) {
    const minuscula = chave.toLowerCase();
    const nomeDoEditor = nomesDeEditor.get(minuscula);

    // Campo sem editor (só carregado): passa como veio.
    if (!nomeDoEditor) {
      resultado[chave] = valor;
      continue;
    }

    // Campo com editor: a chave final é a do editor. O valor da chave EXATA do editor é o que o
    // usuário informou e vence; a variante em outra caixa só entra se a editada não existir.
    if (jaResolvido.has(minuscula))
      continue;

    const editado = Object.prototype.hasOwnProperty.call(pDados, nomeDoEditor)
      ? pDados[nomeDoEditor]
      : valor;

    resultado[nomeDoEditor] = editado;
    jaResolvido.add(minuscula);
  }

  return resultado;
}
