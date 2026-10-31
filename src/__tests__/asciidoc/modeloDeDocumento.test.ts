/**
 * MODELO DE DOCUMENTO: o esqueleto nasce completo em seções e vazio em texto; a avaliação aponta o que falta,
 * o que está sem texto e o que está fora da ordem.
 */
import { describe, expect, it } from 'vitest';
import { analisarAsciiDoc } from '@core/components/asciidoc/parser/blocos';
import { avaliarModelo, esqueletoDoModelo, garantirEspacoDasSecoes, secoesTravadas, violacaoDoModelo } from '@core/components/asciidoc/modelo/modeloDeDocumento';
import { MODELO_ITEM_DE_TRABALHO } from '@core/components/asciidoc/exemplo/modelosDeExemplo';
import { folhasDoDocumento } from '@core/components/asciidoc/modelo/documento';
import { selecaoColapsada } from '@core/components/asciidoc/editor/selecao';
import { apagarParaTras, inserirTexto, removerBloco } from '@core/components/asciidoc/editor/transacoes';

describe('modelo de documento', () => {
  it('o esqueleto tem todas as seções e nenhuma preenchida', () => {
    const texto = esqueletoDoModelo(MODELO_ITEM_DE_TRABALHO);
    const { documento } = analisarAsciiDoc(texto);
    const avaliacao = avaliarModelo(documento, MODELO_ITEM_DE_TRABALHO);
    expect(avaliacao.faltantes).toEqual([]);
    expect(avaliacao.vazias.map((pS) => pS.titulo)).toEqual(['O quê', 'Por quê', 'Critério de pronto', 'Valor esperado']);
    expect(avaliacao.completo).toBe(false);
  });

  it('seção obrigatória ausente é apontada; a opcional não', () => {
    const { documento } = analisarAsciiDoc('= T\n\n== O quê\n\nFeito.\n\n== Por quê\n\nPorque sim.\n\n== Valor esperado\n\nMuito.\n');
    const avaliacao = avaliarModelo(documento, MODELO_ITEM_DE_TRABALHO);
    expect(avaliacao.faltantes.map((pS) => pS.titulo)).toEqual(['Critério de pronto']);
    expect(avaliacao.vazias).toEqual([]);
  });

  it('documento completo e na ordem é aceito; fora da ordem é apontado', () => {
    const completo = '== O quê\n\na\n\n== Por quê\n\nb\n\n== Critério de pronto\n\n* [ ] c\n\n== Valor esperado\n\nd\n';
    expect(avaliarModelo(analisarAsciiDoc(completo).documento, MODELO_ITEM_DE_TRABALHO).completo).toBe(true);
    const trocado = '== Por quê\n\nb\n\n== O quê\n\na\n\n== Critério de pronto\n\n* [ ] c\n\n== Valor esperado\n\nd\n';
    const avaliacao = avaliarModelo(analisarAsciiDoc(trocado).documento, MODELO_ITEM_DE_TRABALHO);
    expect(avaliacao.foraDeOrdem.map((pS) => pS.titulo)).toEqual(['Por quê']);
    expect(avaliacao.completo).toBe(false);
  });

  it('seções fixas: remover, renomear ou unir o título é violação; escrever abaixo não é', () => {
    // O AsciiDoc não escreve parágrafo vazio: o editor garante o espaço editável abaixo de cada título fixo.
    const documento = garantirEspacoDasSecoes(analisarAsciiDoc(esqueletoDoModelo(MODELO_ITEM_DE_TRABALHO)).documento, MODELO_ITEM_DE_TRABALHO);
    const travadas = secoesTravadas(documento, MODELO_ITEM_DE_TRABALHO);
    expect(travadas.size).toBe(5);
    expect(documento.blocos[1].tipo).toBe('paragrafo');
    const [idOQue] = travadas.keys();

    const removido = removerBloco(documento, idOQue);
    expect(violacaoDoModelo(documento, removido, MODELO_ITEM_DE_TRABALHO)).toContain('«O quê»');

    const renomeado = inserirTexto(documento, selecaoColapsada(idOQue, 0), 'x').documento;
    expect(violacaoDoModelo(documento, renomeado, MODELO_ITEM_DE_TRABALHO)).toContain('«O quê»');

    const folhas = folhasDoDocumento(documento);
    const paragrafoAbaixo = folhas[folhas.findIndex((pF) => pF.folha.id === idOQue) + 1];
    const escrito = inserirTexto(documento, selecaoColapsada(paragrafoAbaixo.folha.id, 0), 'O resultado.').documento;
    expect(violacaoDoModelo(documento, escrito, MODELO_ITEM_DE_TRABALHO)).toBeNull();

    // Backspace no início do parágrafo escrito o fundiria ao título fixo: recusado.
    const unido = apagarParaTras(escrito, selecaoColapsada(paragrafoAbaixo.folha.id, 0)).documento;
    expect(violacaoDoModelo(escrito, unido, MODELO_ITEM_DE_TRABALHO)).toContain('«O quê»');

    // Backspace no parágrafo VAZIO só o remove; o título fica intacto e o editor repõe o espaço.
    const vazioRemovido = apagarParaTras(documento, selecaoColapsada(paragrafoAbaixo.folha.id, 0)).documento;
    expect(violacaoDoModelo(documento, vazioRemovido, MODELO_ITEM_DE_TRABALHO)).toBeNull();
    expect(garantirEspacoDasSecoes(vazioRemovido, MODELO_ITEM_DE_TRABALHO).blocos[1].tipo).toBe('paragrafo');
  });

  it('o título é reconhecido sem acento e sem diferença de caixa', () => {
    const { documento } = analisarAsciiDoc('== o que\n\na\n\n== POR QUE\n\nb\n\n== Criterio de pronto\n\nc\n\n== valor esperado\n\nd\n');
    expect(avaliarModelo(documento, MODELO_ITEM_DE_TRABALHO).completo).toBe(true);
  });
});
