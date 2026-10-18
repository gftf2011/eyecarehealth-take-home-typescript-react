import styles from './skeleton.module.css';

/** Bloco de carregamento com o formato do conteúdo que vai chegar. */
export function Skeleton({ width = '100%', height = '1rem' }: { readonly width?: string; readonly height?: string }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}
