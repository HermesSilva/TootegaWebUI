/**
 * TEXTOS do editor AsciiDoc (2026-10-31). O motor continua monolíngue — este é o texto pt-BR que sempre esteve nos
 * componentes, só que num lugar só — e quem embute o editor fora de um SaaS (a extensão do VS Code) pode INJETAR
 * outro catálogo pela prop `textos`. Não é chave de tradução: o padrão é o texto pronto, em português, e nada aqui
 * chega cru à tela.
 *
 * `{0}`, `{1}`… são os argumentos de `f()`.
 */

import { createContext, useContext } from 'react';

export interface TextosDoEditorAsciiDoc {
  barra: {
    rotulo: string;
    historico: string;
    desfazer: string;
    refazer: string;
    tipoDeBloco: string;
    bloco: string;
    blocos: { paragrafo: string; titulo1: string; titulo2: string; titulo3: string; titulo4: string; titulo5: string; literal: string; citacao: string; codigo: string };
    literalDetalhe: string;
    citacaoDetalhe: string;
    codigoDetalhe: string;
    formatacao: string;
    negrito: string;
    italico: string;
    mono: string;
    realce: string;
    sublinhado: string;
    tachado: string;
    sobrescrito: string;
    subscrito: string;
    limparFormatacao: string;
    limparFormatacaoDica: string;
    listas: string;
    listaMarcadores: string;
    listaNumerada: string;
    listaTarefas: string;
    listaDescricao: string;
    listaDescricaoDica: string;
    aumentarRecuo: string;
    diminuirRecuo: string;
    inserir: string;
    link: string;
    imagem: string;
    tabela: string;
    blocoDeCodigo: string;
    admonicao: string;
    inserirAdmonicao: string;
    mais: string;
    inserirOutros: string;
    itens: {
      exemplo: string;
      barraLateral: string;
      citacao: string;
      notaDeRodape: string;
      referencia: string;
      ancora: string;
      tecla: string;
      quebraDeLinha: string;
      quebraTematica: string;
      quebraDePagina: string;
      sumario: string;
      atributo: string;
      comentario: string;
      formula: string;
    };
    tabelaGrupo: string;
    linhaAcima: string;
    linhaAbaixo: string;
    colunaEsquerda: string;
    colunaDireita: string;
    removerLinha: string;
    removerColuna: string;
    alinharEsquerda: string;
    centralizarColuna: string;
    alinharDireita: string;
    valeColunaInteira: string;
    primeiraLinhaCabecalho: string;
    removerTabela: string;
    ferramentas: string;
    localizarESubstituir: string;
    noModoCodigo: string;
    estrutura: string;
    estruturaDica: string;
    modo: string;
    visual: string;
    visualDica: string;
    codigo: string;
    codigoDica: string;
    dividido: string;
    divididoDica: string;
  };
  admonicoes: { NOTE: string; TIP: string; IMPORTANT: string; WARNING: string; CAUTION: string };
  dialogo: {
    cancelar: string;
    inserir: string;
    aplicar: string;
    titulos: { link: string; imagem: string; editarImagem: string; tabela: string; referencia: string; notaDeRodape: string; atributo: string; tecla: string; ancora: string; formula: string };
    semPosicao: string;
    endereco: string;
    enderecoPlaceholder: string;
    textoVazioUsaEndereco: string;
    caminhoOuURL: string;
    imagemPlaceholder: string;
    textoAlternativo: string;
    largura: string;
    altura: string;
    px: string;
    linhas: string;
    colunas: string;
    primeiraLinha: string;
    eCabecalho: string;
    eDado: string;
    idDoDestino: string;
    idDoDestinoPlaceholder: string;
    textoVazioUsaTitulo: string;
    textoDaNota: string;
    idParaReutilizar: string;
    nome: string;
    nomePlaceholder: string;
    valor: string;
    elemento: string;
    teclaKbd: string;
    botaoBtn: string;
    menuMenu: string;
    menuRaiz: string;
    menuRaizPlaceholder: string;
    itensSepareCom: string;
    texto: string;
    menuPlaceholder: string;
    botaoPlaceholder: string;
    teclaPlaceholder: string;
    id: string;
    ancoraPlaceholder: string;
    rotuloOpcional: string;
    notacao: string;
    notacaoStem: string;
    notacaoLatex: string;
    notacaoAsciimath: string;
    fonteDaFormula: string;
    formulaPlaceholder: string;
    forma: string;
    formaInline: string;
    formaBloco: string;
    previa: string;
    erros: {
      informeEndereco: string;
      informeImagem: string;
      larguraNumero: string;
      alturaNumero: string;
      linhasEntre: string;
      colunasEntre: string;
      informeIdDestino: string;
      escrevaNota: string;
      informeNomeAtributo: string;
      nomeAtributoFormato: string;
      informeItensMenu: string;
      informeTexto: string;
      informeMenuRaiz: string;
      informeIdAncora: string;
      idAncoraFormato: string;
      informeFormula: string;
    };
  };
  codigo: {
    localizar: string;
    localizarNoCodigo: string;
    nenhumaOcorrencia: string;
    nDeTotal: string;
    diferenciarMaiusculas: string;
    diferenciarMaiusculasDica: string;
    palavraInteira: string;
    palavraInteiraDica: string;
    expressaoRegular: string;
    expressaoRegularDica: string;
    ocorrenciaAnterior: string;
    proximaOcorrencia: string;
    substituir: string;
    substituirDica: string;
    fecharBusca: string;
    substituirPor: string;
    substituirTodas: string;
    irParaLinha: string;
    irParaLinhaPlaceholder: string;
    numeroDaLinha: string;
    ir: string;
    fechar: string;
  };
  vista: {
    tituloDoDocumento: string;
    autores: string;
    revisaoPlaceholder: string;
    revisao: string;
    atributosPlaceholder: string;
    atributosRotulo: string;
    conteudoDoDocumento: string;
    escrevaAqui: string;
    tituloDeNivel: string;
    item: string;
    termo: string;
    explicacaoDaChamada: string;
    literal: string;
    listagem: string;
    codigo: string;
    linguagemDoCodigo: string;
    semLinguagem: string;
    emLinguagem: string;
    atributoDoDocumento: string;
    nomeDoAtributo: string;
    valorDoAtributo: string;
    video: string;
    audio: string;
    quebraDePagina: string;
    sumarioGerado: string;
    comentario: string;
    comentarioBloco: string;
    passagem: string;
    asciidocComoVeio: string;
    tarefaConcluida: string;
    tarefaPendente: string;
    inclusao: string;
    abrirArquivoIncluido: string;
    imagemNaoCarregada: string;
    atomoImagem: string;
    atomoNota: string;
    dicaImagem: string;
    dicaReferencia: string;
    dicaAncora: string;
    dicaNota: string;
    dicaTecla: string;
    dicaBotao: string;
    dicaMenu: string;
    dicaAtributo: string;
    dicaPassagem: string;
    dicaBruto: string;
    formula: string;
    notacaoDaFormula: string;
    notacoes: { stem: string; latexmath: string; asciimath: string };
    dicaFormula: string;
    formulaVazia: string;
    avisosDaFormula: string;
    abrirLinkDica: string;
    secaoObrigatoria: string;
    secaoOpcional: string;
    exemplo: string;
    tituloNaoSeEdita: string;
  };
  modelo: {
    rotulo: string;
    completo: string;
    pendencias: string;
    falta: string;
    vazia: string;
    ordem: string;
    ok: string;
    opcional: string;
    exemplo: string;
  };
  editor: {
    rotulo: string;
    estrutura: string;
    estruturaDoDocumento: string;
    semTitulos: string;
    semTexto: string;
    divisorRotulo: string;
    divisorDica: string;
    codigoDoDocumento: string;
    visual: string;
    codigo: string;
    dividido: string;
    palavras: string;
    caracteres: string;
    blocos: string;
    linhaColuna: string;
    codigoSomenteLeituraModelo: string;
    modeloCompleto: string;
    modeloPendencias: string;
    pendenciasN: string;
    falta: string;
    semTextoNaSecao: string;
    foraDaOrdem: string;
    avisoNaLinha: string;
    avisosDoParser: string;
    linhaN: string;
    somenteLeitura: string;
  };
}

