import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Testes do MOTOR que não precisam de React: parser, serializador, modelo e transações do editor
 * AsciiDoc, tokenizador de código, utilitários puros de `lib/`. Rodam aqui, sozinhos, sem SaaS ao lado
 * (`npm test`), e também dentro da suíte de cada SaaS, que aponta um projeto do vitest para esta raiz
 * e conta a cobertura deles na catraca do SaaS.
 *
 * Teste de COMPONENTE (que renderiza React) NÃO mora aqui: fica na suíte do App do SaaS, que é quem
 * garante uma cópia só do React (apelidos no vitest.config do App). Com dois `node_modules` (o do App
 * e o daqui), um componente carregaria outro React e os hooks morreriam em "Cannot read properties of
 * null (reading 'useState')" — apurado em 2026-07-22 no ERP.
 */
const abs = (...p: string[]): string => path.resolve(__dirname, ...p).replace(/\\/g, '/');

export default defineConfig({
  resolve: {
    alias: {
      '@core': abs('./src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
