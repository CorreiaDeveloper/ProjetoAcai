# Ganath Açaí: site de pedidos do condomínio

O morador monta o copo, coloca na sacola, informa nome, prédio e apartamento, e o pedido chega pronto no WhatsApp da loja.

## Como ver o site

Dê dois cliques em `index.html`. Ele abre no navegador e funciona sem instalar nada.

## O que editar (tudo em `js/config.js`)

| O quê | Onde |
|---|---|
| Número que recebe os pedidos | `whatsapp`: 55 + DDD + número, só dígitos |
| Número que aparece no rodapé | `telefoneExibicao` |
| Endereço | `endereco` |
| Horário de funcionamento | `horario` (deixe `""` para não mostrar) |
| Taxa de entrega | `taxaEntrega` (`0` = grátis) |
| Perguntar a forma de pagamento | `formasPagamento`: deixe `[]` para não perguntar, ou ex.: `["Pix", "Dinheiro"]` |
| Preço dos copos | `tamanhos` |
| Preço de cada fruta ou acompanhamento | `preco` dentro de `frutas` e `acompanhamentos` |
| Combinações prontas ("clássicos") | `classicos` |

Os preços usam ponto, não vírgula: `14.90`.

Se `formasPagamento` tiver `"Dinheiro"`, o site também pergunta "troco para quanto?".

Para incluir uma fruta nova, copie uma linha de `frutas`, troque `id`, `nome`, `preco` e coloque uma foto quadrada em `img/`. O ideal é a foto da fruta ocupando a imagem inteira, vista de cima.

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

Depois de publicar, troque `img/copo.webp` na linha `og:image` do `index.html` pelo endereço completo (ex.: `https://seusite.com/img/copo.webp`). Assim a foto aparece quando o link for compartilhado no grupo do condomínio.

## Estrutura

```
index.html        página
css/style.css     visual
js/config.js      preços, número, endereço  ← o que você edita
js/app.js         funcionamento (copo, abas, sacola, mensagem do WhatsApp)
img/              fotos (geradas no ComfyUI com FLUX.2 Klein)
logo/             logo em PNG e página de visualização
```
