(() => {
  "use strict";

  /* ============================================================
     MONTAGEM DO COPO
     Sempre 5 camadas, de baixo para cima:
       1 Recheio (fundo) → 2 Açaí → 3 Recheio (meio) → 4 Açaí → 5 Recheio (topo)
     O açaí nunca vai no fundo (derrete).
     Abaixo: em quais camadas de recheio cada item vai.
       Fundo: caldas + pós (ex.: leite condensado + Ninho)
       Meio:  frutas picadas + caldas
       Topo:  pós de novo + balas, confete e crocantes
     Fruta não vai no fundo nem em cima (só se o copo não tiver outra coisa).
     Fruta nova que não estiver aqui vai no "meio"; complemento novo vai no "topo".
     ============================================================ */
  const CAMADAS_DO_ITEM = {
    // caldas (na bisnaga): no fundo e junto com as frutas
    "leite-condensado": ["fundo", "meio"],
    nutella: ["fundo", "meio"],
    // frutas picadas: só no meio
    morango: ["meio"],
    kiwi: ["meio"],
    banana: ["meio"],
    uva: ["meio"],
    // pós: no fundo e de novo em cima
    "leite-ninho": ["fundo", "topo"],
    pacoca: ["fundo", "topo"],
    // crocantes e balas: só em cima, para não murchar
    granola: ["topo"],
    sucrilhos: ["topo"],
    confete: ["topo"],
    "bala-de-goma": ["topo"],
  };
  // Crocantes murcham no fundo: só vão lá se não houver outra opção.
  const CROCANTES = new Set(["granola", "sucrilhos", "confete"]);

  /* ---------- utilidades ---------- */
  const L = window.LOJA || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dinheiro = (v) => brl.format(Number(v) || 0);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ler = (chave, padrao) => {
    try {
      const v = JSON.parse(localStorage.getItem(chave));
      return v ?? padrao;
    } catch {
      return padrao;
    }
  };
  const guardar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* sem armazenamento */
    }
  };
  const vibrar = (p) => {
    try {
      navigator.vibrate?.(p);
    } catch {
      /* sem vibração */
    }
  };
  const numero = (texto) => {
    const t = String(texto ?? "").trim().replace(/[^\d,.]/g, "");
    if (!t) return NaN;
    return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  };
  const compara = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }).compare;

  const ITENS = [...(L.frutas || []), ...(L.acompanhamentos || [])];
  const ITEM = Object.fromEntries(ITENS.map((i) => [i.id, i]));
  const ORDEM_ITEM = Object.fromEntries(ITENS.map((i, n) => [i.id, n]));
  const TAMANHO = Object.fromEntries((L.tamanhos || []).map((t) => [t.id, t]));
  const FRUTAS = new Set((L.frutas || []).map((i) => i.id));
  const ehFruta = (id) => FRUTAS.has(id);
  const nomeItem = (id) => ITEM[id]?.nome || id;
  const nomeTamanho = (id) => TAMANHO[id]?.nome || `${id} ml`;
  const porOrdemDoCardapio = (a, b) => (ORDEM_ITEM[a] ?? 99) - (ORDEM_ITEM[b] ?? 99);

  // Data (aaaa-mm-dd) e hora no horário de São Paulo
  const fmtData = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const dataSP = (d) => fmtData.format(d);
  const horaSP = (iso) => fmtHora.format(new Date(iso));
  const minutosDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  function tempoTexto(min) {
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `há ${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
  }

  /* ---------- montagem: distribui os itens nas 3 camadas de recheio ---------- */
  function montarCamadas(ids) {
    const camadas = { fundo: [], meio: [], topo: [] };
    const itens = [...new Set(ids)].sort(porOrdemDoCardapio);
    for (const id of itens) {
      const lugares = CAMADAS_DO_ITEM[id] || (ehFruta(id) ? ["meio"] : ["topo"]);
      for (const c of lugares) camadas[c].push(id);
    }
    // Nenhuma camada de recheio fica vazia (senão o açaí encostaria no fundo ou em outro açaí).
    // Para completar, escolhe o item que "menos destoa" naquela camada.
    const custo = (alvo, id) => {
      if (alvo === "fundo") return CROCANTES.has(id) ? 3 : ehFruta(id) ? 2 : 1;
      if (alvo === "topo") return ehFruta(id) ? 2 : 1;
      return CROCANTES.has(id) ? 2 : 1;
    };
    for (const alvo of ["fundo", "meio", "topo"]) {
      if (camadas[alvo].length || !itens.length) continue;
      const melhor = itens.slice().sort((a, b) => custo(alvo, a) - custo(alvo, b))[0];
      camadas[alvo].push(melhor);
    }
    for (const c of Object.keys(camadas)) camadas[c].sort(porOrdemDoCardapio);
    return camadas;
  }

  /* ---------- telas ---------- */
  function mostrarTela(nome) {
    $$("[data-tela]").forEach((t) => (t.hidden = t.dataset.tela !== nome));
  }
  function erroFatal(texto) {
    $("[data-erro-texto]").textContent = texto;
    mostrarTela("erro");
  }

  let timerSumir;
  let timerEsconder;
  function toast(texto) {
    const el = $("[data-toast]");
    el.textContent = texto;
    el.hidden = false;
    el.classList.remove("some");
    clearTimeout(timerSumir);
    clearTimeout(timerEsconder);
    timerSumir = setTimeout(() => el.classList.add("some"), 4200);
    timerEsconder = setTimeout(() => (el.hidden = true), 4600);
  }

  if (!L.painel?.url || !L.painel?.chave) {
    erroFatal("O painel não está configurado no js/config.js (bloco “painel”).");
    return;
  }
  if (!window.supabase?.createClient) {
    erroFatal("Não carregou a conexão com o banco. Confira a internet e recarregue a página.");
    return;
  }

  const sb = window.supabase.createClient(L.painel.url, L.painel.chave, {
    auth: { storageKey: "ganath-painel", persistSession: true, autoRefreshToken: true },
  });

  /* ---------- login ---------- */
  let usuarioAtual = null;

  sb.auth.onAuthStateChange((_evento, sessao) => {
    // Não chamar o banco direto aqui dentro (recomendação do Supabase).
    setTimeout(() => aoMudarSessao(sessao), 0);
  });

  async function aoMudarSessao(sessao) {
    const id = sessao?.user?.id || null;
    if (id && id === usuarioAtual) return; // só renovou o acesso
    usuarioAtual = id;
    if (!sessao) {
      pararPainel();
      mostrarTela("login");
      return;
    }
    mostrarTela("carregando");
    const { data: ok, error } = await sb.rpc("sou_da_equipe");
    if (error) {
      erroFatal("Não deu para conferir o acesso. Confira a internet e recarregue a página.");
      return;
    }
    if (!ok) {
      $("[data-email-sem-acesso]").textContent = sessao.user.email || "";
      mostrarTela("sem-acesso");
      return;
    }
    iniciarPainel();
  }

  $("[data-form-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    prepararSom();
    const form = e.currentTarget;
    const f = form.elements;
    const erro = $("[data-erro-login]");
    const email = f.email.value.trim();
    if (!email || !f.senha.value) {
      erro.textContent = "Preencha o e-mail e a senha.";
      return;
    }
    const botao = $("button[type=submit]", form);
    botao.disabled = true;
    erro.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: f.senha.value });
    botao.disabled = false;
    if (error) {
      erro.textContent = /invalid/i.test(error.message)
        ? "E-mail ou senha incorretos."
        : /fetch|network/i.test(error.message)
          ? "Sem conexão. Confira a internet."
          : `Não deu para entrar: ${error.message}`;
    } else f.senha.value = "";
  });

  $$("[data-sair]").forEach((b) =>
    b.addEventListener("click", async () => {
      // "local": sai só deste aparelho (o outro continua logado).
      await sb.auth.signOut({ scope: "local" });
    }),
  );

  /* ============================================================
     PEDIDOS
     ============================================================ */
  const ATIVOS = ["novo", "montando", "pronto"];
  const PROXIMO = { novo: "montando", montando: "pronto", pronto: "entregue" };
  const ANTERIOR = { montando: "novo", pronto: "montando", entregue: "pronto", cancelado: "novo" };
  const ACAO = { novo: "Começar", montando: "Pronto", pronto: "Entregue" };
  const NOME_STATUS = { novo: "Novo", montando: "Montando", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado" };
  const VAZIO = {
    novo: "Nenhum pedido esperando.",
    montando: "Nada sendo montado agora.",
    pronto: "Nada esperando entrega.",
  };

  let pedidos = [];
  let conhecidos = null; // ids já vistos (null = ainda não carregou)
  const destaque = new Map(); // id → quando chegou (para piscar o cartão)
  let ordem = ler("ganath-painel:ordem", "chegada");
  let canal = null;
  let tempoReal = false;
  let falhou = false;
  let ultimaCarga = 0;
  let timerVigia = null;
  let timerRelogio = null;
  let rodando = false;

  function iniciarPainel() {
    if (rodando) return;
    rodando = true;
    mostrarTela("painel");
    abrirAba(ler("ganath-painel:aba", "fila"));
    marcarOrdem();
    atualizarStatusLoja();
    conhecidos = null;
    recarregar();
    carregarCupons();
    canal = sb
      .channel("painel-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, agendarRecarga)
      .subscribe((status) => {
        tempoReal = status === "SUBSCRIBED";
        atualizarConexao();
        if (tempoReal) agendarRecarga();
      });
    // Rede de segurança: se o tempo real cair, confere sozinho de tempos em tempos.
    timerVigia = setInterval(() => {
      const limite = tempoReal ? 90000 : 20000;
      if (Date.now() - ultimaCarga > limite) recarregar();
    }, 10000);
    timerRelogio = setInterval(() => {
      renderFila();
      atualizarStatusLoja();
    }, 30000);
    aplicarTelaAcesa();
  }

  function pararPainel() {
    rodando = false;
    if (canal) sb.removeChannel(canal);
    canal = null;
    tempoReal = false;
    clearInterval(timerVigia);
    clearInterval(timerRelogio);
    soltarTelaAcesa();
    pedidos = [];
    conhecidos = null;
  }

  let timerRecarga;
  function agendarRecarga() {
    clearTimeout(timerRecarga);
    timerRecarga = setTimeout(recarregar, 250);
  }

  let carregando = false;
  let deNovo = false;
  async function recarregar() {
    if (!rodando) return;
    if (carregando) {
      deNovo = true;
      return;
    }
    carregando = true;
    try {
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await sb
        .from("pedidos")
        .select("*")
        .or(`status.in.(novo,montando,pronto),criado_em.gte."${desde}"`)
        .order("criado_em", { ascending: true })
        .limit(500);
      if (error) throw error;
      const primeiraVez = !conhecidos;
      if (primeiraVez) conhecidos = new Set();
      const chegaram = primeiraVez ? [] : data.filter((p) => !conhecidos.has(p.id) && p.status === "novo");
      data.forEach((p) => conhecidos.add(p.id));
      pedidos = data;
      ultimaCarga = Date.now();
      falhou = false;
      renderFila();
      if (chegaram.length) alertarNovos(chegaram);
    } catch {
      falhou = true;
    } finally {
      carregando = false;
      atualizarConexao();
      if (deNovo) {
        deNovo = false;
        recarregar();
      }
    }
  }

  function alertarNovos(lista) {
    const agora = Date.now();
    lista.forEach((p) => destaque.set(p.id, agora));
    tocarSom();
    vibrar([220, 120, 220]);
    const p = lista[0];
    toast(lista.length === 1 ? `Novo pedido #${p.codigo || p.id} de ${p.nome}` : `${lista.length} pedidos novos chegaram`);
    renderFila();
  }

  async function mudarStatus(id, status) {
    const p = pedidos.find((x) => x.id === id);
    if (!p) return;
    const antes = p.status;
    p.status = status;
    p.atualizado_em = new Date().toISOString();
    renderFila();
    const { error } = await sb.from("pedidos").update({ status }).eq("id", id);
    if (error) {
      p.status = antes;
      renderFila();
      toast("Não salvou. Confira a internet e tente de novo.");
    }
  }

  async function apagarPedido(id) {
    const i = pedidos.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [p] = pedidos.splice(i, 1);
    abertos.delete(id);
    renderFila();
    const { error } = await sb.from("pedidos").delete().eq("id", id);
    if (error) {
      pedidos.splice(i, 0, p);
      renderFila();
      toast("Não deu para apagar. Confira a internet e tente de novo.");
    } else toast(`Pedido #${p.codigo || p.id} apagado.`);
  }

  // Linhas expandidas (tamanho, frutas, complementos), com a montagem aberta e o menu "⋯" aberto.
  // Continuam assim quando a lista atualiza.
  const expandidos = new Set();
  const abertos = new Set();
  let menuAberto = null;

  function fecharMenus(excetoId = null) {
    menuAberto = excetoId;
    $$("[data-menu][open]").forEach((m) => {
      if (Number(m.closest("[data-pedido]")?.dataset.pedido) !== excetoId) m.open = false;
    });
  }

  document.addEventListener(
    "toggle",
    (e) => {
      const menu = e.target.closest?.("[data-menu]");
      if (!menu) return;
      const id = Number(menu.closest("[data-pedido]").dataset.pedido);
      if (menu.open) fecharMenus(id);
      else if (menuAberto === id) menuAberto = null;
    },
    true,
  );

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-menu]")) fecharMenus();
    const linha = e.target.closest("[data-pedido]");
    if (!linha) return;
    const id = Number(linha.dataset.pedido);
    const p = pedidos.find((x) => x.id === id);
    if (!p) return;
    const nome = `#${p.codigo || p.id} de ${p.nome}`;
    if (e.target.closest("[data-montagem]")) {
      if (abertos.has(id)) abertos.delete(id);
      else abertos.add(id);
      renderFila();
      return;
    }
    if (e.target.closest("[data-expandir]")) {
      if (expandidos.has(id)) expandidos.delete(id);
      else expandidos.add(id);
      renderFila();
      $(`[data-pedido="${id}"] [data-expandir]`)?.focus({ preventScroll: true });
      return;
    }
    const mudar = e.target.closest("[data-mudar]");
    if (mudar) {
      fecharMenus();
      vibrar(15);
      mudarStatus(id, mudar.dataset.mudar);
    } else if (e.target.closest("[data-cancelar]")) {
      fecharMenus();
      if (confirm(`Cancelar o pedido ${nome}?`)) mudarStatus(id, "cancelado");
    } else if (e.target.closest("[data-apagar]")) {
      fecharMenus();
      if (confirm(`Apagar o pedido ${nome}?\n\nEle some do painel e do banco, sem volta.`)) apagarPedido(id);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuAberto !== null) fecharMenus();
  });

  /* ---------- desenho da fila ---------- */
  function ordenar(lista) {
    if (ordem !== "predio") return lista;
    return [...lista].sort(
      (a, b) => compara(a.predio, b.predio) || compara(a.apartamento, b.apartamento) || (a.criado_em < b.criado_em ? -1 : 1),
    );
  }

  function renderFila() {
    if (!rodando) return;
    const ativos = pedidos.filter((p) => ATIVOS.includes(p.status));
    const fila = ativos.filter((p) => p.status === "novo");
    const posicao = new Map(fila.map((p, i) => [p.id, i + 1]));

    for (const st of ATIVOS) {
      const lista = ordenar(ativos.filter((p) => p.status === st));
      const alvo = $(`[data-lista="${st}"]`);
      let html = "";
      let predioAtual = null;
      for (const p of lista) {
        if (ordem === "predio" && p.predio !== predioAtual) {
          predioAtual = p.predio;
          html += `<p class="p-grupo">Torre ${esc(p.predio)}</p>`;
        }
        html += htmlLinha(p, posicao.get(p.id));
      }
      alvo.innerHTML = html || `<p class="p-vazio">${VAZIO[st]}</p>`;
      $(`[data-coluna="${st}"] [data-n]`).textContent = lista.length || "";
    }

    const finalizados = pedidos
      .filter((p) => !ATIVOS.includes(p.status))
      .sort((a, b) => (a.atualizado_em < b.atualizado_em ? 1 : -1));
    $("[data-lista=finalizados]").innerHTML = finalizados.length
      ? finalizados.map((p) => htmlLinha(p)).join("")
      : `<p class="p-vazio">Nada nas últimas 24 horas.</p>`;
    $("[data-n-finalizados]").textContent = finalizados.length || "";

    // esquece linhas abertas de pedidos que sumiram
    for (const conjunto of [abertos, expandidos]) {
      for (const id of conjunto) if (!pedidos.some((p) => p.id === id)) conjunto.delete(id);
    }

    renderResumo();

    const n = fila.length;
    const contagem = $("[data-contagem-fila]");
    contagem.textContent = n;
    contagem.hidden = !n;
    document.title = n ? `(${n}) Ganath | Painel` : "Ganath | Painel";

    // tira o destaque depois de 1 minuto
    const agora = Date.now();
    for (const [id, quando] of destaque) if (agora - quando > 60000) destaque.delete(id);
  }

  function etiquetas(p) {
    const e = [];
    if (p.loja_fechada) e.push(`<span class="p-etiqueta">Enviado com a loja fechada</span>`);
    if (p.cupom_ok === false)
      e.push(`<span class="p-etiqueta p-alerta" title="O desconto não bate com o cupom. Confira com o cliente.">Conferir cupom</span>`);
    return e.length ? `<p class="p-etiquetas">${e.join("")}</p>` : "";
  }

  function textoPagamento(p) {
    if (!p.pagamento) return "Combinar no WhatsApp";
    if (p.troco) {
      const levar = Number(p.troco) - Number(p.total);
      return `${p.pagamento} · troco p/ ${dinheiro(p.troco)}${levar > 0 ? ` (levar ${dinheiro(levar)})` : ""}`;
    }
    return p.pagamento;
  }

  function htmlCopo(c) {
    const itens = (Array.isArray(c?.itens) ? c.itens : []).map(String);
    const qtd = Math.max(1, Number(c?.qtd) || 1);
    const titulo = `${qtd > 1 ? `${qtd}× ` : ""}Açaí ${nomeTamanho(c?.tamanho)}`;
    if (!itens.length) {
      return `
        <div class="p-copo">
          <p class="p-copo-titulo">${esc(titulo)}</p>
          <div class="p-camadas"><div class="p-camada acai"><span class="p-camada-itens">Só açaí, sem recheio</span></div></div>
        </div>`;
    }
    const camadas = montarCamadas(itens);
    const recheio = (chave, rotulo, n) => `
      <div class="p-camada recheio">
        <span class="p-camada-n">${n}</span>
        <span class="p-camada-rotulo">${rotulo}</span>
        <span class="p-camada-itens">${camadas[chave].map((id) => esc(nomeItem(id))).join(" + ")}</span>
      </div>`;
    const acai = (n) => `
      <div class="p-camada acai">
        <span class="p-camada-n">${n}</span>
        <span class="p-camada-rotulo">Açaí</span>
      </div>`;
    return `
      <div class="p-copo">
        <p class="p-copo-titulo">${esc(titulo)}</p>
        <div class="p-camadas" role="img" aria-label="Montagem de baixo para cima: ${esc(
          ["fundo", "meio", "topo"].map((k, i) => `${i * 2 + 1}, ${camadas[k].map(nomeItem).join(", ")}`).join("; "),
        )}">
          ${recheio("topo", "Topo", 5)}${acai(4)}${recheio("meio", "Meio", 3)}${acai(2)}${recheio("fundo", "Fundo", 1)}
        </div>
      </div>`;
  }

  // Uma linha da lista: nº, horário, quem, copos, botão "Montagem", próxima etapa e menu "⋯".
  function htmlLinha(p, pos) {
    const ativo = ATIVOS.includes(p.status);
    const min = minutosDesde(p.criado_em);
    const atraso = !ativo || p.status === "pronto" ? "" : min >= 30 ? "ruim" : min >= 15 ? "atencao" : "";
    const copos = Array.isArray(p.copos) ? p.copos : [];
    const qtd = copos.reduce((s, c) => s + (Math.max(1, Number(c?.qtd) || 1)), 0);
    const aberta = abertos.has(p.id);
    const expandida = expandidos.has(p.id);
    const codigo = esc(p.codigo || p.id);
    const voltar = ANTERIOR[p.status];
    const sinais = [
      p.observacoes ? `<span class="p-sinal" title="${esc(p.observacoes)}">Obs.</span>` : "",
      p.cupom_ok === false ? `<span class="p-sinal p-alerta" title="O desconto não bate com o cupom. Confira com o cliente.">Conferir cupom</span>` : "",
    ].join("");
    const etapa = ativo
      ? `<button type="button" class="p-mini p-etapa p-etapa-${p.status}" data-mudar="${PROXIMO[p.status]}">${ACAO[p.status]}</button>`
      : `<span class="p-status-chip" data-status="${p.status}">${NOME_STATUS[p.status]} ${horaSP(p.atualizado_em)}</span>`;
    return `
      <div class="p-linha${destaque.has(p.id) ? " chegou" : ""}${aberta || expandida ? " aberta" : ""}" data-pedido="${p.id}" data-status="${p.status}">
        <div class="p-linha-principal">
          <button type="button" class="p-abrir" data-expandir aria-expanded="${expandida}" title="${expandida ? "Recolher" : "Ver tamanho, frutas e complementos"}">
            <span class="p-pos">${pos ? `${pos}º Pedido` : ""}</span>
            <span class="p-codigo">#${codigo}</span>
            <span class="p-hora"><b>${horaSP(p.criado_em)}</b>${ativo ? ` <span class="p-tempo ${atraso}">${tempoTexto(min)}</span>` : ""}</span>
            <span class="p-quem"><strong>${esc(p.nome)}</strong> <span>Torre ${esc(p.predio)} · Apto ${esc(p.apartamento)}</span>${sinais}</span>
            <span class="p-qtd">${qtd} ${qtd === 1 ? "copo" : "copos"}<i class="p-seta" aria-hidden="true"></i></span>
          </button>
          <button type="button" class="p-mini p-ver" data-montagem aria-expanded="${aberta}">Montagem</button>
          ${etapa}
          <details class="p-menu" data-menu ${menuAberto === p.id ? "open" : ""}>
            <summary aria-label="Mais opções do pedido #${codigo}" title="Mais opções">⋯</summary>
            <div class="p-menu-lista">
              ${voltar ? `<button type="button" data-mudar="${voltar}">${p.status === "cancelado" ? "Reabrir pedido" : `Voltar para “${NOME_STATUS[voltar]}”`}</button>` : ""}
              ${ativo ? `<button type="button" data-cancelar>Cancelar pedido</button>` : ""}
              <button type="button" class="p-perigo" data-apagar>Apagar pedido</button>
            </div>
          </details>
        </div>
        ${expandida && copos.length ? `<div class="p-escolhas">${copos.map(htmlEscolha).join("")}</div>` : ""}
        ${aberta ? htmlDetalhe(p) : ""}
      </div>`;
  }

  // O que o cliente escolheu em cada copo: tamanho, frutas e complementos.
  function htmlEscolha(c) {
    const itens = (Array.isArray(c?.itens) ? c.itens : []).map(String).sort(porOrdemDoCardapio);
    const frutas = itens.filter(ehFruta).map(nomeItem);
    const complementos = itens.filter((id) => !ehFruta(id)).map(nomeItem);
    const qtd = Math.max(1, Number(c?.qtd) || 1);
    const lista = (nomes, vazio) => (nomes.length ? esc(nomes.join(", ")) : `<span class="p-nada">${vazio}</span>`);
    return `
      <dl class="p-escolha">
        <div><dt>Tamanho</dt><dd>${qtd > 1 ? `<b class="p-vezes">${qtd}×</b> ` : ""}${esc(nomeTamanho(c?.tamanho))}</dd></div>
        <div><dt>Frutas</dt><dd>${lista(frutas, "nenhuma")}</dd></div>
        <div><dt>Complementos</dt><dd>${lista(complementos, "nenhum")}</dd></div>
      </dl>`;
  }

  // O que abre no botão "Montagem": os copos em camadas e os dados da entrega.
  function htmlDetalhe(p) {
    const copos = Array.isArray(p.copos) ? p.copos : [];
    return `
      <div class="p-detalhe">
        <div class="p-copos">${copos.map(htmlCopo).join("")}</div>
        <div class="p-detalhe-info">
          ${etiquetas(p)}
          ${p.observacoes ? `<p class="p-obs"><strong>Obs.:</strong> ${esc(p.observacoes)}</p>` : ""}
          <dl class="p-conta">
            <div><dt>Pagamento</dt><dd>${esc(textoPagamento(p))}</dd></div>
            ${Number(p.desconto) > 0 ? `<div><dt>Cupom ${esc(p.cupom || "")}</dt><dd>− ${dinheiro(p.desconto)}</dd></div>` : ""}
            <div class="p-conta-total"><dt>Total</dt><dd>${dinheiro(p.total)}</dd></div>
          </dl>
          <p class="p-legenda">Monte de baixo (<b>1</b>) para cima (<b>5</b>). O açaí nunca vai no fundo.</p>
        </div>
      </div>`;
  }

  function renderResumo() {
    const hoje = dataSP(new Date());
    const deHoje = pedidos.filter((p) => p.status !== "cancelado" && dataSP(new Date(p.criado_em)) === hoje);
    const copos = deHoje.reduce((s, p) => s + (Array.isArray(p.copos) ? p.copos : []).reduce((t, c) => t + (Number(c?.qtd) || 1), 0), 0);
    const total = deHoje.reduce((s, p) => s + Number(p.total || 0), 0);
    $("[data-resumo]").innerHTML = deHoje.length
      ? `<strong>Hoje:</strong> ${deHoje.length} ${deHoje.length === 1 ? "pedido" : "pedidos"} · ${copos} ${copos === 1 ? "copo" : "copos"} · ${dinheiro(total)}`
      : "<strong>Hoje:</strong> nenhum pedido ainda";
  }

  /* ---------- ordem ---------- */
  function marcarOrdem() {
    $$("[data-ordem]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ordem === ordem)));
  }
  $$("[data-ordem]").forEach((b) =>
    b.addEventListener("click", () => {
      ordem = b.dataset.ordem;
      guardar("ganath-painel:ordem", ordem);
      marcarOrdem();
      renderFila();
    }),
  );

  /* ---------- abas ---------- */
  function abrirAba(nome) {
    if (!["fila", "cupons"].includes(nome)) nome = "fila";
    $$("[data-aba]").forEach((b) => (b.dataset.aba === nome ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    $$("[data-secao]").forEach((s) => (s.hidden = s.dataset.secao !== nome));
    guardar("ganath-painel:aba", nome);
  }
  $$("[data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));

  /* ---------- conexão ---------- */
  function atualizarConexao() {
    const el = $("[data-conexao]");
    if (falhou) {
      el.dataset.estado = "erro";
      el.textContent = "Sem conexão";
    } else if (tempoReal) {
      el.dataset.estado = "ok";
      el.textContent = "Ao vivo";
    } else {
      el.dataset.estado = "lento";
      el.textContent = "Conectando…";
    }
  }
  addEventListener("online", () => recarregar());

  /* ---------- loja aberta / fechada ---------- */
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const minutos = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const horaTexto = (mins) =>
    mins >= 1440 ? "meia-noite" : `${Math.floor(mins / 60)}h${mins % 60 ? String(mins % 60).padStart(2, "0") : ""}`;
  function atualizarStatusLoja() {
    const F = L.funcionamento;
    const el = $("[data-status-loja]");
    if (!F || !Array.isArray(F.dias) || !F.dias.length) {
      el.hidden = true;
      return;
    }
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const v = (t) => partes.find((p) => p.type === t)?.value;
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
    const min = Number(v("hour")) * 60 + Number(v("minute"));
    const abre = minutos(F.abre);
    const fecha = minutos(F.fecha);
    const aberto = F.dias.includes(dia) && min >= abre && min < fecha;
    el.classList.toggle("aberto", aberto);
    if (aberto) {
      el.textContent = `Loja aberta até ${horaTexto(fecha)}`;
      return;
    }
    for (let k = 0; k < 8; k++) {
      const d = (dia + k) % 7;
      if (!F.dias.includes(d) || (k === 0 && min >= abre)) continue;
      el.textContent = `Loja fechada · abre ${k === 0 ? "hoje" : k === 1 ? "amanhã" : DIAS[d]} às ${horaTexto(abre)}`;
      return;
    }
    el.textContent = "Loja fechada";
  }

  /* ---------- som de novo pedido ---------- */
  let audio = null;
  let somLigado = ler("ganath-painel:som", true);
  function prepararSom() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume().then(atualizarBotaoSom, () => {});
    } catch {
      /* sem áudio */
    }
    atualizarBotaoSom();
  }
  document.addEventListener("pointerdown", prepararSom, { passive: true });
  document.addEventListener("keydown", prepararSom);

  function tocarSom() {
    if (!somLigado || !audio || audio.state !== "running") return;
    const t = audio.currentTime + 0.02;
    [
      [880, 0],
      [1318.5, 0.16],
      [880, 0.5],
      [1318.5, 0.66],
    ].forEach(([freq, atraso]) => {
      const osc = audio.createOscillator();
      const ganho = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.4, t + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + atraso + 0.34);
      osc.connect(ganho).connect(audio.destination);
      osc.start(t + atraso);
      osc.stop(t + atraso + 0.36);
    });
  }

  function atualizarBotaoSom() {
    const b = $("[data-som]");
    const travado = somLigado && (!audio || audio.state !== "running");
    b.setAttribute("aria-pressed", String(somLigado));
    b.textContent = !somLigado ? "Som desligado" : travado ? "Toque para ativar o som" : "Som ligado";
    b.classList.toggle("p-chip-alerta", travado);
  }
  // Se o som estava "travado" pelo navegador, o toque só destrava (não desliga).
  const botaoSom = $("[data-som]");
  let travadoNoToque = false;
  const marcarToque = () => (travadoNoToque = somLigado && (!audio || audio.state !== "running"));
  botaoSom.addEventListener("pointerdown", marcarToque);
  botaoSom.addEventListener("keydown", marcarToque);
  botaoSom.addEventListener("click", () => {
    if (!travadoNoToque) {
      somLigado = !somLigado;
      guardar("ganath-painel:som", somLigado);
    }
    travadoNoToque = false;
    prepararSom();
    setTimeout(tocarSom, 150);
  });
  atualizarBotaoSom();

  /* ---------- tela sempre acesa (bom para o celular na bancada) ---------- */
  let telaAcesa = ler("ganath-painel:tela", false);
  let trava = null;
  const temWakeLock = "wakeLock" in navigator;
  $("[data-tela-acesa]").hidden = !temWakeLock;

  async function aplicarTelaAcesa() {
    atualizarBotaoTela();
    if (!temWakeLock || !telaAcesa || trava || document.visibilityState !== "visible" || !rodando) return;
    try {
      trava = await navigator.wakeLock.request("screen");
      trava.addEventListener("release", () => {
        trava = null;
        atualizarBotaoTela();
      });
    } catch {
      /* o navegador recusou (bateria fraca, etc.) */
    }
    atualizarBotaoTela();
  }
  function soltarTelaAcesa() {
    trava?.release().catch(() => {});
    trava = null;
  }
  function atualizarBotaoTela() {
    const b = $("[data-tela-acesa]");
    b.setAttribute("aria-pressed", String(telaAcesa));
    b.textContent = telaAcesa ? "Tela sempre acesa" : "Manter tela acesa";
  }
  $("[data-tela-acesa]").addEventListener("click", () => {
    telaAcesa = !telaAcesa;
    guardar("ganath-painel:tela", telaAcesa);
    if (telaAcesa) aplicarTelaAcesa();
    else {
      soltarTelaAcesa();
      atualizarBotaoTela();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !rodando) return;
    aplicarTelaAcesa();
    recarregar();
  });

  /* ============================================================
     CUPONS
     ============================================================ */
  let cupons = [];

  async function carregarCupons() {
    const { data, error } = await sb.from("cupons").select("*").order("criado_em", { ascending: false });
    if (error) {
      $("[data-lista-cupons]").innerHTML = `<p class="p-vazio">Não deu para carregar os cupons. Recarregue a página.</p>`;
      return;
    }
    cupons = data;
    renderCupons();
  }

  const numeroBR = (v) => String(Number(v)).replace(".", ",");
  const descricaoCupom = (c) => (c.tipo === "percentual" ? `${numeroBR(c.valor)}% de desconto` : `${dinheiro(c.valor)} de desconto`);
  const dataBR = (aaaammdd) => aaaammdd.split("-").reverse().join("/");

  function situacaoCupom(c) {
    if (!c.ativo) return ["desligado", "Desligado"];
    if (c.valido_ate && c.valido_ate < dataSP(new Date())) return ["vencido", "Vencido"];
    if (c.usos_max && c.usos >= c.usos_max) return ["esgotado", "Esgotado"];
    return ["valendo", "Valendo"];
  }

  function renderCupons() {
    const caixa = $("[data-lista-cupons]");
    if (!cupons.length) {
      caixa.innerHTML = `<p class="p-vazio">Nenhum cupom ainda. Crie o primeiro acima.</p>`;
      return;
    }
    caixa.innerHTML = cupons
      .map((c) => {
        const [classe, texto] = situacaoCupom(c);
        const regras = [
          c.pedido_minimo ? `pedidos a partir de ${dinheiro(c.pedido_minimo)}` : "",
          c.valido_ate ? `vale até ${dataBR(c.valido_ate)}` : "sem data para acabar",
          c.usos_max ? `usado ${c.usos} de ${c.usos_max}` : `usado ${c.usos} ${c.usos === 1 ? "vez" : "vezes"}`,
        ].filter(Boolean);
        return `
          <article class="p-cupom" data-cupom="${c.id}" data-situacao="${classe}">
            <div class="p-cupom-info">
              <p class="p-cupom-codigo">${esc(c.codigo)}</p>
              <p class="p-cupom-desc">${esc(descricaoCupom(c))}</p>
              <p class="p-cupom-regras">${esc(regras.join(" · "))}</p>
            </div>
            <span class="p-situacao" data-situacao="${classe}">${texto}</span>
            <div class="p-cupom-acoes">
              <label class="p-chave">
                <input type="checkbox" data-ativar ${c.ativo ? "checked" : ""}>
                <span>${c.ativo ? "Ligado" : "Desligado"}</span>
              </label>
              <button type="button" class="p-link" data-copiar>Copiar convite</button>
              <button type="button" class="p-link p-perigo" data-apagar>Apagar</button>
            </div>
          </article>`;
      })
      .join("");
  }

  $("[data-lista-cupons]").addEventListener("change", async (e) => {
    const chave = e.target.closest("[data-ativar]");
    if (!chave) return;
    const c = cupons.find((x) => x.id === Number(chave.closest("[data-cupom]").dataset.cupom));
    if (!c) return;
    const { error } = await sb.from("cupons").update({ ativo: chave.checked }).eq("id", c.id);
    if (error) toast("Não salvou. Tente de novo.");
    else toast(chave.checked ? `Cupom ${c.codigo} ligado.` : `Cupom ${c.codigo} desligado.`);
    carregarCupons();
  });

  $("[data-lista-cupons]").addEventListener("click", async (e) => {
    const cartao = e.target.closest("[data-cupom]");
    if (!cartao) return;
    const c = cupons.find((x) => x.id === Number(cartao.dataset.cupom));
    if (!c) return;
    if (e.target.closest("[data-apagar]")) {
      if (!confirm(`Apagar o cupom ${c.codigo}? Quem ainda não usou não vai conseguir mais.`)) return;
      const { error } = await sb.from("cupons").delete().eq("id", c.id);
      if (error) toast("Não deu para apagar. Tente de novo.");
      else toast(`Cupom ${c.codigo} apagado.`);
      carregarCupons();
    } else if (e.target.closest("[data-copiar]")) {
      const extra = c.pedido_minimo ? ` em pedidos a partir de ${dinheiro(c.pedido_minimo)}` : "";
      const texto = `Use o cupom ${c.codigo} e ganhe ${descricaoCupom(c)}${extra} no ${L.nome || "Ganath Açaí"}: ${location.origin}/`;
      try {
        await navigator.clipboard.writeText(texto);
        toast("Convite copiado. É só colar no WhatsApp.");
      } catch {
        prompt("Copie o convite:", texto);
      }
    }
  });

  const formCupom = $("[data-form-cupom]");
  formCupom.elements.codigo.addEventListener("input", (e) => {
    const campo = e.target;
    const limpo = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (limpo !== campo.value) campo.value = limpo;
  });

  formCupom.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = formCupom.elements;
    const erro = $("[data-erro-cupom]");
    const falha = (texto, campo) => {
      erro.textContent = texto;
      campo?.focus();
    };
    const codigo = f.codigo.value.trim().toUpperCase();
    const tipo = f.tipo.value;
    const valor = numero(f.valor.value);
    const minimo = f.minimo.value.trim() ? numero(f.minimo.value) : null;
    const usos = f.usos.value.trim() ? Number(f.usos.value.replace(/\D/g, "")) : null;
    const validade = f.validade.value || null;

    if (!/^[A-Z0-9]{3,20}$/.test(codigo)) return falha("O código precisa ter de 3 a 20 letras ou números (sem espaço e sem acento).", f.codigo);
    if (!(valor > 0)) return falha("Informe quanto é o desconto.", f.valor);
    if (tipo === "percentual" && valor > 100) return falha("A porcentagem vai até 100%.", f.valor);
    if (minimo !== null && !(minimo >= 0)) return falha("O pedido mínimo precisa ser um valor em reais.", f.minimo);
    if (usos !== null && !(usos > 0)) return falha("O limite de usos precisa ser um número maior que zero.", f.usos);
    if (validade && validade < dataSP(new Date())) return falha("A data já passou.", f.validade);

    erro.textContent = "";
    const botao = $("button[type=submit]", formCupom);
    botao.disabled = true;
    const { error } = await sb.from("cupons").insert({
      codigo,
      tipo,
      valor: Math.round(valor * 100) / 100,
      pedido_minimo: minimo,
      valido_ate: validade,
      usos_max: usos,
    });
    botao.disabled = false;
    if (error) {
      return falha(error.code === "23505" ? "Já existe um cupom com esse código." : "Não deu para criar o cupom. Confira os campos.", f.codigo);
    }
    formCupom.reset();
    toast(`Cupom ${codigo} criado.`);
    carregarCupons();
  });
})();
