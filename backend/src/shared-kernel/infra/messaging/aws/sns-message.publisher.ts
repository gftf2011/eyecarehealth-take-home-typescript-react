import { GetTopicAttributesCommand, PublishCommand, type SNSClient } from '@aws-sdk/client-sns';

import { BrokerUnavailableError, type MessagePublisher, type PublishedMessage } from '../../../application';
import { toMessageEnvelope } from '../message-envelope';

/** Atributo SNS com o tópico lógico: filtra o que cada fila assinante recebe. */
export const TOPIC_ATTRIBUTE = 'topic';

/**
 * Recusas que dependem da mensagem (tamanho, atributos inválidos): repetir
 * não adianta, e elas contam para a fila morta do outbox. Todo o resto —
 * rede, throttling, 5xx, credenciais — é falha do broker, transitória.
 */
const MESSAGE_REJECTIONS: ReadonlySet<string> = new Set([
  'InvalidParameterException',
  'InvalidParameterValueException',
  'ValidationException',
]);

/**
 * Publica no tópico SNS de eventos da aplicação. Cada fila assinante (hoje, a
 * do tempo real) recebe sua cópia, com retentativa e fila morta próprias.
 */
export class SnsMessagePublisher implements MessagePublisher {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
  ) {}

  async publish(message: PublishedMessage): Promise<void> {
    const command = new PublishCommand({
      TopicArn: this.topicArn,
      Message: JSON.stringify(toMessageEnvelope(message)),
      MessageAttributes: { [TOPIC_ATTRIBUTE]: { DataType: 'String', StringValue: message.topic } },
    });
    try {
      await this.sns.send(command);
    } catch (error) {
      if (error instanceof Error && MESSAGE_REJECTIONS.has(error.name)) throw error;
      throw new BrokerUnavailableError({ cause: error });
    }
  }

  /** Lança se o tópico não existir ou o SNS não responder (boot e health check). */
  async ping(): Promise<void> {
    await this.sns.send(new GetTopicAttributesCommand({ TopicArn: this.topicArn }));
  }
}
