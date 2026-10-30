import { useState, useEffect, type JSX } from 'react';
import { X, Building2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { XModalShell } from '@core/components/templates/XModalShell';
import { useCompany } from '@core/hooks';
import { formatDocument } from '@core/lib/formatting';
import type { Company } from '@core/contexts';

/**
 * Diálogo de escolha da empresa corrente. Abre por si quando não há empresa escolhida (ou o usuário
 * perdeu o acesso à que estava salva) — nesse caso NÃO é fechável (nem por Escape, nem pelo fundo,
 * nem por botão), pois o sistema não opera sem empresa. Também abre sob demanda pelo item
 * "Selecionar empresa" do menu do perfil, e aí fecha normalmente.
 */
/** Quanto se espera parar de digitar antes de perguntar ao servidor. */
const ESPERA_DA_BUSCA_MS = 300;

export function CompanySelectorModal(): JSX.Element | null {
  const {
    companies, company, isSelectorOpen, mustSelect, closeSelector, selectCompany, searchCompanies,
  } = useCompany();
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);

  // O resultado da busca vive AQUI, e não no contexto: `companies` é a lista de ACESSO, e ela
  // sustenta o `mustSelect`. Sobrescrevê-la com um resultado vazio fecharia o diálogo obrigatório
  // no meio da digitação. Começa como a lista de acesso, para o diálogo abrir já preenchido.
  const [resultado, setResultado] = useState<Company[]>(companies);

  useEffect(() => {
    if (isSelectorOpen) {
      setSelecionada(company?.sysxPessoaID ?? null);
      setBusca('');
    }
  }, [isSelectorOpen, company]);

  /**
   * A BUSCA VAI AO SERVIDOR (dono, 2026-09-20), e não filtra a lista em memória.
   *
   * Filtrar o que já estava carregado tinha dois defeitos de uma vez: a empresa criada depois da
   * autenticação — importar um certificado A1 cria a empresa dele — não existia na lista, então
   * nenhum termo a encontrava; e com muitas empresas o diálogo dependeria de ter tudo em memória.
   *
   * Um termo só, casado no servidor contra nome, razão social e CNPJ. O `debounce` existe para o
   * campo não disparar uma requisição por TECLA: espera-se o usuário parar de digitar.
   */
  useEffect(() => {
    if (!isSelectorOpen)
      return;

    let cancelado = false;
    setBuscando(true);

    const id = setTimeout(() => {
      void searchCompanies(busca).then((pLista) => {
        // A resposta de uma busca ABANDONADA (o usuário seguiu digitando) não pode sobrescrever a
        // atual: sem esta guarda, uma requisição lenta de um termo antigo chega depois e repõe o
        // resultado errado na tela — o clássico de busca-ao-digitar.
        if (cancelado)
          return;

        setResultado(pLista);
        setBuscando(false);
      });
    }, ESPERA_DA_BUSCA_MS);

    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [busca, isSelectorOpen, searchCompanies]);

  // A lista JÁ vem filtrada do servidor; aqui não se filtra de novo. Um segundo filtro local
  // esconderia justamente o que o servidor casou por critério que o front não reproduz — o CNPJ
  // por dígitos, por exemplo, que casa "09.398.922/0001-73" contra o documento limpo.
  const filtradas: Company[] = resultado;

  if (!isSelectorOpen)
    return null;

  function fechar(): void {
    if (!mustSelect)
      closeSelector();
  }

  function confirmar(): void {
    // Procura no RESULTADO (o que está na tela), e não na lista de acesso: a empresa recém-criada
    // aparece na busca antes de a lista de acesso ser recarregada, e confirmar tem de funcionar
    // sobre o que o usuário acabou de marcar.
    const escolhida = resultado.find((c) => c.sysxPessoaID === selecionada);
    if (escolhida)
      selectCompany(escolhida);
  }

  const rodape = (
    <>
      {!mustSelect && (
        <Button type="button" variant="secondary" onClick={closeSelector}>
          {'Cancelar'}
        </Button>
      )}
      <Button
        type="button"
        onClick={confirmar}
        disabled={selecionada === null}
        data-testid="company-confirm"
      >
        {'Confirmar'}
      </Button>
    </>
  );

  // Sem cabeçalho do shell: o X só existe quando a escolha NÃO é obrigatória.
  return (
    <XModalShell
      variant="overlay"
      size="xl"
      closeLabel={'Fechar'}
      onClose={fechar}
      footer={rodape}
    >
      <div data-testid="company-selector">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-border-light">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-brand-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-brand-text-primary whitespace-nowrap">
                {'Selecionar empresa'}
              </h2>
              <p className="text-ui-xs text-brand-text-muted whitespace-nowrap">{'Escolha a empresa sobre a qual deseja trabalhar.'}</p>
            </div>
          </div>
          {!mustSelect && (
            <button
              type="button"
              onClick={closeSelector}
              className="min-h-touch min-w-touch flex items-center justify-center hover:bg-hover rounded-lg transition-colors shrink-0"
              aria-label={'Fechar'}
            >
              <X size={20} className="text-brand-text-secondary" />
            </button>
          )}
        </div>

        <div className="px-4 sm:px-6 pt-4">
          <Input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={'Buscar por nome, razão social ou CNPJ'}
            data-testid="company-search"
            autoFocus
          />
        </div>

        <div className="px-4 sm:px-6 py-4">
          {/* LISTA VAZIA diz coisas DIFERENTES conforme haja busca (dono, 2026-09-20). Com a busca no
              servidor, a mesma lista vazia passou a significar duas coisas — "o seu usuário não tem
              empresa" e "o termo não casou com nenhuma" —, e dizer a primeira quando é a segunda
              manda o usuário procurar um problema de permissão que não existe. */}
          {filtradas.length === 0 ? (
            <p className="text-ui text-brand-text-secondary py-8 text-center" data-testid="company-empty">
              {buscando
                ? 'Buscando…'
                : busca.trim().length > 0
                  ? `Nenhuma empresa encontrada para "${busca.trim()}".`
                  : 'Nenhuma empresa disponível para o seu usuário.'}
            </p>
          ) : (
            <table className="w-full text-ui">
              <thead>
                <tr className="text-left text-brand-text-muted border-b border-border-light">
                  <th className="w-10 py-2" />
                  <th className="py-2 font-medium">{'Nome'}</th>
                  <th className="py-2 font-medium">{'Razão social'}</th>
                  <th className="py-2 font-medium">{'CNPJ'}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr
                    key={c.sysxPessoaID}
                    onClick={() => setSelecionada(c.sysxPessoaID)}
                    onDoubleClick={() => selectCompany(c)}
                    data-testid={`company-row-${c.sysxPessoaID}`}
                    className={`cursor-pointer border-b border-border-light/50 transition-colors ${
                      selecionada === c.sysxPessoaID ? 'bg-brand-primary/10' : 'hover:bg-hover'
                    }`}
                  >
                    <td className="py-2">
                      <input
                        type="radio"
                        name="empresa-corrente"
                        checked={selecionada === c.sysxPessoaID}
                        onChange={() => setSelecionada(c.sysxPessoaID)}
                        aria-label={c.nome}
                        className="accent-brand-primary"
                      />
                    </td>
                    <td className="py-2 text-brand-text-primary font-medium">{c.nome}</td>
                    <td className="py-2 text-brand-text-secondary">{c.razaoSocial}</td>
                    <td className="py-2 text-brand-text-secondary whitespace-nowrap">{formatDocument(c.documento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </XModalShell>
  );
}
