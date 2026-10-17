import { projectFiles, type FileInfo, type PatternOptions } from 'archunit';

/** Bounded contexts: módulos de negócio independentes entre si. */
export const BOUNDED_CONTEXTS = ['catalog', 'delivery', 'identity', 'ordering', 'reporting', 'realtime'] as const;

export type BoundedContext = (typeof BOUNDED_CONTEXTS)[number];

/**
 * Código de produção: os testes (`*.spec.ts`) e o apoio a testes (pastas
 * `testing/`) podem atravessar camadas e contextos para montar cenários.
 */
const TEST_FOLDERS = ['**/testing', '**/testing/**'];

function productionOnly(excludedPaths: string[]): PatternOptions {
  return { except: { withName: '*.spec.ts', inFolder: TEST_FOLDERS, inPath: excludedPaths } };
}

/**
 * Arquivos de produção cujo caminho casa com `pathPattern` (glob a partir de
 * `backend/`), sem os que casarem com `excludedPaths`.
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

/** Pacote npm de um especificador (`@fastify/cookie/x` → `@fastify/cookie`), ou `null` se for interno. */
export function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('node:')) return null;
  const [scopeOrName, name] = specifier.split('/');
  return specifier.startsWith('@') ? `${scopeOrName}/${name}` : (scopeOrName ?? specifier);
}
