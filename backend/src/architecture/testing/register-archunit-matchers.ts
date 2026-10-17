import { extendVitestMatchers } from 'archunit';

/**
 * Registra o matcher `toPassAsync` do ArchUnitTS de forma explícita (em vez
 * de depender do efeito colateral do import), antes dos testes de arquitetura.
 */
extendVitestMatchers();
