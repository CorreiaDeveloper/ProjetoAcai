# Ganath Açaí: site de pedidos do condomínio

O morador monta o copo, coloca na sacola, informa nome, torre e apartamento, e o pedido chega pronto no WhatsApp da loja.

## Como ver o site

Dê dois cliques em `index.html`. Ele abre no navegador e funciona sem instalar nada.

## O que editar (tudo em `js/config.js`)

| O quê | Onde |
|---|---|
| Número que recebe os pedidos | `whatsapp`: 55 + DDD + número, só dígitos |
| Número que aparece no rodapé | `telefoneExibicao` |
| Endereço | `endereco` |
| Texto opcional sobre horário | `horario` (deixe `""` para não mostrar) |
| Aviso "Aberto agora" / "Fechado" | **no painel**, pelo botão "Loja ABERTA / FECHADA" (não fica mais no arquivo) |
| Taxa de entrega | `taxaEntrega` (`0` = grátis) |
| Perguntar a forma de pagamento | `formasPagamento`: deixe `[]` para não perguntar, ou ex.: `["Pix", "Dinheiro"]` |
| Preço dos copos | `tamanhos` |
| Preço de cada fruta ou acompanhamento | `preco` dentro de `frutas` e `acompanhamentos` |
| Combinações prontas ("clássicos") | `classicos` |

Os preços usam ponto, não vírgula: `14.90`.

Se `formasPagamento` tiver `"Dinheiro"`, o site também pergunta "troco para quanto?".

Para incluir uma fruta nova, copie uma linha de `frutas`, troque `id`, `nome`, `preco` e coloque uma foto quadrada em `img/`. O ideal é a foto da fruta ocupando a imagem inteira, vista de cima.

## Recursos do site

- **Aberto / fechado:** vocês abrem e fecham a loja pelo botão do painel, e o site mostra "Aberto agora" ou "Fechado no momento". Com a loja fechada, o cliente ainda pode mandar o pedido: ele chega marcado no WhatsApp e no painel, e o cliente é avisado de que vocês respondem quando abrirem.
- **Sacola esvazia ao enviar:** quando a pessoa toca em "Enviar pedido pelo WhatsApp", a sacola fica vazia. Nome, Torre e apartamento continuam lembrados para o próximo pedido.
- **Pedir de novo:** o celular de cada morador lembra o último pedido, que pode ser repetido com um toque.
- **Festa de frutas:** quando a pessoa volta do WhatsApp depois de enviar, as frutas do pedido "explodem" na tela.
- **Aplicativo:** pelo menu do navegador, "Adicionar à tela inicial" cria o ícone da Ganath no celular (arquivo `manifest.webmanifest`).
- **Código do pedido:** cada pedido ganha um código curto (ex.: `#K7QA`) que aparece no WhatsApp e no painel.
- **Cupom de desconto:** o cliente digita o cupom na sacola, e o site confere no banco antes de dar o desconto.
- **Esgotados:** o que vocês marcam como esgotado no painel fica cinza no site, com "Esgotado" no lugar do preço, e não dá para escolher. Os clássicos que levam esse item ficam desligados. Se o item estava no copo que a pessoa montava, ele sai, e ela é avisada. Se já estava na sacola, o copo mostra "Morango esgotou agora" com o botão "Tirar do copo", e o pedido só vai depois disso.

## Painel de pedidos

Endereço: **https://ganath.vercel.app/painel/** (no computador e no celular, com um único login para vocês dois).

- **Loja ABERTA / FECHADA:** é o botão no topo. Toque, confirme, e o site muda na hora. Se o outro aparelho estiver com o painel aberto, ele também atualiza sozinho. O site não mostra desde quando a loja está fechada, só se está aberta ou não.
- **Pedidos:** chegam na hora, com som, numa lista em linhas por ordem de chegada (nº do pedido, horário, nome, torre e apto). Ao clicar na linha, ela mostra o que o cliente escolheu (tamanho, frutas e complementos), a forma de pagamento (com o troco) e o total. Cada pedido passa por Novos → Montando → Prontos para entregar → Entregue. No menu ⋯ dá para voltar, cancelar ou apagar o pedido.
- **Histórico:** os pedidos das últimas 2 semanas, um por linha (código, dia e horário, nome, apto e valor), com o total do período. Ao clicar, mostra os detalhes do pedido. É só para consulta.
- **Montagem do copo:** o botão "Montagem" mostra as 5 camadas, de baixo para cima: recheio, açaí, recheio, açaí, recheio, e a observação do cliente. O açaí nunca vai no fundo.
  - **Fundo:** caldas + pós.
  - **Meio:** frutas + caldas.
  - **Topo:** pós + balas, confete e crocantes.
  - Em quais camadas cada item vai está no começo de `painel/painel.js` (`CAMADAS_DO_ITEM`).
