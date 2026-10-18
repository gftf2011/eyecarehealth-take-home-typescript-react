import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Telas inteiras (sessão restaurada + consultas) passam de 1 s com a suíte toda
// rodando em paralelo; as asserções continuam esperando pela mesma condição.
configure({ asyncUtilTimeout: 3_000 });

// Sem `globals`, o Testing Library não desmonta sozinho entre os testes.
afterEach(() => {
  cleanup();
});
