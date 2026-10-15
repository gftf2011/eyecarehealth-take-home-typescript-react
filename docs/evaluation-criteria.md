# Criterios de Avaliacao — Desafio FastMeals

Este documento detalha os criterios de avaliacao e o que diferencia cada nivel de entrega.

---

## 1. Qualidade e Organizacao do Codigo (20%)

### O que sera avaliado

- Estrutura de pastas e separacao de responsabilidades
- Nomeacao de variaveis, funcoes, arquivos e modulos
- Uso correto de TypeScript (tipagem estrita, sem `any`, interfaces bem definidas)
- Reutilizacao de codigo e DRY (Don't Repeat Yourself)
- Consistencia de estilo ao longo do projeto

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Uso de `any`, arquivos com responsabilidades misturadas, nomes genericos            |
| Basico       | Tipagem parcial, estrutura basica mas funcional, alguns `any` justificados          |
| Bom          | Tipagem completa, boa separacao de camadas, codigo legivel e consistente            |
| Excelente    | Tipagem avancada (generics, discriminated unions), design patterns quando pertinente, codigo auto-documentado |

---

## 2. Modelagem de Banco de Dados (15%)

### O que sera avaliado

- Normalizacao adequada (ate 3FN)
- Escolha correta de tipos de dados
- Indices para queries frequentes
- Integridade referencial (foreign keys, constraints)
- Migrations organizadas e reproduziveis

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Dados desnormalizados, sem constraints, sem indices                                 |
| Basico       | Schema funcional com FK, tipos corretos, sem indices de performance                 |
| Bom          | Schema normalizado, indices nas colunas corretas, constraints de validacao           |
| Excelente    | Indices compostos para relatorios, trigger para updated_at, migration strategy clara |

---

## 3. Design e Implementacao da API (15%)

### O que sera avaliado

- Adesao ao padrao REST
- Codigos HTTP semanticamente corretos
- Validacao robusta de entrada
- Formato padronizado de erros
- Paginacao, filtros e ordenacao
- Autenticacao e autorizacao corretas
- Rate limiting

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Rotas desorganizadas, sem validacao, codigos HTTP incorretos                        |
| Basico       | Rotas REST, validacao basica, autenticacao funcionando                               |
| Bom          | Validacao completa com Zod/Joi, erros padronizados, paginacao, rate limiting        |
| Excelente    | API idiomatica, tratamento de edge cases, logs estruturados, documentacao (Swagger) |

---

## 4. Funcionalidade do Frontend (15%)

### O que sera avaliado

- Todas as telas implementadas e funcionais
- Gerenciamento de estado (Context API, Zustand, Redux — justificado)
- UX: feedback de loading, erros, estados vazios
- Responsividade (desktop no minimo, mobile e diferencial)
- Componentizacao e reutilizacao

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Telas incompletas, sem tratamento de loading/erro, layout quebrado                  |
| Basico       | Telas funcionais, estado gerenciado, UX minimamente aceitavel                       |
| Bom          | Boa componentizacao, feedback visual completo, formularios com validacao em tempo real |
| Excelente    | Animacoes sutis, skeleton loading, acessibilidade, tema consistente, custom hooks bem estruturados |

---

## 5. Algoritmo de Otimizacao (15%)

### O que sera avaliado

- Implementacao correta da formula de Haversine
- Abordagem algoritmica para o problema de atribuicao
- Complexidade computacional razoavel
- Tratamento de edge cases (sem entregadores, sem pedidos, empates)
- Documentacao da abordagem no DECISIONS.md

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Haversine incorreto ou brute-force O(n!) sem justificativa                          |
| Basico       | Haversine correto + abordagem greedy simples (nearest neighbor)                     |
| Bom          | Algoritmo hungaro ou greedy otimizado, documentacao da complexidade                 |
| Excelente    | Hungarian Algorithm implementado, testes com diferentes cenarios, analise de complexidade detalhada |

### Referencia: Formula de Haversine

A distancia entre dois pontos (lat1, lon1) e (lat2, lon2) em km:

```
a = sin²((lat2 - lat1) / 2) + cos(lat1) * cos(lat2) * sin²((lon2 - lon1) / 2)
c = 2 * atan2(sqrt(a), sqrt(1 - a))
d = R * c   (onde R = 6371 km, raio medio da Terra)
```

> As latitudes e longitudes devem ser convertidas de graus para radianos antes do calculo.

---

## 6. Testes (10%)

### O que sera avaliado

- Cobertura dos cenarios mais criticos
- Qualidade dos testes (nao apenas "smoke tests")
- Testes unitarios vs. integracao (quando apropriado)
- Setup e teardown corretos (isolamento entre testes)
- Mocking adequado (sem chamar servicos externos)

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Menos de 10 testes no backend ou menos de 5 no frontend                             |
| Basico       | Quantidade minima atingida, testes cobrem happy path                                |
| Bom          | Testes de happy path + error path, bom isolamento, mocks adequados                  |
| Excelente    | Testes parametrizados, cobertura de edge cases, testes E2E com Cypress/Playwright   |

---

## 7. Documentacao — DECISIONS.md (10%)

### O que sera avaliado

- Justificativa das bibliotecas escolhidas (nao apenas "e popular")
- Explicacao clara do algoritmo de otimizacao
- Decisoes arquiteturais documentadas com pros e contras
- Dificuldades encontradas e como foram resolvidas
- Clareza e objetividade da escrita

### Niveis de entrega

| Nivel        | Descricao                                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| Insuficiente | Sem DECISIONS.md ou com conteudo generico                                           |
| Basico       | Lista de libs escolhidas com justificativa superficial                              |
| Bom          | Justificativas tecnicas, explicacao do algoritmo com complexidade, trade-offs        |
| Excelente    | ADRs (Architecture Decision Records), diagramas, alternativas consideradas, benchmarks |

---

## Diferenciais (bonus — nao obrigatorios)

Itens abaixo **nao sao requisitos**, mas serao considerados positivamente:

- [ ] WebSockets para atualizacao em tempo real do painel de pedidos
- [ ] Documentacao Swagger/OpenAPI gerada automaticamente
- [ ] CI pipeline (GitHub Actions) com lint + testes
- [ ] Testes E2E (Cypress ou Playwright)
- [ ] Responsividade mobile no frontend
- [ ] Dark mode
- [ ] Logs estruturados (Winston, Pino)
- [ ] Health check endpoint (`GET /api/health`)
- [ ] Acessibilidade (ARIA labels, navegacao por teclado)
- [ ] Animacoes e transicoes suaves no frontend
- [ ] Cache de listagens com invalidacao (Redis ou in-memory)
- [ ] Monitoramento de performance do algoritmo (metricas de tempo de execucao)

---

## Criterios Eliminatorios

Os seguintes itens resultam em **reprovacao automatica**, independente da qualidade do restante:

1. Projeto nao compila ou nao roda com as instrucoes fornecidas
2. Uso de JavaScript puro (sem TypeScript) em qualquer parte
3. Ausencia completa de testes
4. Plagio ou uso de codigo gerado por IA sem entendimento (sera verificado em entrevista tecnica)
5. Ausencia do arquivo `DECISIONS.md`
6. Banco de dados diferente de PostgreSQL
7. Vulnerabilidades de seguranca graves (SQL injection, senhas em texto puro, tokens no frontend sem httpOnly)
