/**
 * Logo da empresa corrente — o que ela mostra de si (perfil, SYSxPerfil).
 *
 * A imagem vem de `GET /sys/companies/{id}/logo`, que devolve 204 quando a empresa não subiu logo. Sem
 * logo, ou falhando a carga, o ícone genérico de prédio toma o lugar: a empresa aparece de todo jeito —
 * logo é adorno, nunca requisito.
 */

import { useEffect, useState, type JSX } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '@core/lib/api';

interface CompanyLogoProps {
  companyID: number;
  size?: number;
}

export function CompanyLogo({ companyID, size = 16 }: CompanyLogoProps): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!companyID) {
      setUrl(null);
      return;
    }

    let ativo = true;
    let criada: string | null = null;

    void (async () => {
      try {
        const { blob } = await api.downloadBlob(`/sys/companies/${companyID}/logo`, undefined, 'GET');

        if (!ativo)
          return;

        // 204 (sem logo) chega como corpo vazio. LIMPAR é obrigatório, não opcional: o `url` ainda
        // guarda o blob da empresa ANTERIOR, e sair daqui sem mexer nele fazia a empresa sem logo
        // exibir a marca da outra — o usuário trocava de empresa e via o logotipo errado.
        if (blob.size === 0) {
          setUrl(null);
          return;
        }

        criada = URL.createObjectURL(blob);
        setUrl(criada);
      } catch {
        // Empresa sem logo, ou serviço fora do ar: o ícone genérico basta. Nunca é erro de tela.
        if (ativo)
          setUrl(null);
      }
    })();

    return () => {
      ativo = false;
      if (criada)
        URL.revokeObjectURL(criada);
    };
  }, [companyID]);

  if (!url)
    return <Building2 size={size} className="text-brand-primary flex-shrink-0" />;

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="rounded-sm object-contain flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
