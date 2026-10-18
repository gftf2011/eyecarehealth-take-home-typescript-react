import { Link } from 'react-router';

import { Alert } from '../../../shared-kernel/presentation';

export function NotFoundPage() {
  return (
    <Alert tone="warning" title="Página não encontrada">
      O endereço não existe. <Link to="/">Voltar ao início</Link>
    </Alert>
  );
}
