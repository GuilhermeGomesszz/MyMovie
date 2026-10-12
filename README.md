# MyMovie

Uma plataforma para descobrir filmes, organizar o que você quer assistir e trocar recomendações com outros fãs. O catálogo, os pôsteres, as sinopses e os gêneros são consultados **diretamente na API do TMDB**; filmes não são pré-carregados no banco.

> O banco guarda somente os títulos que as pessoas escolhem adicionar à lista ou sobre os quais publicam uma avaliação ou comentário.

## O que já dá para fazer

- Explorar filmes populares, mais bem avaliados e organizados por gênero.
- Buscar por título e descobrir sugestões do TMDB enquanto digita.
- Ver detalhes do filme, imagem, sinopse, ano, duração, gêneros e nota do TMDB.
- Criar uma conta, manter uma lista pessoal e atualizar o status: quero assistir, assistindo, já assisti ou abandonei.
- Avaliar filmes, recomendar para outras pessoas, comentar e responder comentários.
- Receber recomendações personalizadas com base nos gêneros e nas avaliações dos filmes da sua lista.
- Consultar sugestões de gênero influenciadas por buscas anteriores.
- Usar uma interface adaptada a telas grandes e celulares.

## Tecnologias

- Node.js, Express e JavaScript (ES modules)
- PostgreSQL e Prisma ORM
- API v3 do [The Movie Database (TMDB)](https://developer.themoviedb.org/docs)
- HTML, CSS e JavaScript no frontend, servido pelo Express

## Requisitos

- Node.js 20 ou superior
- npm
- Banco PostgreSQL acessível pela aplicação
- Chave de API do TMDB

## Configuração local

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/GuilhermeGomesszz/MyMovie.git
   cd MyMovie
   ```

2. Instale as dependências:

   ```bash
   npm ci
   ```

3. Crie seu arquivo local de configuração:

   ```bash
   cp .env.example .env
   ```

   No PowerShell do Windows, use:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Edite `.env` com a URL do PostgreSQL, um segredo JWT exclusivo e uma credencial TMDB:

   ```dotenv
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST:5432/BANCO?sslmode=require"
   JWT_SECRET="gere-um-segredo-longo-e-aleatorio"
   JWT_EXPIRES_IN="7d"
   API_KEY="sua-chave-da-api-tmdb"
   ```

   A aplicação também reconhece `TMDB_API_KEY` no lugar de `API_KEY`, ou `TMDB_ACCESS_TOKEN` para um token de leitura. A credencial é usada **somente no servidor**: nunca a coloque no frontend, em commits ou em capturas de tela.

5. Aplique as migrations e gere o Prisma Client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

   As migrations criam as tabelas e os índices necessários. O PostgreSQL precisa permitir a extensão `pg_trgm`, utilizada para acelerar a busca textual. **Não é necessário executar seed para popular o catálogo.**

6. Inicie a aplicação:

   ```bash
   npm run dev
   ```

7. Abra [http://localhost:3000](http://localhost:3000).

Para iniciar sem o recarregamento automático de desenvolvimento:

```bash
npm start
```

## Como o catálogo funciona

O navegador pede ao backend as listas, os detalhes, as categorias e os resultados de pesquisa. O backend consulta o TMDB usando a credencial guardada no ambiente do servidor. Assim, explorar ou pesquisar filmes **não popula a tabela `Movie`**.

Quando uma pessoa escolhe **Adicionar à minha lista**, o backend importa aquele título individualmente e o associa à lista do usuário. Avaliações e comentários também precisam de um registro local; se o título ainda não tiver sido salvo, a aplicação o importa naquele momento. A chave TMDB do filme é única no banco para impedir duplicações.

## Busca e recomendações

A busca combina resultados do TMDB com os filmes que já foram salvos localmente. PostgreSQL mantém índices trigram para título e sinopse e um índice GIN para gêneros. Os eventos de busca guardam a expressão normalizada e os gêneros dos resultados para destacar tendências em consultas futuras.

As recomendações consultam os gêneros e as avaliações da lista pessoal e pedem ao TMDB filmes relacionados. Elas não dependem de um catálogo local pré-carregado.

## API principal

Todas as rotas abaixo são relativas a `http://localhost:3000`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/register` | Público | Criar uma conta |
| `POST` | `/auth/login` | Público | Entrar e receber a sessão |
| `POST` | `/auth/logout` | Público | Encerrar a sessão |
| `GET` | `/auth/me` | Público/sessão | Consultar a conta atual |
| `GET` | `/movie/discover?sort=popular` | Público | Descobrir filmes (`popular`, `top_rated` ou `upcoming`) |
| `GET` | `/movie/search?q=matrix` | Público/sessão | Buscar filmes no TMDB e no banco |
| `GET` | `/movie/categories` | Público | Consultar gêneros do TMDB |
| `GET` | `/movie/tmdb/:tmdbId` | Público | Consultar detalhes de um filme no TMDB |
| `POST` | `/movie/import/:tmdbId` | Autenticado | Salvar um único filme selecionado |
| `GET` | `/movie/recommendations` | Autenticado | Obter recomendações pessoais |
| `GET` | `/watchlist` | Autenticado | Consultar a lista pessoal |
| `POST` | `/watchlist` | Autenticado | Adicionar um filme salvo à lista |
| `PUT` | `/watchlist/:id` | Autenticado | Atualizar status, nota ou anotações |
| `DELETE` | `/watchlist/:id` | Autenticado | Remover um item da lista |
| `GET` | `/movie/:movieId/reviews` | Público | Consultar avaliações da comunidade |
| `PUT` | `/movie/:movieId/reviews` | Autenticado | Criar ou atualizar uma avaliação |
| `DELETE` | `/movie/:movieId/reviews` | Autenticado | Remover a própria avaliação |
| `GET` | `/movie/:movieId/comments` | Público | Consultar comentários e respostas |
| `POST` | `/movie/:movieId/comments` | Autenticado | Publicar comentário ou resposta |
| `DELETE` | `/movie/:movieId/comments/:commentId` | Autenticado | Remover o próprio comentário |

O backend aceita a sessão em cookie HTTP-only e o token Bearer emitido no login. As rotas autenticadas exigem uma sessão válida.

## Estrutura

```text
.
├── config/        # Conexão PostgreSQL/Prisma
├── Controller/    # Controladores da API
├── middlesware/   # Autenticação
├── prisma/        # Schema e migrations
├── public/        # Frontend responsivo
├── routes/        # Rotas Express
├── services/      # Integração com o TMDB
├── utils/         # Utilitários, incluindo JWT
└── validators/    # Validação de payloads
```

## Segurança e configuração

- `.env` e credenciais locais são ignorados pelo Git. Use `.env.example` como referência, sem inserir valores reais.
- Configure `JWT_SECRET` com um valor forte, aleatório e diferente entre ambientes.
- Em produção, use HTTPS e configure `NODE_ENV=production` para ativar a opção segura do cookie.
- Não exponha `DATABASE_URL`, `API_KEY`, `TMDB_API_KEY`, `TMDB_ACCESS_TOKEN` ou `JWT_SECRET` em issues, logs públicos ou commits.

## Créditos

Os metadados, as imagens e as informações do catálogo são fornecidos pelo [TMDB](https://www.themoviedb.org/). Este projeto não é endossado nem certificado pelo TMDB.
