/**
 * XBotaoCopiar — leva o conteúdo do campo para a área de transferência.
 *
 * Existe como PEÇA porque o gesto é o mesmo em toda parte: pilha de exceção, corpo de requisição,
 * documento JSON, observação longa. Escrito de novo em cada editor, um teria retorno visual e o
 * outro não, um trataria a recusa do navegador e o outro copiaria em silêncio.
 *
 * O retorno é obrigatório: copiar é uma ação sem efeito visível na tela: sem confirmação, o operador
 * não sabe se aconteceu e clica de novo. E a FALHA fala (CE-21-quater): o navegador nega a área de
 * transferência em página sem HTTPS e quando o documento não tem foco — e "não copiou" sem motivo é
 * erro mudo. O texto fica ao lado do botão, não em diálogo: a ação é pequena e o aviso a acompanha.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Check, Copy } from 'lucide-react';

interface XBotaoCopiarProps {
  /** O que vai para a área de transferência. Vazio ⇒ o botão não aparece: não há o que copiar. */
  texto: string;
  /** Classe de posicionamento — quem hospeda decide o canto; o botão só sabe copiar. */
  className?: string;
  /** O que se está copiando, para o rótulo dizer ("Copiar a pilha"). Ausente ⇒ "Copiar". */
  descricao?: string;
}

/** Quanto tempo a confirmação fica na tela. O bastante para ser vista, pouco para não virar ruído. */
const MS_CONFIRMACAO = 1600;

export function XBotaoCopiar({ texto, className, descricao }: XBotaoCopiarProps): JSX.Element | null {
  const [copiado, setCopiado] = useState(false);
  const [falha, setFalha] = useState<string | undefined>(undefined);
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // O componente pode sair da tela (troca de aba, fechamento do modal) antes do prazo acabar.
  useEffect(() => () => { if (relogio.current) clearTimeout(relogio.current); }, []);

  const copiar = useCallback(async () => {
    setFalha(undefined);

    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('este navegador não expõe a área de transferência (a página precisa estar em HTTPS)');

      await navigator.clipboard.writeText(texto);

      setCopiado(true);
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setCopiado(false), MS_CONFIRMACAO);
    } catch (erro) {
      // A recusa do navegador vem com motivo (documento sem foco, permissão negada, contexto
      // inseguro): é ele que vai à tela, não uma frase que serviria para qualquer falha.
      setCopiado(false);
      setFalha(`Não foi possível copiar: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }, [texto]);

  if (texto.length === 0)
    return null;

  const rotulo = copiado ? 'Copiado' : descricao ? `Copiar ${descricao}` : 'Copiar';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {falha && (
        <span className="text-ui-xs text-danger whitespace-nowrap bg-brand-surface/90 px-1 rounded">
          {falha}
        </span>
      )}
      <button
        type="button"
        onClick={() => { void copiar(); }}
        className="p-1 rounded hover:bg-hover text-brand-text-muted bg-brand-surface/80"
        tabIndex={-1}
        title={rotulo}
        aria-label={rotulo}
      >
        {copiado
          ? <Check className="w-3.5 h-3.5 text-success" />
          : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
