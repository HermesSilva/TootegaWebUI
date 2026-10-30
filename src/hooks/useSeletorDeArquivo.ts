/**
 * useSeletorDeArquivo — abre o seletor de arquivos do sistema e avisa TAMBÉM quando o usuário
 * cancela.
 *
 * Por que existe: `<input type="file">` dispara `change` quando o usuário ESCOLHE, e **nada** quando
 * ele cancela. Quem só escuta `change` nunca sabe que o diálogo fechou — e o fluxo fica pendurado,
 * sem erro no console. Foi o defeito da App de Certificados (2026-07-25): cancelar o seletor deixava
 * a ação montada e o botão "Adicionar" parava de responder para sempre.
 *
 * Como o cancelamento é detectado, em duas camadas — porque nenhuma sozinha cobre todo navegador:
 *
 * 1. **Evento `cancel` do próprio input** (padrão HTML; Chrome 113+, Firefox 91+, Safari 16.4+).
 *    É o sinal correto e imediato.
 * 2. **Retorno do foco à janela** (rede de segurança para motor antigo, e para o caso em que o
 *    diálogo é fechado por um caminho que não emite `cancel`). Ao reaver o foco, espera-se um
 *    instante: se `change` não veio, foi cancelamento.
 *
 * As duas camadas são idempotentes — o que chegar primeiro resolve, e o resto é ignorado.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Sobra para o `change` chegar depois do foco voltar. Não é adivinhação de tempo de rede: o evento
 *  já está na fila do navegador, e só se espera o próximo ciclo de tarefas dele. */
const ESPERA_APOS_FOCO_MS = 300;

export interface OpcoesSeletorDeArquivo {
  /** Chamado com os arquivos escolhidos (nunca vazio). */
  onEscolher: (pArquivos: File[]) => void;
  /** Chamado quando o usuário FECHA o diálogo sem escolher nada. */
  onCancelar?: () => void;
}

export interface SeletorDeArquivo {
  /**
   * Prenda em `<input type="file" ref={…} />`. O hook cuida dos ouvintes.
   * Opcional quando o input é aberto por `<label>` — aí basta `aoMudar`.
   */
  ref: React.RefObject<HTMLInputElement | null>;
  /** Abre o seletor por código. Desnecessário quando o input está dentro de um `<label>`. */
  abrir: () => void;
  /** Ligue em `onChange` do mesmo input. **Sempre** — é ele que colhe a escolha. */
  aoMudar: (pEvento: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useSeletorDeArquivo(pOpcoes: OpcoesSeletorDeArquivo): SeletorDeArquivo {
  const ref = useRef<HTMLInputElement>(null);

  // Os callbacks vão por ref para o efeito de assinatura não depender deles: o ouvinte de `cancel`
  // é preso uma vez, e um callback recriado a cada render não o faz religar.
  const opcoesRef = useRef(pOpcoes);
  opcoesRef.current = pOpcoes;

  /** Há uma abertura em curso? Enquanto true, cancelar conta; depois de resolvido, não. */
  const abertoRef = useRef(false);

  /**
   * Resolve a abertura. `pArquivos` não-vazio é ESCOLHA; `null`/vazio é cancelamento.
   *
   * A assimetria é proposital. **Escolha é evidência**: o `change` veio com arquivo, e isso vale
   * mesmo que o seletor não tenha sido aberto por `abrir()` — é o caso do input embrulhado num
   * `<label>`, em que o próprio navegador abre o diálogo e o hook nunca soube. Exigir `abrir()`
   * ali faria a escolha ser **descartada em silêncio**, que é pior que o defeito original.
   *
   * **Cancelamento é inferência** (o `cancel` do input, o foco que voltou) e só vale quando há uma
   * abertura em curso — senão qualquer volta de foco à janela viraria um cancelamento falso.
   */
  const resolver = useCallback((pArquivos: File[] | null) => {
    const escolheu = pArquivos !== null && pArquivos.length > 0;

    if (!escolheu && !abertoRef.current)
      return;

    abertoRef.current = false;

    if (escolheu)
      opcoesRef.current.onEscolher(pArquivos!);
    else
      opcoesRef.current.onCancelar?.();
  }, []);

  /** Solta o ouvinte de `cancel` da abertura anterior, se houver. */
  const desligarCancel = useRef<(() => void) | null>(null);

  const abrir = useCallback(() => {
    const input = ref.current;
    if (!input)
      return;

    // Zerar ANTES de abrir: sem isto, escolher o MESMO arquivo duas vezes seguidas não dispara
    // `change` (o valor não mudou), e a segunda tentativa pareceria um cancelamento.
    input.value = '';
    abertoRef.current = true;

    // O ouvinte é preso AQUI, não num efeito de montagem: assim ele não depende de o `ref` já
    // apontar para o elemento quando os efeitos correram. Prender na montagem parecia funcionar
    // (no JSX o input existe antes), mas quebrava calado quando o input chegava depois.
    desligarCancel.current?.();
    const aoCancelar = () => resolver(null);
    input.addEventListener('cancel', aoCancelar);
    desligarCancel.current = () => input.removeEventListener('cancel', aoCancelar);

    input.click();
  }, [resolver]);

  const aoMudar = useCallback((pEvento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(pEvento.target.files ?? []);
    pEvento.target.value = '';
    resolver(arquivos);
  }, [resolver]);

  // Camada 1 é presa em `abrir()` (acima). Aqui só se garante a soltura ao desmontar.
  useEffect(() => () => desligarCancel.current?.(), []);

  // Camada 2: o foco voltou à janela e nenhum `change` chegou ⇒ cancelamento.
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const aoFocar = () => {
      if (!abertoRef.current)
        return;

      clearTimeout(temporizador);
      temporizador = setTimeout(() => resolver(null), ESPERA_APOS_FOCO_MS);
    };

    window.addEventListener('focus', aoFocar);
    return () => {
      window.removeEventListener('focus', aoFocar);
      clearTimeout(temporizador);
    };
  }, [resolver]);

  // O objeto de retorno é ESTÁVEL de propósito. Um literal novo a cada render tem identidade nova,
  // e quem escreve `useEffect(() => seletor.abrir(), [seletor])` — a leitura natural da regra de
  // dependências — reabre o diálogo de arquivo a CADA render. Foi o defeito de 2026-08-01 no
  // "Adicionar certificados": digitar a senha ou clicar em salvar mudava o estado, o componente
  // renderizava, e o seletor de arquivo pulava na frente do usuário. As três partes já são estáveis
  // (`ref` é um ref; `abrir` e `aoMudar` são `useCallback` sobre `resolver`, que não tem dependência),
  // então a estabilidade do conjunto é só deixar de recriar o invólucro.
  return useMemo(() => ({ ref, abrir, aoMudar }), [abrir, aoMudar]);
}
