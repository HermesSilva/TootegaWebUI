import { createContext, useState, useCallback, useEffect, type ReactNode, type JSX } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, setCurrentCompanyID } from '@core/lib/api';
import { getFieldValue } from '@core/lib/fieldAccess';
import { useAuth } from '@core/hooks/useAuth';

const STORAGE_KEY = 'Tootega_company';

/**
 * Empresa sobre a qual o usuário pode trabalhar. Vem de GET /sys/companies, que aplica a mesma
 * regra do App "Acessos de Usuário": empresas ligadas e ativas em SYSxUsuarioPessoa; sem vínculo
 * nenhum, todas as do assinante com ação != "Nenhuma".
 */
export interface Company {
  sysxPessoaID: number;
  nome: string;
  razaoSocial: string;
  documento: string;
}

export interface CompanyContextValue {
  /** Empresa corrente, já validada contra as empresas acessíveis. Null enquanto não houver escolha. */
  company: Company | null;
  /** Empresas acessíveis ao usuário logado. */
  companies: Company[];
  isLoading: boolean;
  /** True quando o usuário PRECISA escolher: nenhuma empresa corrente ou perdeu o acesso à salva. */
  mustSelect: boolean;
  /** True quando o diálogo de seleção está aberto (obrigatório ou pedido pelo usuário). */
  isSelectorOpen: boolean;
  openSelector: () => void;
  closeSelector: () => void;
  selectCompany: (pCompany: Company) => void;
  /**
   * Recarrega do servidor a lista COMPLETA de empresas acessíveis (a que sustenta o
   * <see cref="mustSelect"/>). Ela era buscada uma vez, na autenticação, e vivia no estado do
   * provider pelo resto da sessão — então uma empresa criada DEPOIS (importar um certificado A1
   * cria a empresa dele) só aparecia após recarregar a página (dono, 2026-09-20).
   */
  refreshCompanies: () => Promise<void>;
  /**
   * Busca empresas por um TERMO único, casado no servidor contra <b>nome, razão social e CNPJ</b>
   * (dono, 2026-09-20): quem procura uma empresa não quer antes decidir por onde procurá-la.
   *
   * <b>Devolve o resultado e NÃO toca no estado</b> — e esta separação é de correção, não de
   * estilo. Se a busca sobrescrevesse `companies`, um termo sem resultado a esvaziaria; e como
   * `mustSelect` se mede por `companies.length`, o diálogo OBRIGATÓRIO se fecharia sozinho no meio
   * da digitação, deixando o sistema sem empresa. A lista de acesso e o resultado da busca são
   * coisas diferentes e vivem separadas.
   */
  searchCompanies: (pTermo: string) => Promise<Company[]>;
}

const initialState: CompanyContextValue = {
  company: null,
  companies: [],
  isLoading: true,
  mustSelect: false,
  isSelectorOpen: false,
  openSelector: () => {},
  closeSelector: () => {},
  selectCompany: () => {},
  refreshCompanies: async () => {},
  searchCompanies: async () => [],
};

export const CompanyContext = createContext<CompanyContextValue>(initialState);

/** A serialização do backend é camelCase (`sYSxPessoaID`); o acesso tolerante a caixa normaliza. */
function paraEmpresa(pLinha: Record<string, unknown>): Company {
  return {
    sysxPessoaID: Number(getFieldValue(pLinha, 'SYSxPessoaID') ?? 0),
    nome: String(getFieldValue(pLinha, 'Nome') ?? ''),
    razaoSocial: String(getFieldValue(pLinha, 'RazaoSocial') ?? ''),
    documento: String(getFieldValue(pLinha, 'Documento') ?? ''),
  };
}

/** Empresa escolhida por usuário (o mesmo navegador pode ser usado por mais de uma conta). */
function readStoredCompanyID(pUserID: string): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored)
      return null;
    const mapa = JSON.parse(stored) as Record<string, number>;
    return mapa[pUserID] ?? null;
  } catch {
    return null;
  }
}

function writeStoredCompanyID(pUserID: string, pCompanyID: number | null): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const mapa = stored ? (JSON.parse(stored) as Record<string, number>) : {};
    if (pCompanyID === null)
      delete mapa[pUserID];
    else
      mapa[pUserID] = pCompanyID;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    // Armazenamento indisponível (modo privado/quota): a empresa vale só para esta sessão.
  }
}

interface CompanyProviderProps {
  children: ReactNode;
}

/**
 * `useQueryClient` LANÇA quando não há `QueryClientProvider` acima. Aqui a ausência é legítima
 * (a casca pode montar sem ele), então a dependência é opcional: sem cliente, devolve null e a
 * invalidação simplesmente não acontece — o isolamento continua valendo pela chave de consulta.
 */
function useQueryClientOpcional(): QueryClient | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- o try/catch não ramifica a ordem dos
    // hooks: useQueryClient é sempre chamado; o catch só trata a ausência do provider.
    return useQueryClient();
  } catch {
    return null;
  }
}

