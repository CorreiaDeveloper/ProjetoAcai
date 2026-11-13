/*
 * ============================================================
 *  CONFIGURAÇÃO DA LOJA
 *  Este é o único arquivo que você precisa editar no dia a dia.
 *  - Preços: use ponto no lugar da vírgula (ex.: 14.90)
 *  - Depois de salvar, é só recarregar a página.
 * ============================================================
 */
window.LOJA = {
  nome: "Ganath Açaí",

  // Número que recebe os pedidos: 55 + DDD + número, só dígitos.
  // Exemplo para (11) 98765-4321 → "5511987654321"
  whatsapp: "5511965443739",
  telefoneExibicao: "(11) 96544-3739",

  endereco: "Rua José Manoel da Fonseca Junior, 105",

  // "Aberto agora" / "Fechado" agora é pelo botão do PAINEL (não tem mais horário fixo).
  // Se quiser mostrar um texto sobre horário na página, escreva aqui. Deixe "" para não mostrar.
  // Exemplo: "Geralmente nos fins de semana, à tarde e à noite"
  horario: "",

  // Taxa de entrega em reais (0 = grátis).
  taxaEntrega: 0,

  // Formas de pagamento que o cliente escolhe no pedido.
  // Deixe a lista vazia [] para não perguntar (combina pelo WhatsApp).
  // Exemplo: ["Pix", "Dinheiro"]
  formasPagamento: ["Pix", "Dinheiro", "Cartão"],

  // Painel de pedidos (Supabase). Cada pedido enviado também aparece no painel
  // e o cliente pode usar cupom de desconto. A chave abaixo é PÚBLICA, feita para
  // ficar no site (quem protege os pedidos são as regras do banco).
  // Para desligar o painel e os cupons, apague este bloco.
  painel: {
    url: "https://gxjqlgkaunbjfgtqeted.supabase.co",
    chave: "sb_publishable_DssThRHkq6uY50thrUpN1g_xXBjmwwt",
  },

  tamanhos: [
    { id: "300", nome: "300 ml", preco: 14.9 },
    { id: "500", nome: "500 ml", preco: 19.9 },
  ],

  frutas: [
    { id: "morango", nome: "Morango", preco: 2.5, img: "img/morango.webp" },
    { id: "kiwi", nome: "Kiwi", preco: 3.0, img: "img/kiwi.webp" },
    { id: "banana", nome: "Banana", preco: 2.0, img: "img/banana.webp" },
    { id: "uva", nome: "Uva verde", preco: 2.5, img: "img/uva.webp" },
  ],

  // "calda" é a foto da calda que escorre por cima do copo (em vez de virar uma fatia).
  acompanhamentos: [
    { id: "nutella", nome: "Nutella", preco: 4.5, img: "img/nutella.webp", calda: "img/calda-nutella.webp" },
    { id: "leite-condensado", nome: "Leite condensado", preco: 2.0, img: "img/leite-condensado.webp", calda: "img/calda-leite.webp" },
    { id: "pacoca", nome: "Paçoca", preco: 2.0, img: "img/pacoca.webp" },
    { id: "sucrilhos", nome: "Sucrilhos", preco: 2.0, img: "img/sucrilhos.webp" },
    { id: "leite-ninho", nome: "Leite Ninho", preco: 3.0, img: "img/leite-ninho.webp" },
    { id: "granola", nome: "Granola", preco: 3.5, img: "img/granola.webp" },
    { id: "bala-de-goma", nome: "Bala de goma", preco: 2.5, img: "img/bala-de-goma.webp" },
    { id: "confete", nome: "Confete de chocolate", preco: 2.5, img: "img/confete.webp" },
  ],

  // Combinações prontas (um toque e o copo é montado).
  classicos: [
    { nome: "Clássico", itens: ["morango", "banana", "granola", "leite-condensado"] },
    { nome: "Paçoquinha", itens: ["banana", "pacoca", "leite-ninho", "leite-condensado"] },
    { nome: "Chocolatudo", itens: ["morango", "nutella", "confete", "leite-ninho"] },
    { nome: "Verdinho", itens: ["kiwi", "uva", "banana", "granola"] },
  ],
};
