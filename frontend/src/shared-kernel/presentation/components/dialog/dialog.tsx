import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../styles/cx';
import styles from './dialog.module.css';

export type DialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'lg';
  /** `alertdialog` para confirmações (o leitor de tela anuncia como alerta). */
  readonly role?: 'dialog' | 'alertdialog';
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal acessível: `aria-modal`, título associado, foco preso dentro dele,
 * Esc e clique fora fecham, e o foco volta para quem abriu ao fechar.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  role = 'dialog',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      } else if (event.key === 'Tab') {
        trapFocus(event, panel.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={cx(styles.panel, styles[size])}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        {description === undefined ? null : (
          <div id={descriptionId} className={styles.description}>
            {description}
          </div>
        )}
        {children === undefined ? null : <div className={styles.body}>{children}</div>}
        {footer === undefined ? null : <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null): void {
  if (container === null) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