export function CompanyProvider({ children }: CompanyProviderProps): JSX.Element {
  const { user, isAuthenticated } = useAuth();

  // A empresa corrente é assunto da CASCA e não depende do React Query: o provider tem de montar
  // mesmo sem um QueryClientProvider acima (é como os testes o exercitam, e é o que o mantém
  // independente). Com cliente, a troca de empresa descarta o cache; sem cliente, a chave de
  // consulta — que já leva a empresa — continua garantindo o isolamento sozinha.
  const queryClient = useQueryClientOpcional();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const userID = user?.id ?? '';

  // A empresa salva sobrevive ao logout: ao entrar de novo, ela é reconfirmada contra a lista que o
  // backend devolve. Perdeu o acesso (ou nunca escolheu) ⇒ a escolha é obrigatória (mustSelect),
  // exceto quando só há uma empresa acessível: aí ela é assumida sem diálogo (não há o que escolher).
  useEffect(() => {
    if (!isAuthenticated || !userID) {
      setCompanies([]);
      setCompany(null);
      setCurrentCompanyID(null);
      setIsLoading(false);
      return;
    }

    let cancelado = false;
    setIsLoading(true);

    // O cabeçalho X-Company-ID só passa a viajar depois que a empresa é confirmada pelo backend.
    setCurrentCompanyID(null);

    api.get<Record<string, unknown>[]>('/sys/companies')
      .then((linhas) => {
        if (cancelado)
          return;

        const lista = (linhas ?? []).map(paraEmpresa);
        setCompanies(lista);

        const salva = readStoredCompanyID(userID);
        const confirmada = lista.find((c) => c.sysxPessoaID === salva) ?? null;
        const unica = lista.length === 1 ? lista[0] : null;
        const corrente = confirmada ?? unica;

        setCompany(corrente);
        setCurrentCompanyID(corrente?.sysxPessoaID ?? null);
        if (corrente)
          writeStoredCompanyID(userID, corrente.sysxPessoaID);
        else
          writeStoredCompanyID(userID, null);
      })
      .catch(() => {
        if (!cancelado)
          setCompanies([]);
      })
      .finally(() => {
        if (!cancelado)
          setIsLoading(false);
      });

    return () => { cancelado = true; };
  }, [isAuthenticated, userID]);

  const selectCompany = useCallback((pCompany: Company): void => {
    setCompany(pCompany);
    setCurrentCompanyID(pCompany.sysxPessoaID);
    if (userID)
      writeStoredCompanyID(userID, pCompany.sysxPessoaID);

    // Descarta o que foi lido sob a empresa ANTERIOR. A empresa já entra na queryKey
    // (`applicationKeys`), então a troca por si só muda a chave e força ida ao servidor; isto aqui
    // remove as entradas antigas do cache em vez de deixá-las envelhecendo em memória — e cobre
    // qualquer consulta que ainda não tenha migrado para aquelas chaves.
    void queryClient?.invalidateQueries();

    setIsSelectorOpen(false);
  }, [userID, queryClient]);

  /**
   * Relê <c>/sys/companies</c> e atualiza SÓ a lista.
   *
   * NÃO mexe na empresa CORRENTE, de propósito: reconfirmar aqui trocaria a empresa sob os pés de
   * quem está no meio de um trabalho — a escolha é do usuário, e o único lugar onde o sistema a faz
   * por ele é na entrada (efeito de autenticação). Aqui só se responde à pergunta "quais existem".
   *
   * Falha silenciosa por decisão: a recarga é pano de fundo do seletor. Se o servidor não responder,
   * o diálogo continua mostrando a lista que já tinha — melhor que uma caixa de erro por cima de uma
   * escolha que o usuário consegue fazer. O erro real aparece quando ele confirmar e a operação for.
   */
  const refreshCompanies = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !userID)
      return;

    try {
      const linhas = await api.get<Record<string, unknown>[]>('/sys/companies');
      setCompanies((linhas ?? []).map(paraEmpresa));
    } catch {
      // Ver o comentário acima: mantém a lista corrente.
    }
  }, [isAuthenticated, userID]);

  /**
   * Consulta pura: devolve o que casou e não mexe em `companies` — ver o contrato da interface.
   *
   * Falha devolve lista VAZIA em vez de estourar: a busca é pano de fundo de quem está digitando, e
   * uma caixa de erro por tecla seria pior que o resultado ausente. A falha real reaparece quando o
   * usuário confirmar a escolha e a operação for ao servidor.
   */
  const searchCompanies = useCallback(async (pTermo: string): Promise<Company[]> => {
    if (!isAuthenticated || !userID)
      return [];

    const termo = pTermo.trim();
    const rota = termo.length > 0
      ? `/sys/companies?q=${encodeURIComponent(termo)}`
      : '/sys/companies';

    try {
      return (await api.get<Record<string, unknown>[]>(rota) ?? []).map(paraEmpresa);
    } catch {
      return [];
    }
  }, [isAuthenticated, userID]);

  // Abrir NÃO recarrega aqui: quem busca é o próprio diálogo, num efeito único que já cobre a abertura
  // (termo vazio) e cada tecla digitada. Recarregar também aqui duplicaria a requisição de abertura —
  // e deixaria de fora o caso em que o diálogo abre SOZINHO (mustSelect), que não passa por este
  // caminho. Um ponto de responsabilidade, e é o que está mais perto do usuário.
  const openSelector = useCallback((): void => setIsSelectorOpen(true), []);
  const closeSelector = useCallback((): void => setIsSelectorOpen(false), []);

  const mustSelect = isAuthenticated && !isLoading && company === null && companies.length > 0;

  const value: CompanyContextValue = {
    company,
    companies,
    isLoading,
    mustSelect,
    isSelectorOpen: isSelectorOpen || mustSelect,
    openSelector,
    closeSelector,
    selectCompany,
    refreshCompanies,
    searchCompanies,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}
