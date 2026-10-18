import type { ReactNode } from 'react';

import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';

export type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: 'danger' | 'primary';
  readonly pending?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/** Confirmação antes de uma ação difícil de desfazer (ex.: cancelar pedido, excluir produto). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      role="alertdialog"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
