import {
  GetQueueAttributesCommand,
  ListMessageMoveTasksCommand,
  ReceiveMessageCommand,
  StartMessageMoveTaskCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs';

import type { QueueRef } from './messaging-topology';

/** Uma mensagem morta, como aparece na listagem para investigação. */
export type DeadLetterSample = {
  readonly id: string;
  readonly body: string;
  readonly receiveCount: number;
};

export type RedriveResult = {
  readonly status: string;
  readonly moved: number;
};

const REDRIVE_POLL_MS = 500;

/**
 * Fila morta de uma fila SQS: contar, espiar e devolver as mensagens à fila
 * de origem (`StartMessageMoveTask`) depois de corrigida a causa.
 */
export class SqsDeadLetterQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly deadLetterQueue: QueueRef,
    private readonly sourceQueue: QueueRef,
  ) {}

  /** Aproximado, como todo contador do SQS. */
  async count(): Promise<number> {
    const { Attributes } = await this.sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: this.deadLetterQueue.url,
        AttributeNames: ['ApproximateNumberOfMessages'],
      }),
    );
    return Number(Attributes?.ApproximateNumberOfMessages ?? '0');
  }

  /**
   * Até 10 mensagens, sem tirá-las da fila (`VisibilityTimeout: 0`: continuam
   * visíveis para o redrive).
   */
  async peek(max = 10): Promise<DeadLetterSample[]> {
    const { Messages = [] } = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.deadLetterQueue.url,
        MaxNumberOfMessages: max,
        VisibilityTimeout: 0,
        WaitTimeSeconds: 1,
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
      }),
    );
    return Messages.map((message) => ({
      id: message.MessageId ?? '',
      body: message.Body ?? '',
      receiveCount: Number(message.Attributes?.ApproximateReceiveCount ?? '0'),
    }));
  }

  /** Devolve todas à fila de origem e espera a tarefa do SQS terminar (ou `timeoutMs`). */
  async redrive(timeoutMs = 60_000): Promise<RedriveResult> {
    const { TaskHandle } = await this.sqs.send(
      new StartMessageMoveTaskCommand({ SourceArn: this.deadLetterQueue.arn, DestinationArn: this.sourceQueue.arn }),
    );
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { Results = [] } = await this.sqs.send(
        new ListMessageMoveTasksCommand({ SourceArn: this.deadLetterQueue.arn, MaxResults: 10 }),
      );
      const task = Results.find((candidate) => candidate.TaskHandle === TaskHandle) ?? Results[0];
      const status = task?.Status ?? 'UNKNOWN';
      if (status !== 'RUNNING' || Date.now() > deadline) {
        return { status, moved: task?.ApproximateNumberOfMessagesMoved ?? 0 };
      }
      await new Promise((resolve) => setTimeout(resolve, REDRIVE_POLL_MS));
    }
  }
}
