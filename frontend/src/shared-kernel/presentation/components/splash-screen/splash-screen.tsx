import { Spinner } from '../spinner/spinner';
import styles from './splash-screen.module.css';

/** Tela cheia de carregamento (ex.: restaurando a sessão ao abrir o painel). */
export function SplashScreen({ message = 'Carregando o painel…' }: { readonly message?: string }) {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <Spinner size="lg" label={null} />
      <p>{message}</p>
    </div>
  );
}
