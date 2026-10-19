import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { courierIssueErrors } from '../../inputs/courier-issue.input';
import { FakeMyDeliveriesGateway } from '../../testing/fake-my-deliveries.gateway';
import { ReportMyDeliveryIssueUseCase } from './report-my-delivery-issue.usecase';

describe('ReportMyDeliveryIssueUseCase', () => {
  it('envia o motivo e a observação (em branco vira sem observação)', async () => {
    const gateway = new FakeMyDeliveriesGateway();
    const report = new ReportMyDeliveryIssueUseCase(gateway);

    await report.execute({ orderId: 'o-1', reason: 'customer_absent', note: '  ' });
    await report.execute({ orderId: 'o-2', reason: 'other', note: ' Portão fechado ' });

    expect(gateway.issues).toEqual([
      { orderId: 'o-1', reason: 'customer_absent', note: null },
      { orderId: 'o-2', reason: 'other', note: 'Portão fechado' },
    ]);
  });

  it('dados inválidos não chegam à API', async () => {
    const gateway = new FakeMyDeliveriesGateway();

    await expect(
      new ReportMyDeliveryIssueUseCase(gateway).execute({ orderId: 'o-1', reason: 'other', note: '' }),
    ).rejects.toThrow(InputValidationError);
    expect(gateway.issues).toEqual([]);
  });
});

describe('courierIssueErrors (mesmas regras da API)', () => {
  it.each([
    [{ reason: '', note: '' }, { reason: 'Escolha o motivo' }],
    [{ reason: 'other', note: '' }, { note: 'Descreva o problema quando o motivo for "outro"' }],
    [{ reason: 'refused', note: 'a'.repeat(151) }, { note: 'A observação deve ter no máximo 150 caracteres' }],
    [{ reason: 'refused', note: '' }, {}],
  ])('%j → %j', (input, errors) => {
    expect(courierIssueErrors(input)).toEqual(errors);
  });
});
