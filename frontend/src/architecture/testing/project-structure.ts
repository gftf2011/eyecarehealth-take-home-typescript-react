import { readdirSync } from 'node:fs';

import { projectFiles, type FileInfo, type PatternOptions } from 'archunit';

/**
 * Bounded contexts do painel: os mesmos da API, cada um com as suas telas.
 * Um teste garante que toda pasta nova em `src/` está nesta lista.
 */
export const BOUNDED_CONTEXTS = ['identity', 'ordering'] as const;

export type BoundedContext = (typeof BOUNDED_CONTEXTS)[number];

/** Pastas de `src/` que não são contextos de negócio. */
export const INFRASTRUCTURE_FOLDERS = ['architecture', 'main', 'shared-kernel'] as const;

/** Pastas de primeiro nível de `src/`. */
export function sourceFolders(): string[] {
  return readdirSync('src', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Código de produção: os testes (`*.spec.ts(x)`) e o apoio a testes (pastas
 * `testing/`) podem atravessar camadas e contextos para montar cenários.
 */
const TEST_FOLDERS = ['**/testing', '**/testing/**'];

function productionOnly(excludedPaths: string[]): PatternOptions {
  return {
    except: { withName: ['*.spec.ts', '*.spec.tsx'], inFolder: TEST_FOLDERS, inPath: excludedPaths },
  };
}

/**
 * Arquivos de produção cujo caminho casa com `pathPattern` (glob a partir de
 * `frontend/`), sem os que casarem com `excludedPaths`.
 */
export function productionFiles(pathPattern: string, excludedPaths: string[] = []) {
  return projectFiles().inPath(pathPattern, productionOnly(excludedPaths));
}

// Como `productionFiles`, mas pela pasta. Use para "arquivos da pasta X em
// qualquer profundidade": o ArchUnitTS não casa caminhos com dois globstars
// (inPath('src/*/domain/**/errors/**') seleciona zero arquivos), enquanto
// inFolder('src/*/domain/**/errors') funciona.
export function productionFilesInFolder(folderPattern: string, excludedPaths: string[] = []) {
  return projectFiles().inFolder(folderPattern, productionOnly(excludedPaths));
}

/** Nome completo do arquivo, com extensão (o `FileInfo.name` vem sem ela). */
export function fileNameOf(file: FileInfo): string {
  return file.path.split('/').at(-1) ?? '';
}

/** Nome da pasta que contém o arquivo (`src/a/b/c.ts` → `b`). */
export function parentFolderOf(file: FileInfo): string {
  return file.directory.split('/').filter((segment) => segment !== '').at(-1) ?? '';
}

/** Especificadores dos imports e re-exports estáticos de um arquivo. */
export function importSpecifiers(file: FileInfo): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  for (const match of file.content.matchAll(pattern)) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Pacote npm de um especificador (`@tanstack/react-query/x` → `@tanstack/react-query`), ou `null` se for interno. */
export function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.')) return null;
  const [scopeOrName, name] = specifier.split('/');
  return specifier.startsWith('@') ? `${scopeOrName}/${name}` : (scopeOrName ?? specifier);
}
