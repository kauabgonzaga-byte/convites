# Site de casamento — versão para Vercel

Esta versão foi convertida para Vercel Functions em Node.js. Ela não depende de PHP, arquivos JSON graváveis ou armazenamento local do servidor.

## O que está incluído

- Página pública estática em `public/`.
- APIs Node em `api/` para presentes, confirmações e painel administrativo.
- Neon Postgres para os dados e reservas com limite atômico.
- Vercel Blob para fotos dos presentes.
- Login administrativo com cookie assinado.

## Publicar pelo GitHub e Vercel

1. Crie um repositório GitHub vazio.
2. Envie **o conteúdo desta pasta** para o repositório. Não envie o arquivo ZIP como único arquivo.
3. Na Vercel, clique em **Add New → Project** e importe esse repositório. Se o repositório também contiver outras pastas, defina `convites` como **Root Directory**. Mantenha as demais configurações padrão: o projeto detecta `package.json`, publica `public/` e disponibiliza as Functions em `api/` automaticamente.
4. No projeto Vercel, abra **Storage → Browse Marketplace** e conecte **Neon**. A integração adiciona uma URL de banco ao projeto. Se o nome adicionado for `POSTGRES_URL`, o projeto já o reconhece; se preferir, crie `DATABASE_URL` com a mesma URL.
5. Ainda em **Storage**, crie/conecte um **Vercel Blob Store**. Isso adiciona `BLOB_READ_WRITE_TOKEN` automaticamente.
6. Em **Settings → Environment Variables**, adicione para Production, Preview e Development:
   - `ADMIN_USERNAME` — usuário do painel.
   - `ADMIN_PASSWORD` — senha do painel.
   - `SESSION_SECRET` — chave aleatória de pelo menos 32 caracteres.
7. Faça um novo deploy. Na primeira visita, as 12 sugestões iniciais são criadas automaticamente no banco.

O painel fica em `https://seu-dominio.vercel.app/admin/login.html`.

## Acesso administrativo e domínio

- O usuário e a senha do painel são os valores definidos em `ADMIN_USERNAME` e `ADMIN_PASSWORD` nas variáveis de ambiente da Vercel. Eles não ficam gravados no código.
- O login é feito em `https://seu-dominio/admin/login.html`; após entrar, o painel fica em `https://seu-dominio/admin/` e a sessão vale por 8 horas.
- Para usar um domínio próprio, abra **Settings → Domains** no projeto Vercel, adicione o domínio comprado e configure no provedor de domínio os registros DNS indicados pela Vercel. Depois que o domínio estiver verificado, ele passa a atender tanto o convite quanto o painel administrativo.

## Observações

- Fotos aceitam JPG, PNG, WEBP ou GIF de até 4 MB.
- Cada presente possui um limite de escolhas configurável. Com limite `2`, duas pessoas conseguem escolhê-lo; a terceira recebe indisponível.
- A reserva e a confirmação são gravadas em uma única operação no banco, evitando ultrapassar o limite mesmo com acessos simultâneos.
- Ao remover uma confirmação pelo painel, o presente não é liberado automaticamente. Use **Liberar** no presente para zerar as escolhas dele.
- Nunca envie `.env`, credenciais ou tokens ao GitHub. O arquivo `.env.example` é somente um modelo.
- Antes de publicar, você pode executar `npm install` e `npm run check` dentro desta pasta para validar a sintaxe dos arquivos do projeto.
