/**
 * O endereço do hub de tempo real: na API publicada em outro host, ele vai à origem da API (na raiz, fora de /api);
 * em desenvolvimento, com a API relativa, fica relativo e o Vite o repassa. O caminho relativo publicado ia ao nginx do
 * front e levava 405 no negotiate (homologação, 2026-11-20).
 */

import { describe, expect, it } from 'vitest';

import { urlDoHub } from '../lib/urlDoHub';

describe('urlDoHub', () => {
  it('API em outro host: o hub vai à origem da API, na raiz, fora de /api', () => {
    expect(urlDoHub('/hub/mensagens', 'https://api.mastersist.com.br/api')).toBe('https://api.mastersist.com.br/hub/mensagens');
    expect(urlDoHub('/hub/suporte', 'https://api.mastersist.com.br/api/')).toBe('https://api.mastersist.com.br/hub/suporte');
    expect(urlDoHub('/hub/suporte', 'http://localhost:6006/api')).toBe('http://localhost:6006/hub/suporte');
  });

  it('API relativa (desenvolvimento): o caminho fica como está', () => {
    expect(urlDoHub('/hub/mensagens', '/api')).toBe('/hub/mensagens');
  });
});
