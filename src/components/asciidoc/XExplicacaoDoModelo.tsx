/**
 * XExplicacaoDoModelo — a área NÃO EDITÁVEL no topo do documento que explica o modelo: para que o documento serve,
 * e o que vai em cada seção. Recolhível, para não roubar a tela de quem já conhece o modelo; o estado do documento
 * diante do modelo (o que falta, o que está vazio) aparece ao lado de cada seção. Textos do catálogo (`useTextos`).
 */

import { BookOpen, Check, ChevronDown, ChevronRight, CircleAlert } from 'lucide-react';
import { useState, type JSX } from 'react';
import { XTextoFormatado } from './XTextoFormatado';
import type { AvaliacaoDoModelo, ModeloDeDocumento } from './modelo/modeloDeDocumento';
import { f, useTextos } from './textos';

export interface XExplicacaoDoModeloProps {
  modelo: ModeloDeDocumento;
  avaliacao: AvaliacaoDoModelo;
}

export function XExplicacaoDoModelo({ modelo, avaliacao }: XExplicacaoDoModeloProps): JSX.Element {
  const t = useTextos().modelo;
  const [aberta, setAberta] = useState(true);
  const estadoDaSecao = (pTitulo: string): 'falta' | 'vazia' | 'ordem' | 'ok' | 'opcional' => {
    if (avaliacao.faltantes.some((pS) => pS.titulo === pTitulo))
      return 'falta';
    if (avaliacao.vazias.some((pS) => pS.titulo === pTitulo))
      return 'vazia';
    if (avaliacao.foraDeOrdem.some((pS) => pS.titulo === pTitulo))
      return 'ordem';
    const secao = modelo.secoes.find((pS) => pS.titulo === pTitulo);
    return secao?.obrigatoria ? 'ok' : 'opcional';
  };
  const ROTULO: Record<ReturnType<typeof estadoDaSecao>, string> = {
    falta: t.falta,
    vazia: t.vazia,
    ordem: t.ordem,
    ok: t.ok,
    opcional: t.opcional,
  };

  return (
    <aside className={`adc-modelo${avaliacao.completo ? ' adc-modelo-completo' : ''}`} data-ilha="" contentEditable={false} aria-label={f(t.rotulo, modelo.rotulo)}>
      <button type="button" className="adc-modelo-cabecalho" onClick={() => setAberta((pA) => !pA)} aria-expanded={aberta}>
        {aberta ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <BookOpen size={16} aria-hidden="true" />
        <span className="adc-modelo-rotulo">{f(t.rotulo, modelo.rotulo)}</span>
        <span className={`adc-modelo-estado${avaliacao.completo ? ' adc-modelo-estado-ok' : ''}`}>
          {avaliacao.completo ? (
            <>
              <Check size={14} aria-hidden="true" /> {t.completo}
            </>
          ) : (
            <>
              <CircleAlert size={14} aria-hidden="true" /> {f(t.pendencias, avaliacao.faltantes.length + avaliacao.vazias.length + avaliacao.foraDeOrdem.length)}
            </>
          )}
        </span>
      </button>
      {aberta && (
        <div className="adc-modelo-corpo">
          <p className="adc-modelo-explicacao adc-texto-formatado">
            <XTextoFormatado texto={modelo.explicacao} />
          </p>
          <ol className="adc-modelo-secoes">
            {modelo.secoes.map((pSecao) => {
              const estado = estadoDaSecao(pSecao.titulo);
              return (
                <li key={pSecao.titulo} className={`adc-modelo-secao adc-modelo-secao-${estado}`}>
                  <div className="adc-modelo-secao-titulo">
                    <span>{pSecao.titulo}</span>
                    <span className="adc-modelo-secao-estado">{ROTULO[estado]}</span>
                  </div>
                  <p className="adc-modelo-secao-explicacao adc-texto-formatado">
                    <XTextoFormatado texto={pSecao.explicacao} />
                  </p>
                  {pSecao.exemplo && (
                    <p className="adc-modelo-secao-exemplo adc-texto-formatado">
                      <span className="adc-modelo-secao-rotulo-exemplo">{t.exemplo}</span>
                      <XTextoFormatado texto={pSecao.exemplo} />
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );
}
