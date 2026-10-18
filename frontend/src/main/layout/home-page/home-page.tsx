import { useCurrentSession } from '../../../identity/presentation';
import styles from './home-page.module.css';

/** Página inicial provisória: dá lugar ao painel de pedidos quando o Ordering entrar. */
export function HomePage() {
  const session = useCurrentSession();
  return (
    <section className={styles.home} aria-labelledby="home-title">
      <h1 id="home-title" className={styles.title}>
        Olá{session === null ? '' : `, ${session.user.email}`}
      </h1>
      <p className={styles.subtitle}>
        Você entrou como <strong>{session?.user.roleLabel}</strong>.
      </p>
    </section>
  );
}
