import { useState, type FormEvent } from 'react';

import { InputValidationError } from '../../../../shared-kernel/application';
import { Alert, SelectField, Switch, TextAreaField, TextField, errorMessage } from '../../../../shared-kernel/presentation';
import { productFormErrors, type ProductFormField, type ProductFormInput } from '../../../application';
import { PRODUCT_CATEGORIES } from '../../../domain';
import { CATEGORY_LABELS } from '../../labels/product-labels';
import styles from './product-form.module.css';

export type ProductFormProps = {
  /** `id` do `<form>`, para o botão de salvar ficar no rodapé do modal. */
  readonly id: string;
  readonly initialValue: ProductFormInput;
  readonly onSubmit: (input: ProductFormInput) => void;
  /** Falha do último envio (validação da API, 404, rede). */
  readonly error?: unknown;
};

const FIELDS: readonly ProductFormField[] = ['name', 'description', 'price', 'category', 'preparationTime', 'imageUrl'];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Selecione…' },
  ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

/**
 * Formulário de produto com validação em tempo real pelas mesmas regras da
 * API (Value Objects): o erro de um campo aparece assim que ele é visitado e
 * some enquanto a pessoa corrige. Erros por campo vindos da API caem no campo.
 */
export function ProductForm({ id, initialValue, onSubmit, error = null }: ProductFormProps) {
  const [values, setValues] = useState(initialValue);
  const [touched, setTouched] = useState<ReadonlySet<ProductFormField>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const clientErrors = productFormErrors(values);
  const serverErrors = error instanceof InputValidationError ? error.messagesByField() : {};
  const formError = error === null || error instanceof InputValidationError ? null : error;

  const fieldError = (field: ProductFormField): string | undefined =>
    submitted || touched.has(field) ? (clientErrors[field] ?? serverErrors[field]) : undefined;

  const bind = (field: ProductFormField) => ({
    name: field,
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
    onBlur: () => setTouched((current) => new Set(current).add(field)),
    error: fieldError(field),
  });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalid = FIELDS.find((field) => clientErrors[field] !== undefined);
    if (firstInvalid !== undefined) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    onSubmit(values);
  };

  const showPreview = values.imageUrl.trim() !== '' && clientErrors.imageUrl === undefined;

  return (
    <form id={id} className={styles.form} onSubmit={submit} noValidate>
      {formError === null ? null : <Alert tone="error">{errorMessage(formError)}</Alert>}

      <TextField label="Nome" autoComplete="off" placeholder="X-Burger Especial" {...bind('name')} />
      <TextAreaField label="Descrição" rows={3} maxLengthHint={500} {...bind('description')} />

      <div className={styles.row}>
        <TextField label="Preço (R$)" inputMode="decimal" placeholder="32,90" {...bind('price')} />
        <SelectField label="Categoria" options={CATEGORY_OPTIONS} {...bind('category')} />
        <TextField
          label="Preparo (min)"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          placeholder="15"
          {...bind('preparationTime')}
        />
      </div>

      <div className={styles.imageRow}>
        <TextField label="URL da imagem (opcional)" type="url" placeholder="https://…" {...bind('imageUrl')} />
        {showPreview ? <img className={styles.preview} src={values.imageUrl.trim()} alt="Pré-visualização" /> : null}
      </div>

      <Switch
        checked={values.isAvailable}
        label="Disponível para pedidos"
        visibleLabel="Disponível para pedidos"
        onChange={(isAvailable) => setValues((current) => ({ ...current, isAvailable }))}
      />
    </form>
  );
}