export const TEXTOS_PADRAO: TextosDoEditorAsciiDoc = {
  barra: {
    rotulo: 'Ferramentas do editor AsciiDoc',
    historico: 'Histórico',
    desfazer: 'Desfazer',
    refazer: 'Refazer',
    tipoDeBloco: 'Tipo de bloco',
    bloco: 'Bloco',
    blocos: { paragrafo: 'Parágrafo', titulo1: 'Título 1', titulo2: 'Título 2', titulo3: 'Título 3', titulo4: 'Título 4', titulo5: 'Título 5', literal: 'Literal', citacao: 'Citação', codigo: 'Código' },
    literalDetalhe: 'Texto como está, em fonte fixa',
    citacaoDetalhe: 'Bloco de citação',
    codigoDetalhe: 'Vira bloco de código',
    formatacao: 'Formatação',
    negrito: 'Negrito',
    italico: 'Itálico',
    mono: 'Monoespaçado',
    realce: 'Realce',
    sublinhado: 'Sublinhado',
    tachado: 'Tachado',
    sobrescrito: 'Sobrescrito',
    subscrito: 'Subscrito',
    limparFormatacao: 'Limpar formatação',
    limparFormatacaoDica: 'Tira todas as marcas do trecho selecionado',
    listas: 'Listas',
    listaMarcadores: 'Lista com marcadores',
    listaNumerada: 'Lista numerada',
    listaTarefas: 'Lista de tarefas',
    listaDescricao: 'Lista de descrição',
    listaDescricaoDica: 'Termo e definição',
    aumentarRecuo: 'Aumentar recuo',
    diminuirRecuo: 'Diminuir recuo',
    inserir: 'Inserir',
    link: 'Link',
    imagem: 'Imagem',
    tabela: 'Tabela',
    blocoDeCodigo: 'Bloco de código',
    admonicao: 'Admonição',
    inserirAdmonicao: 'Inserir admonição',
    mais: 'Mais',
    inserirOutros: 'Inserir outros elementos',
    itens: {
      exemplo: 'Bloco de exemplo',
      barraLateral: 'Barra lateral',
      citacao: 'Citação',
      notaDeRodape: 'Nota de rodapé',
      referencia: 'Referência cruzada',
      ancora: 'Âncora',
      tecla: 'Tecla, botão ou menu',
      quebraDeLinha: 'Quebra de linha',
      quebraTematica: 'Quebra temática',
      quebraDePagina: 'Quebra de página',
      sumario: 'Sumário',
      atributo: 'Atributo do documento',
      comentario: 'Comentário',
      formula: 'Fórmula (STEM)',
    },
    tabelaGrupo: 'Tabela',
    linhaAcima: 'Linha acima',
    linhaAbaixo: 'Linha abaixo',
    colunaEsquerda: 'Coluna à esquerda',
    colunaDireita: 'Coluna à direita',
    removerLinha: 'Remover linha',
    removerColuna: 'Remover coluna',
    alinharEsquerda: 'Alinhar coluna à esquerda',
    centralizarColuna: 'Centralizar coluna',
    alinharDireita: 'Alinhar coluna à direita',
    valeColunaInteira: 'Vale para a coluna inteira',
    primeiraLinhaCabecalho: 'Primeira linha é cabeçalho',
    removerTabela: 'Remover tabela',
    ferramentas: 'Ferramentas',
    localizarESubstituir: 'Localizar e substituir',
    noModoCodigo: 'No modo Código',
    estrutura: 'Estrutura',
    estruturaDica: 'Painel com os títulos do documento',
    modo: 'Modo',
    visual: 'Visual',
    visualDica: 'Edição WYSIWYG',
    codigo: 'Código',
    codigoDica: 'O AsciiDoc com realce',
    dividido: 'Dividido',
    divididoDica: 'Código à esquerda e WYSIWYG editável à direita, sobre o mesmo documento',
  },
  admonicoes: { NOTE: 'Nota', TIP: 'Dica', IMPORTANT: 'Importante', WARNING: 'Atenção', CAUTION: 'Cuidado' },
  dialogo: {
    cancelar: 'Cancelar',
    inserir: 'Inserir',
    aplicar: 'Aplicar',
    titulos: { link: 'Link', imagem: 'Imagem', editarImagem: 'Editar imagem', tabela: 'Nova tabela', referencia: 'Referência cruzada', notaDeRodape: 'Nota de rodapé', atributo: 'Atributo do documento', tecla: 'Tecla, botão ou menu', ancora: 'Âncora', formula: 'Fórmula' },
    semPosicao: 'Coloque o cursor no texto antes de inserir: o diálogo não sabe onde o elemento entra.',
    endereco: 'Endereço',
    enderecoPlaceholder: 'https://… ou mailto:…',
    textoVazioUsaEndereco: 'Texto (vazio usa o endereço)',
    caminhoOuURL: 'Caminho ou URL',
    imagemPlaceholder: 'imagens/figura.png',
    textoAlternativo: 'Texto alternativo (acessibilidade)',
    largura: 'Largura',
    altura: 'Altura',
    px: 'px',
    linhas: 'Linhas',
    colunas: 'Colunas',
    primeiraLinha: 'Primeira linha',
    eCabecalho: 'É cabeçalho',
    eDado: 'É dado',
    idDoDestino: 'Id do destino',
    idDoDestinoPlaceholder: 'secao-ou-ancora',
    textoVazioUsaTitulo: 'Texto (vazio usa o título do destino)',
    textoDaNota: 'Texto da nota',
    idParaReutilizar: 'Id (para reutilizar a nota)',
    nome: 'Nome',
    nomePlaceholder: 'versao',
    valor: 'Valor',
    elemento: 'Elemento',
    teclaKbd: 'Tecla (kbd)',
    botaoBtn: 'Botão (btn)',
    menuMenu: 'Menu (menu)',
    menuRaiz: 'Menu raiz',
    menuRaizPlaceholder: 'Arquivo',
    itensSepareCom: 'Itens (separe com >)',
    texto: 'Texto',
    menuPlaceholder: 'Salvar como > PDF',
    botaoPlaceholder: 'OK',
    teclaPlaceholder: 'Ctrl+S',
    id: 'Id',
    ancoraPlaceholder: 'minha-ancora',
    rotuloOpcional: 'Rótulo (opcional)',
    notacao: 'Notação',
    notacaoStem: 'STEM (a do documento, atributo :stem:)',
    notacaoLatex: 'LaTeX (latexmath)',
    notacaoAsciimath: 'AsciiMath (asciimath)',
    fonteDaFormula: 'Fórmula',
    formulaPlaceholder: 'sqrt(4) = 2   ou   E = mc^2',
    forma: 'Forma',
    formaInline: 'Na linha (inline)',
    formaBloco: 'Em bloco (linhas próprias)',
    previa: 'Prévia',
    erros: {
      informeEndereco: 'Informe o endereço do link (https://…, mailto:… ou um caminho).',
      informeImagem: 'Informe o caminho ou a URL da imagem.',
      larguraNumero: 'A largura é um número de pixels (ou percentual).',
      alturaNumero: 'A altura é um número de pixels.',
      linhasEntre: 'Entre 1 e 200 linhas.',
      colunasEntre: 'Entre 1 e 30 colunas.',
      informeIdDestino: 'Informe o id do destino (uma âncora ou seção do documento).',
      escrevaNota: 'Escreva o texto da nota.',
      informeNomeAtributo: 'Informe o nome do atributo.',
      nomeAtributoFormato: 'O nome usa letras, números, hífen e sublinhado, sem espaços.',
      informeItensMenu: 'Informe os itens do menu (ex.: Salvar como).',
      informeTexto: 'Informe o texto.',
      informeMenuRaiz: 'Informe o menu raiz (ex.: Arquivo).',
      informeIdAncora: 'Informe o id da âncora.',
      idAncoraFormato: 'O id começa com letra e usa letras, números, ponto, hífen e sublinhado.',
      informeFormula: 'Escreva a fórmula.',
    },
  },
  codigo: {
    localizar: 'Localizar',
    localizarNoCodigo: 'Localizar no código',
    nenhumaOcorrencia: 'Nenhuma ocorrência',
    nDeTotal: '{0} de {1}',
    diferenciarMaiusculas: 'Diferenciar maiúsculas',
    diferenciarMaiusculasDica: 'Aa: só ocorrências com a mesma caixa',
    palavraInteira: 'Palavra inteira',
    palavraInteiraDica: 'Só palavras inteiras',
    expressaoRegular: 'Expressão regular',
    expressaoRegularDica: 'O termo é uma expressão regular',
    ocorrenciaAnterior: 'Ocorrência anterior',
    proximaOcorrencia: 'Próxima ocorrência',
    substituir: 'Substituir',
    substituirDica: 'Mostra o campo de substituição',
    fecharBusca: 'Fechar a busca',
    substituirPor: 'Substituir por',
    substituirTodas: 'Substituir todas',
    irParaLinha: 'Ir para a linha',
    irParaLinhaPlaceholder: 'Ir para a linha (1 a {0})',
    numeroDaLinha: 'Número da linha',
    ir: 'Ir',
    fechar: 'Fechar',
  },
  vista: {
    tituloDoDocumento: 'Título do documento',
    autores: 'Autores',
    revisaoPlaceholder: 'Revisão (v1.0, 2026-01-01: nota)',
    revisao: 'Revisão',
    atributosPlaceholder: ':atributo: valor',
    atributosRotulo: 'Atributos do documento, um por linha',
    conteudoDoDocumento: 'Conteúdo do documento',
    escrevaAqui: 'Escreva aqui…',
    tituloDeNivel: 'Título de nível {0}',
    item: 'Item',
    termo: 'Termo',
    explicacaoDaChamada: 'Explicação da chamada',
    literal: 'Literal',
    listagem: 'Listagem',
    codigo: 'Código',
    linguagemDoCodigo: 'Linguagem do código',
    semLinguagem: 'Sem linguagem',
    emLinguagem: '{0} em {1}',
    atributoDoDocumento: 'Atributo do documento',
    nomeDoAtributo: 'Nome do atributo',
    valorDoAtributo: 'Valor do atributo',
    video: 'Vídeo',
    audio: 'Áudio',
    quebraDePagina: 'Quebra de página',
    sumarioGerado: 'Sumário (gerado na publicação)',
    comentario: 'Comentário',
    comentarioBloco: 'Comentário (bloco)',
    passagem: 'Passagem (sai como está)',
    asciidocComoVeio: 'AsciiDoc como veio',
    tarefaConcluida: 'Tarefa concluída',
    tarefaPendente: 'Tarefa pendente',
    inclusao: 'Inclusão',
    abrirArquivoIncluido: 'Abrir o arquivo incluído',
    imagemNaoCarregada: 'Imagem não carregada: {0}',
    atomoImagem: 'imagem',
    atomoNota: '[nota]',
    dicaImagem: 'Imagem: {0}',
    dicaReferencia: 'Referência a {0}',
    dicaAncora: 'Âncora {0}',
    dicaNota: 'Nota de rodapé{0}: {1}',
    dicaTecla: 'Tecla',
    dicaBotao: 'Botão',
    dicaMenu: 'Menu',
    dicaAtributo: 'Atributo {0}',
    dicaPassagem: 'Passagem (sai sem substituições)',
    dicaBruto: 'Macro guardada como veio',
    formula: 'Fórmula',
    notacaoDaFormula: 'Notação da fórmula',
    notacoes: { stem: 'STEM (segue :stem: do documento)', latexmath: 'LaTeX', asciimath: 'AsciiMath' },
    dicaFormula: 'Fórmula em {0}',
    formulaVazia: 'Escreva a fórmula abaixo',
    avisosDaFormula: '{0} aviso(s) na fórmula: {1}',
    abrirLinkDica: '{0} (Ctrl+clique abre)',
    secaoObrigatoria: 'Seção obrigatória do modelo',
    secaoOpcional: 'Seção opcional do modelo',
    exemplo: 'Exemplo: ',
    tituloNaoSeEdita: 'O título não se edita; escreva abaixo dele.',
  },
  modelo: {
    rotulo: 'Modelo: {0}',
    completo: 'Completo',
    pendencias: '{0} pendência(s)',
    falta: 'falta no documento',
    vazia: 'ainda sem texto',
    ordem: 'fora da ordem',
    ok: 'preenchida',
    opcional: 'opcional',
    exemplo: 'Exemplo: ',
  },
  editor: {
    rotulo: 'Editor AsciiDoc',
    estrutura: 'Estrutura',
    estruturaDoDocumento: 'Estrutura do documento',
    semTitulos: 'O documento ainda não tem títulos de seção.',
    semTexto: '(sem texto)',
    divisorRotulo: 'Divisor entre o código e a prévia',
    divisorDica: 'Arraste para redistribuir; duplo clique volta ao meio; setas ajustam',
    codigoDoDocumento: 'Código AsciiDoc do documento',
    visual: 'Visual',
    codigo: 'Código',
    dividido: 'Dividido',
    palavras: '{0} palavras',
    caracteres: '{0} caracteres',
    blocos: '{0} blocos',
    linhaColuna: 'Linha {0}, coluna {1} de {2} linhas',
    codigoSomenteLeituraModelo: 'Código somente leitura: documento com modelo se edita no modo Visual',
    modeloCompleto: 'Modelo {0}: completo',
    modeloPendencias: 'Modelo {0}: {1}',
    pendenciasN: '{0} pendências ({1}…)',
    falta: '"{0}" falta',
    semTextoNaSecao: '"{0}" sem texto',
    foraDaOrdem: '"{0}" fora da ordem',
    avisoNaLinha: 'Aviso na linha {0}: {1}',
    avisosDoParser: '{0} avisos do parser — o primeiro, na linha {1}: {2}',
    linhaN: 'Linha {0}: {1}',
    somenteLeitura: 'Somente leitura',
  },
};

