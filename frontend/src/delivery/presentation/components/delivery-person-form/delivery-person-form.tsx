import { useState, type FormEvent } from 'react';

import { InputValidationError } from '../../../../shared-kernel/application';
import { Alert, SelectField, Switch, TextField, errorMessage } from '../../../../shared-kernel/presentation';
import {
  deliveryPersonFormErrors,
  type DeliveryPersonFormField,
  type DeliveryPersonFormInput,
} from '../../../application';
import { VEHICLE_TYPES } from '../../../domain';
import { VEHICLE_LABELS } from '../../labels/delivery-labels';
import styles from './delivery-person-form.module.css';

export type DeliveryPersonFormProps = {
  /** `id` do `<form>`, para o botão de salvar ficar no rodapé do modal. */
  readonly id: string;
  readonly initialValue: DeliveryPersonFormInput;
  readonly onSubmit: (input: DeliveryPersonFormInput) => void;
  /** Falha do último envio (validação da API, 404, rede). */
  readonly error?: unknown;
};

const FIELDS: readonly DeliveryPersonFormField[] = ['name', 'phone', 'vehicleType', 'currentLatitude', 'currentLongitude'];

const VEHICLE_OPTIONS = [
  { value: '', label: 'Selecione…' },
  ...VEHICLE_TYPES.map((vehicle) => ({ value: vehicle, label: VEHICLE_LABELS[vehicle] })),
];

/**
 * Formulário de entregador com validação em tempo real pelas mesmas regras da
 * API (Value Objects): o erro de um campo aparece assim que ele é visitado e
 * some enquanto a pessoa corrige. Erros por campo vindos da API caem no campo.
 */
export function DeliveryPersonForm({ id, initialValue, onSubmit, error = null }: DeliveryPersonFormProps) {
  const [values, setValues] = useState(initialValue);
  const [touched, setTouched] = useState<ReadonlySet<DeliveryPersonFormField>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const clientErrors = deliveryPersonFormErrors(values);
  const serverErrors = error instanceof InputValidationError ? error.messagesByField() : {};
  const formError = error === null || error instanceof InputValidationError ? null : error;

  const fieldError = (field: DeliveryPersonFormField): string | undefined =>
    submitted || touched.has(field) ? (clientErrors[field] ?? serverErrors[field]) : undefined;

  const bind = (field: DeliveryPersonFormField) => ({
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

  return (
    <form id={id} className={styles.form} onSubmit={submit} noValidate>
      {formError === null ? null : <Alert tone="error">{errorMessage(formError)}</Alert>}

      <TextField label="Nome" autoComplete="off" placeholder="Carlos Santos" {...bind('name')} />

      <div className={styles.row}>
        <TextField label="Telefone" type="tel" inputMode="tel" placeholder="(11) 91234-5678" {...bind('phone')} />
        <SelectField label="Veículo" options={VEHICLE_OPTIONS} {...bind('vehicleType')} />
      </div>

      <fieldset className={styles.location}>
        <legend className={styles.legend}>Localização atual (opcional)</legend>
        <p className={styles.hint}>Sem localização, o entregador fica fora do cálculo de distâncias da atribuição.</p>
        <div className={styles.row}>
          <TextField label="Latitude" inputMode="decimal" placeholder="-23,5489" {...bind('currentLatitude')} />
          <TextField label="Longitude" inputMode="decimal" placeholder="-46,6388" {...bind('currentLongitude')} />
        </div>
      </fieldset>

      <Switch
        checked={values.isActive}
        label="Ativo (recebe atribuições)"
        visibleLabel="Ativo (recebe atribuições)"
        onChange={(isActive) => setValues((current) => ({ ...current, isActive }))}
      />
    </form>
  );
}