- **Cupons:** criar, ligar/desligar, apagar e copiar o convite para mandar no WhatsApp. Pode ter porcentagem ou valor em reais, pedido mínimo, data final e limite de usos.
  - **"Cada cliente só pode usar uma vez"** (vem marcado): o cupom vale uma vez por apartamento.
  - O banco confere pela torre e pelo apartamento, entendendo "Torre 2 / Apto 34" e "2 / 034" como o mesmo lugar. O celular também lembra.
  - Pedido cancelado devolve o cupom para aquele apartamento.
  - Desmarque a caixinha para o cupom poder ser repetido.
- **Esgotados:** a aba mostra todas as frutas e complementos. Toque no que acabou: fica vermelho, "Esgotado", e some do site em até 30 segundos (na hora para quem abre a sacola). Toque de novo quando chegar. "Chegou tudo" volta tudo de uma vez.
  - O número vermelho na aba lembra quantos itens estão fora.
  - Ao abrir a loja, o painel lembra o que ainda está marcado como esgotado.
- **No celular:** "Adicionar à tela inicial" cria o ícone "Painel". O botão "Manter tela acesa" evita que a tela apague na bancada.

Os pedidos ficam no **Supabase** (plano grátis). O WhatsApp continua sendo o caminho principal: se o banco cair, o pedido chega pelo WhatsApp do mesmo jeito.

- **Conexão:** a chave que fica no `js/config.js` (bloco `painel`) é pública. Quem protege os dados são as regras do banco:
  - o site só consegue **adicionar** pedidos e **conferir** um cupom;
  - ver, mudar e apagar exige o login da equipe.
- **Atenção:** o projeto grátis do Supabase pausa se ficar uma semana sem uso. Se isso acontecer, entre em supabase.com e clique em "Restore".

### Segurança do painel

Para entrar no painel são necessárias **duas etapas**: a senha **e** o código de 6 números do app autenticador (Google Authenticator, Microsoft Authenticator ou Authy). O mesmo QR code fica cadastrado nos dois celulares.

- **Quem barra é o banco, não a página.** Sem o código do autenticador **autorizado**, o banco não mostra nem altera nada, mesmo para quem sabe a senha.
- **Celular de invasor não serve.** Se alguém com a senha cadastrar outro autenticador, ele não funciona.
- **Valor conferido.** O painel recalcula cada pedido pelo cardápio e marca "Conferir valor" se o total não bater.
- **Perdeu um celular?** No painel, clique em **"Desconectar todos os aparelhos"** (no fim da página). O acesso cai na hora em todos os aparelhos. Depois, troque a senha.
- **Perdeu os DOIS celulares** (ou trocou de celular sem passar o autenticador):
  1. Supabase → **Authentication → Users** → seu usuário → apague o fator de MFA.
  2. **SQL Editor** → rode `update private.equipe set fator_id = null;`
  3. Entre no painel: ele mostra um QR code novo para cadastrar de novo.
- **Dica:** a "chave" em texto que aparece junto do QR code funciona como cópia de segurança. Se quiser guardar, anote **no papel** e deixe em casa. Não guarde em foto nem na nuvem.

## Logo

Na pasta `logo/`:

- `ganath-acai-original.jpg`: a logo como veio, com fundo branco
- `ganath-acai-transparente.png`: sem fundo, para usar sobre fundos claros
- `ganath-acai-fundo-escuro.png`: sem fundo, com texto creme, para usar sobre fundos escuros (é a usada no site)
- `ganath-acai-perfil-roxo.png`: quadrada (1080×1080) sobre o roxo do site, pronta para a foto de perfil do WhatsApp e do Instagram

A pasta `logo/alternativa-claude/` guarda a logo alternativa (o copo em traço). Abra o `index.html` dessa pasta para vê-la.

Os arquivos usados pelo site ficam em `img/`: `logo-nome.webp` (topo), `logo.webp` (rodapé) e `icone-64.png` / `icone-180.png` (ícone da aba e da tela inicial do celular).

## Como publicar (de graça)

O site é só HTML, CSS e JavaScript, sem servidor. Qualquer uma destas opções serve:

- **Netlify Drop:** acesse app.netlify.com/drop e arraste a pasta inteira do projeto.
- **GitHub Pages** ou **Vercel:** suba a pasta como um repositório.

O site está publicado na Vercel, em **https://ganath.vercel.app/**. Cada envio para a branch `main` do GitHub atualiza o site sozinho em menos de 1 minuto.

A imagem que aparece quando o link é compartilhado é `img/compartilhar.jpg`. Se um dia o site mudar de endereço, atualize as linhas `og:url` e `og:image` no `index.html`.

## Estrutura

```
index.html        página
css/style.css     visual
js/config.js      preços, número, endereço  ← o que você edita
js/app.js         funcionamento (copo, abas, sacola, mensagem do WhatsApp)
painel/           painel de pedidos e cupons (com login)
img/              fotos (geradas no ComfyUI com FLUX.2 Klein)
logo/             logo em PNG e página de visualização
```
