import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';

/**
 * Onde e como falar com a AWS. Sem `endpoint`, os clientes usam a AWS de
 * verdade; com ele (`AWS_ENDPOINT_URL`), um emulador local (Floci). As
 * credenciais vêm da cadeia padrão do SDK (variáveis, perfil, IAM role).
 */
export type AwsClientConfig = {
  readonly region: string;
  readonly endpoint?: string | undefined;
  /** Só para testes; em produção, a cadeia padrão do SDK. */
  readonly credentials?: { readonly accessKeyId: string; readonly secretAccessKey: string };
};

/** O relay já tenta de novo com backoff: uma retentativa interna basta. */
const MAX_SDK_ATTEMPTS = 2;

export function createSnsClient({ region, endpoint, credentials }: AwsClientConfig): SNSClient {
  return new SNSClient({
    region,
    maxAttempts: MAX_SDK_ATTEMPTS,
    ...(endpoint !== undefined && { endpoint }),
    ...(credentials !== undefined && { credentials }),
  });
}

export function createSqsClient({ region, endpoint, credentials }: AwsClientConfig): SQSClient {
  return new SQSClient({
    region,
    maxAttempts: MAX_SDK_ATTEMPTS,
    // O emulador devolve URLs de fila com o host dele (`localhost`), que de
    // outro contêiner não resolve: as chamadas vão sempre ao `endpoint`.
    ...(endpoint !== undefined && { endpoint, useQueueUrlAsEndpoint: false }),
    ...(credentials !== undefined && { credentials }),
  });
}