/** Substitui `{0}`, `{1}`… pelos argumentos. */
export function f(pModelo: string, ...pArgs: (string | number)[]): string {
  return pModelo.replace(/\{(\d+)\}/g, (pTudo, pIndice) => {
    const valor = pArgs[Number(pIndice)];
    return valor === undefined ? pTudo : String(valor);
  });
}

/** Catálogo parcial (qualquer nível) por cima do padrão. */
export type TextosParciais = { [K in keyof TextosDoEditorAsciiDoc]?: Partial<TextosDoEditorAsciiDoc[K]> };

export function fundirTextos(pParcial?: TextosParciais): TextosDoEditorAsciiDoc {
  if (!pParcial)
    return TEXTOS_PADRAO;
  const saida = { ...TEXTOS_PADRAO } as Record<string, unknown>;
  for (const chave of Object.keys(pParcial) as (keyof TextosDoEditorAsciiDoc)[]) {
    const parte = pParcial[chave];
    if (!parte)
      continue;
    const base = TEXTOS_PADRAO[chave] as Record<string, unknown>;
    const fundido: Record<string, unknown> = { ...base };
    for (const [nome, valor] of Object.entries(parte as Record<string, unknown>)) {
      if (valor === undefined)
        continue;
      fundido[nome] = typeof valor === 'object' && valor !== null && typeof base[nome] === 'object' ? { ...(base[nome] as object), ...(valor as object) } : valor;
    }
    saida[chave] = fundido;
  }
  return saida as unknown as TextosDoEditorAsciiDoc;
}

export const ContextoDeTextos = createContext<TextosDoEditorAsciiDoc>(TEXTOS_PADRAO);

export function useTextos(): TextosDoEditorAsciiDoc {
  return useContext(ContextoDeTextos);
}
