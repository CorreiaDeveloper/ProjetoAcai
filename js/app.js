(() => {
  "use strict";

  const L = window.LOJA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dinheiro = (v) => brl.format(v);
  const arred = (v) => Math.round(v * 100) / 100;
  const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rolagem = () => (semMovimento() ? "auto" : "smooth");
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const vibrar = (ms) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* sem vibração */
    }
  };

  const ITENS = [
    ...L.frutas.map((i) => ({ ...i, grupo: "frutas" })),
    ...L.acompanhamentos.map((i) => ({ ...i, grupo: "acompanhamentos" })),
  ];
  const ITEM = Object.fromEntries(ITENS.map((i) => [i.id, i]));
  const TAMANHO = Object.fromEntries(L.tamanhos.map((t) => [t.id, t]));
  const CALDAS = ITENS.filter((i) => i.calda);
  const ESCALA = Object.fromEntries(
    L.tamanhos.map((t, i, arr) => [t.id, arr.length === 1 ? 1 : 0.8 + 0.2 * (i / (arr.length - 1))]),
  );
  const GIRO_CALDA = [24, -30, 72];
  const PAGAMENTOS = Array.isArray(L.formasPagamento) ? L.formasPagamento : [];
  const TAXA = Number(L.taxaEntrega) || 0;
  const PAINEL = L.painel && L.painel.url && L.painel.chave ? L.painel : null;

  /* ---------- armazenamento local (pode falhar em aba anônima) ---------- */
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
      /* sem armazenamento: segue sem salvar */
    }
  };

  /* ---------- estado ---------- */
  const montagem = { tamanho: L.tamanhos[L.tamanhos.length - 1].id, itens: new Set() };
  let sacola = ler("ganath:sacola", [])
    .filter((c) => c && TAMANHO[c.tamanho] && Array.isArray(c.itens))
    .map((c) => ({ ...c, qtd: Math.max(1, c.qtd | 0), itens: c.itens.filter((id) => ITEM[id]) }));
  let modoEnviado = false;
  let esgotados = new Set(); // ids marcados como esgotados no painel
  const temEsgotado = (c) => c.itens.some((id) => esgotados.has(id));

  const precoCopo = (tamanho, itens) =>
    arred(TAMANHO[tamanho].preco + [...itens].reduce((s, id) => s + (ITEM[id]?.preco || 0), 0));

  const listaNatural = (arr) =>
    arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;

  const minuscula = (nome) => (/^Nutella/.test(nome) ? nome : nome.charAt(0).toLowerCase() + nome.slice(1));

  const nomesDoGrupo = (ids, grupo) => ids.filter((id) => ITEM[id].grupo === grupo).map((id) => ITEM[id].nome);

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // "mola": passa um pouquinho do ponto e volta (mesmo efeito da animação anterior)
  const molinha = (t) => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2);

  // fotos das fatias, carregadas uma vez só e reaproveitadas por todos os copos
  const FOTOS = new Map();
  function fotoDoItem(item, aoCarregar) {
    let img = FOTOS.get(item.id);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = item.img;
      img.decode?.().catch(() => {}); // prepara a foto em segundo plano (evita engasgo no 1º desenho)
      FOTOS.set(item.id, img);
    }
    if (aoCarregar && !(img.complete && img.naturalWidth)) img.addEventListener("load", aoCarregar, { once: true });
    return img;
  }

  /* ============================================================
     O copo visto de cima
     ============================================================ */

  function criarCopo(alvo, { estatico = false, chegada = false } = {}) {
    const el = document.createElement("div");
    el.className = "copo" + (estatico ? " copo-estatico" : "") + (chegada && !semMovimento() ? " copo-chegada" : "");
    el.innerHTML = `
      <div class="copo-sombra"></div>
      <div class="copo-corpo">
        <div class="copo-borda"></div>
        <div class="copo-disco">
          <div class="copo-acai"></div>
          <canvas class="copo-fatias" aria-hidden="true"></canvas>
          <div class="copo-centro"></div>
          ${CALDAS.map(
            (c, i) =>
              `<div class="calda" data-id="${esc(c.id)}" style="--giro:${GIRO_CALDA[i % GIRO_CALDA.length]}deg;background-image:url('${esc(c.calda)}')"></div>`,
          ).join("")}
          <div class="copo-brilho"></div>
        </div>
      </div>`;
    alvo.replaceChildren(el);
    if (chegada) el.addEventListener("animationend", () => el.classList.remove("copo-chegada"), { once: true });

    // As fatias são desenhadas num canvas: um único desenho por quadro, leve até em celular simples.
    const tela = $(".copo-fatias", el);
    const ctx = tela.getContext("2d");
    const caldas = $$(".calda", el);
    const fatias = new Map(); // id → { item, ini, arco, de, para, t0, sair }
    const DURACAO = 550;
    let raf = 0;
    let sombra = null;
    let sombraW = 0;

    function ajustarTela() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(tela.clientWidth * dpr);
      if (w && tela.width !== w) {
        tela.width = w;
        tela.height = w;
      }
      return tela.width;
    }

    function pintar(agora) {
      raf = 0;
      const W = ajustarTela();
      if (!W) return;
      const c = W / 2;
      const R = W / 2;
      if (sombraW !== W) {
        sombra = ctx.createRadialGradient(c, c, R * 0.84, c, c, R);
        sombra.addColorStop(0, "rgba(20,0,24,0)");
        sombra.addColorStop(1, "rgba(20,0,24,0.42)");
        sombraW = W;
      }
      ctx.clearRect(0, 0, W, W);
      let animando = false;
      const instantaneo = estatico || semMovimento();
      for (const [id, f] of fatias) {
        const p = instantaneo ? 1 : Math.min(1, (agora - f.t0) / DURACAO);
        const k = p >= 1 ? 1 : molinha(p);
        f.ini = f.de.ini + (f.para.ini - f.de.ini) * k;
        f.arco = Math.max(0, f.de.arco + (f.para.arco - f.de.arco) * k);
        if (p < 1) animando = true;
        else if (f.sair) {
          fatias.delete(id);
          continue;
        }
        if (f.arco < 0.3) continue;
        const img = fotoDoItem(f.item, redesenhar);
        if (!img.complete || !img.naturalWidth) continue;
        const a0 = ((f.ini - 90) * Math.PI) / 180;
        const a1 = ((f.ini + f.arco - 90) * Math.PI) / 180;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, R, a0, a1);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, W, W);
        ctx.fillStyle = sombra;
        ctx.fillRect(0, 0, W, W);
        ctx.restore();
        // risquinho escuro entre uma fatia e outra
        ctx.strokeStyle = "rgba(20,0,24,0.38)";
        ctx.lineWidth = Math.max(1, W / 260);
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + R * Math.cos(a0), c + R * Math.sin(a0));
        ctx.moveTo(c, c);
        ctx.lineTo(c + R * Math.cos(a1), c + R * Math.sin(a1));
        ctx.stroke();
      }
      if (animando) raf = requestAnimationFrame(pintar);
    }

    function redesenhar() {
      if (!raf) raf = requestAnimationFrame(pintar);
    }

    // quando o copo aparece na tela (ou muda de tamanho), desenha de novo
    if ("ResizeObserver" in window) new ResizeObserver(() => pintar(performance.now())).observe(tela);

    function desenhar(tamanho, itens) {
      el.style.setProperty("--escala", ESCALA[tamanho] ?? 1);

      const lista = ITENS.filter((i) => itens.has(i.id) && !i.calda);
      const n = lista.length;
      // as fatias ocupam no máximo 288° do copo: sempre sobra um pedaço de açaí à mostra
      const arco = n === 0 ? 0 : Math.min(72, 288 / n);
      const inicio = -(arco * n) / 2;
      el.classList.toggle("com-fatias", n > 0);
      const agora = performance.now();

      for (const f of fatias.values()) {
        if (itens.has(f.item.id) || f.sair) continue;
        f.de = { ini: f.ini, arco: f.arco };
        f.para = { ini: f.ini + f.arco / 2, arco: 0 }; // encolhe para o meio
        f.t0 = agora;
        f.sair = true;
      }

      lista.forEach((item, i) => {
        const ini = inicio + i * arco;
        let f = fatias.get(item.id);
        if (!f) {
          f = { item, ini: ini + arco / 2, arco: 0 }; // nasce do meio da própria fatia
          fatias.set(item.id, f);
        }
        f.de = { ini: f.ini, arco: f.arco };
        f.para = { ini, arco };
        f.t0 = agora;
        f.sair = false;
      });

      caldas.forEach((c) => c.classList.toggle("ativa", itens.has(c.dataset.id)));
      if (estatico) pintar(agora);
      else redesenhar();
    }

    function pular() {
      if (estatico || semMovimento()) return;
      el.classList.remove("copo-pulo");
      void el.offsetWidth;
      el.classList.add("copo-pulo");
    }

    return { el, desenhar, pular };
  }

  /* ============================================================
     Montador
     ============================================================ */

  function renderTamanhos() {
    const n = L.tamanhos.length;
    $("[data-tamanhos]").innerHTML = L.tamanhos
      .map((t, i) => {
        const topo = n === 1 ? 8 : Math.round(26 - 18 * (i / (n - 1)));
        const corpo = `M5 ${topo} H43 L39 62 H9 Z`;
        return `
        <label class="tamanho">
          <input class="sr-input" type="radio" name="tamanho" value="${esc(t.id)}">
          <svg viewBox="0 0 48 64" aria-hidden="true" focusable="false">
            <clipPath id="cp-${esc(t.id)}"><path d="${corpo}"/></clipPath>
            <g clip-path="url(#cp-${esc(t.id)})"><rect class="tamanho-acai" x="0" y="${topo + 4}" width="48" height="${62 - topo}"/></g>
            <path class="tamanho-contorno" d="${corpo}"/>
            <rect class="tamanho-tampa" x="3" y="${topo - 2.5}" width="42" height="4" rx="2"/>
          </svg>
          <span class="tamanho-nome">${esc(t.nome)}</span>
          <span class="tamanho-preco">${dinheiro(t.preco)}</span>
        </label>`;
      })
      .join("");
  }

  function renderIngredientes() {
    for (const grupo of ["frutas", "acompanhamentos"]) {
      $(`[data-grupo="${grupo}"]`).innerHTML = L[grupo]
        .map(
          (i) => `
        <label class="ingrediente">
          <input class="sr-input" type="checkbox" name="${grupo}" value="${esc(i.id)}">
          <span class="ingrediente-foto" style="background-image:url('${esc(i.img)}')"></span>
          <span class="ingrediente-nome">${esc(i.nome)}</span>
          <span class="ingrediente-preco">+ ${dinheiro(i.preco)}</span>
        </label>`,
        )
        .join("");
    }
  }

  const CLASSICOS = (L.classicos || [])
    .map((c) => ({ ...c, itens: c.itens.filter((id) => ITEM[id]) }))
    .filter((c) => c.itens.length);

  function renderClassicos() {
    const html = CLASSICOS.map((c, idx) => {
      const nomes = listaNatural(c.itens.map((id) => minuscula(ITEM[id].nome)));
      return `
        <button class="classico" type="button" data-classico="${idx}" aria-label="${esc(`${c.nome}: ${nomes}`)}">
          <span class="classico-fotos" aria-hidden="true">${c.itens
            .map((id) => `<span style="background-image:url('${esc(ITEM[id].img)}')"></span>`)
            .join("")}</span>
          ${esc(c.nome)}
        </button>`;
    }).join("");
    $$("[data-classicos]").forEach((el) => (el.innerHTML = html));
    $$(".classicos").forEach((el) => (el.hidden = CLASSICOS.length === 0));
  }

  const copoPrincipal = criarCopo($("[data-copo-principal]"), { chegada: true });
  // o copinho da barra só acompanha (sem animar), para não pesar no celular
  const copoMini = criarCopo($("[data-copo-mini]"), { estatico: true });
  ITENS.forEach((i) => fotoDoItem(i)); // pré-carrega as fotos das fatias
  let timerDesenho;

  function resumoTexto(tamanho, itens) {
    const nomeTam = TAMANHO[tamanho].nome;
    const ids = ITENS.filter((i) => itens.has(i.id));
    if (!ids.length) return `Açaí puro no copo de ${nomeTam}. Escolha as frutas e os acompanhamentos.`;
    return `Copo de ${nomeTam} com ${listaNatural(ids.map((i) => minuscula(i.nome)))}.`;
  }

  function atualizarMontagem({ atraso = 0 } = {}) {
    const total = precoCopo(montagem.tamanho, montagem.itens);
    $$("[data-total-copo]").forEach((el) => (el.textContent = dinheiro(total)));
    $("[data-resumo]").textContent = resumoTexto(montagem.tamanho, montagem.itens);

    $$(".ingrediente input").forEach((inp) => (inp.checked = montagem.itens.has(inp.value)));
    $$('input[name="tamanho"]').forEach((inp) => (inp.checked = inp.value === montagem.tamanho));

    for (const grupo of ["frutas", "acompanhamentos"]) {
      const n = ITENS.filter((i) => i.grupo === grupo && montagem.itens.has(i.id)).length;
      const badge = $(`[data-qtd-grupo="${grupo}"]`);
      badge.textContent = n;
      badge.hidden = n === 0;
    }
    posicionarMarcador();

    const desenhar = () => {
      copoPrincipal.desenhar(montagem.tamanho, montagem.itens);
      copoMini.desenhar(montagem.tamanho, montagem.itens);
      if (atraso) copoPrincipal.pular();
    };
    clearTimeout(timerDesenho);
    if (atraso) timerDesenho = setTimeout(desenhar, atraso);
    else desenhar();
  }

  function estaNaTela(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 70 && r.top < innerHeight - 90;
  }

  // a foto do ingrediente "voa" até o copo
  function voar(origem, item) {
    if (semMovimento()) return false;
    const principal = $("[data-copo-principal]");
    const mini = $("[data-copo-mini]");
    const alvo = estaNaTela(principal) ? principal : mini.getBoundingClientRect().width > 0 ? mini : null;
    if (!alvo) return false;

    const a = origem.getBoundingClientRect();
    const b = alvo.getBoundingClientRect();
    const voo = document.createElement("div");
    voo.className = "voo";
    voo.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;background-image:url("${item.img}")`;
    document.body.append(voo);

    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const escalaFinal = Math.min(0.9, Math.max(0.25, (b.width * 0.3) / a.width));
    const subida = Math.min(120, 30 + Math.abs(dy) * 0.25);

    voo
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - subida}px) scale(1.05)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(${escalaFinal})`, opacity: 0.1 },
        ],
        { duration: 460, easing: "cubic-bezier(.4,.05,.5,1)" },
      )
      .finished.finally(() => voo.remove());
    return true;
  }

  /* ---------- abas que deslizam (celular) ---------- */
  const paineis = $("[data-paineis]");
  const abas = $$("[data-aba]");
  let abaAtual = 0;

  const modoAbas = () => getComputedStyle($("[data-abas]")).display !== "none";

  function posicionarMarcador() {
    const ativa = abas[abaAtual];
    const caixa = $("[data-abas]");
    if (!ativa || !modoAbas()) return;
    caixa.style.setProperty("--x", `${ativa.offsetLeft}px`);
    caixa.style.setProperty("--w", `${ativa.offsetWidth}px`);
  }

  function marcarAba(i) {
    abaAtual = i;
    abas.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
    posicionarMarcador();
  }

  function irParaAba(i) {
    marcarAba(i);
    paineis.scrollTo({ left: i * paineis.clientWidth, behavior: rolagem() });
  }

  // deixa o copo + abas + opções inteiros na tela
  function enquadrarMontador() {
    if (!modoAbas()) return;
    const painel = $(".painel");
    const r = painel.getBoundingClientRect();
    const topo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topo-altura")) || 60;
    if (Math.abs(r.top - topo - 6) > 24) painel.scrollIntoView({ behavior: rolagem(), block: "start" });
  }

  let timerRolagem;
  paineis.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(timerRolagem);
      timerRolagem = requestAnimationFrame(() => {
        const i = Math.round(paineis.scrollLeft / Math.max(1, paineis.clientWidth));
        if (i !== abaAtual) marcarAba(Math.min(abas.length - 1, Math.max(0, i)));
      });
    },
    { passive: true },
  );
  abas.forEach((b) =>
    b.addEventListener("click", () => {
      irParaAba(Number(b.dataset.aba));
      enquadrarMontador();
    }),
  );
  $$("[data-ir-aba]").forEach((b) => b.addEventListener("click", () => irParaAba(Number(b.dataset.irAba))));
  addEventListener("resize", () => {
    posicionarMarcador();
    if (modoAbas()) paineis.scrollLeft = abaAtual * paineis.clientWidth;
  });
  document.fonts?.ready.then(posicionarMarcador);

  /* ---------- escolhas ---------- */
  $("[data-montador]").addEventListener("change", (e) => {
    const inp = e.target;
    if (inp.name === "tamanho") {
      montagem.tamanho = inp.value;
      atualizarMontagem();
      vibrar(8);
      return;
    }
    if (inp.type !== "checkbox") return;
    const item = ITEM[inp.value];
    if (inp.checked) {
      montagem.itens.add(item.id);
      vibrar(10);
      const voou = voar(inp.nextElementSibling, item);
      atualizarMontagem({ atraso: voou ? 260 : 0 });
    } else {
      montagem.itens.delete(item.id);
      atualizarMontagem();
    }
  });

  document.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-classico]");
    if (!botao) return;
    const c = CLASSICOS[+botao.dataset.classico];
    montagem.itens = new Set(c.itens);
    vibrar(12);
    atualizarMontagem();
    copoPrincipal.pular();
    const copo = $("[data-copo-principal]");
    if (modoAbas()) enquadrarMontador();
    else if (!estaNaTela(copo)) copo.scrollIntoView({ behavior: rolagem(), block: "center" });
  });

  $$("[data-adicionar]").forEach((b) => b.addEventListener("click", adicionarASacola));

  function adicionarASacola() {
    const itens = ITENS.filter((i) => montagem.itens.has(i.id)).map((i) => i.id);
    const igual = sacola.find((c) => c.tamanho === montagem.tamanho && c.itens.join() === itens.join());
    if (igual) igual.qtd += 1;
    else sacola.push({ id: novoId(), tamanho: montagem.tamanho, itens, qtd: 1 });
    salvarSacola();
    pularContador();
    vibrar([10, 40, 10]);
    montagem.itens = new Set();
    atualizarMontagem();
    if (modoAbas()) irParaAba(0);
    avisar("Copo adicionado à sacola.");
  }

  /* ============================================================
     Sacola e pedido
     ============================================================ */

  const dialogo = $("[data-sacola]");
  const form = $("[data-checkout]");

  function salvarSacola() {
    guardar("ganath:sacola", sacola);
    atualizarContador();
    if (dialogo.open) renderSacola();
  }

  function atualizarContador() {
    const n = sacola.reduce((s, c) => s + c.qtd, 0);
    const el = $("[data-contador]");
    el.textContent = n;
    el.hidden = n === 0;
    $(".btn-sacola").setAttribute("aria-label", n ? `Sacola, ${n} ${n === 1 ? "copo" : "copos"}` : "Sacola vazia");
  }

  function pularContador() {
    const el = $("[data-contador]");
    el.classList.remove("pulo");
    void el.offsetWidth;
    el.classList.add("pulo");
  }

  // Com a sacola aberta, a página de trás fica parada (no celular, a rolagem
  // "vazava" da sacola para o site atrás dela).
  let rolagemGuardada = null;
  function travarFundo() {
    if (rolagemGuardada !== null) return;
    rolagemGuardada = window.scrollY;
    document.body.style.top = `-${rolagemGuardada}px`;
    document.documentElement.classList.add("fundo-travado");
  }
  function destravarFundo() {
    if (rolagemGuardada === null) return;
    const y = rolagemGuardada;
    rolagemGuardada = null;
    const html = document.documentElement;
    html.classList.remove("fundo-travado");
    document.body.style.top = "";
    html.style.scrollBehavior = "auto"; // volta para o mesmo lugar sem animar
    window.scrollTo(0, y);
    html.style.scrollBehavior = "";
  }

  function abrirSacola() {
    esconderAviso();
    atualizarStatus(); // aviso de "fechado" sempre em dia na hora de pedir
    renderSacola();
    if (!dialogo.open) {
      travarFundo();
      dialogo.showModal();
    }
  }

  function fecharSacola() {
    if (dialogo.open) dialogo.close();
    destravarFundo();
  }

  function irParaMontador() {
    fecharSacola();
    $("#montar").scrollIntoView({ behavior: rolagem() });
  }

  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) fecharSacola();
  });
  dialogo.addEventListener("close", () => {
    modoEnviado = false;
    destravarFundo(); // também quando fecha pelo botão "voltar" ou pela tecla Esc
  });
  $$("[data-abrir-sacola]").forEach((b) => b.addEventListener("click", abrirSacola));
  $("[data-fechar-sacola]").addEventListener("click", fecharSacola);
  $$("[data-montar-outro]").forEach((b) => b.addEventListener("click", irParaMontador));

  function itemDaSacola(c) {
    const li = document.createElement("li");
    li.className = "pedido-item";
    li.dataset.id = c.id;
    const frutas = nomesDoGrupo(c.itens, "frutas");
    const acomp = nomesDoGrupo(c.itens, "acompanhamentos");
    const fora = c.itens.filter((id) => esgotados.has(id)).map((id) => ITEM[id].nome);
    li.innerHTML = `
      <div class="pedido-copo" aria-hidden="true"></div>
      <div class="pedido-info">
        <h3>Açaí ${esc(TAMANHO[c.tamanho].nome)}</h3>
        <p>${frutas.length ? `Frutas: ${esc(frutas.join(", "))}` : "Sem frutas"}</p>
        <p>${acomp.length ? `Acompanhamentos: ${esc(acomp.join(", "))}` : "Sem acompanhamentos"}</p>
        ${
          fora.length
            ? `<p class="pedido-esgotado"><span>${esc(listaNatural(fora))} ${fora.length > 1 ? "esgotaram" : "esgotou"} agora.</span><button type="button" data-tirar-esgotados>Tirar do copo</button></p>`
            : ""
        }
        <div class="pedido-acoes">
          <div class="qtd" role="group" aria-label="Quantidade">
            <button type="button" data-qtd="-1" aria-label="Diminuir quantidade" ${c.qtd <= 1 ? "disabled" : ""}>−</button>
            <output>${c.qtd}</output>
            <button type="button" data-qtd="1" aria-label="Aumentar quantidade">+</button>
          </div>
          <button type="button" class="btn-remover" data-remover>Remover</button>
        </div>
      </div>
      <p class="pedido-preco">${dinheiro(arred(precoCopo(c.tamanho, c.itens) * c.qtd))}</p>`;
    criarCopo($(".pedido-copo", li), { estatico: true }).desenhar(c.tamanho, new Set(c.itens));
    return li;
  }

  $("[data-pedido-lista]").addEventListener("click", (e) => {
    const li = e.target.closest(".pedido-item");
    if (!li) return;
    const c = sacola.find((x) => x.id === li.dataset.id);
    if (!c) return;
    const botaoQtd = e.target.closest("[data-qtd]");
    if (botaoQtd) {
      c.qtd = Math.max(1, c.qtd + Number(botaoQtd.dataset.qtd));
      salvarSacola();
      $(`[data-id="${c.id}"] [data-qtd="${botaoQtd.dataset.qtd}"]`, dialogo)?.focus();
    } else if (e.target.closest("[data-remover]")) {
      sacola = sacola.filter((x) => x !== c);
      salvarSacola();
    } else if (e.target.closest("[data-tirar-esgotados]")) {
      c.itens = c.itens.filter((id) => !esgotados.has(id));
      // se ficou igual a outro copo da sacola, junta os dois
      const igual = sacola.find((x) => x !== c && x.tamanho === c.tamanho && x.itens.join() === c.itens.join());
      if (igual) {
        igual.qtd += c.qtd;
        sacola = sacola.filter((x) => x !== c);
      }
      if (!sacola.some(temEsgotado)) $("[data-erro]").textContent = "";
      vibrar(10);
      salvarSacola();
    }
  });

  function calcularTotais() {
    const subtotal = arred(sacola.reduce((s, c) => s + precoCopo(c.tamanho, c.itens) * c.qtd, 0));
    const desconto = descontoDoCupom(subtotal);
    return { subtotal, entrega: TAXA, desconto, total: arred(subtotal + TAXA - desconto) };
  }

  function renderSacola() {
    const vazia = sacola.length === 0;
    $("[data-sacola-vazia]").hidden = !vazia || modoEnviado;
    $("[data-sacola-cheia]").hidden = vazia || modoEnviado;
    $("[data-sacola-rodape]").hidden = vazia || modoEnviado;
    $("[data-enviado]").hidden = !modoEnviado;
    $("[data-pedido-lista]").replaceChildren(...sacola.map(itemDaSacola));
    atualizarTotais();
  }

  function atualizarTotais() {
    const t = calcularTotais();
    $("[data-linha-subtotal]").hidden = !TAXA && !t.desconto;
    $("[data-linha-entrega]").hidden = !TAXA;
    $("[data-linha-desconto]").hidden = !t.desconto;
    $("[data-subtotal]").textContent = dinheiro(t.subtotal);
    $("[data-entrega]").textContent = dinheiro(t.entrega);
    $("[data-desconto-rotulo]").textContent = cupom ? `Cupom ${cupom.codigo}` : "Desconto";
    $("[data-desconto]").textContent = `− ${dinheiro(t.desconto)}`;
    $("[data-total-pedido]").textContent = dinheiro(t.total);
    if (cupom) {
      const falta = cupom.pedido_minimo ? arred(cupom.pedido_minimo - t.subtotal) : 0;
      if (falta > 0) {
        mostrarCupom(`Esse cupom vale para pedidos a partir de ${dinheiro(cupom.pedido_minimo)}. Faltam ${dinheiro(falta)}.`, "aviso");
      } else mostrarCupom(`Cupom aplicado: ${descreverCupom(cupom)}.`, "ok");
    }
  }

  /* ---------- cupom de desconto (conferido no painel) ---------- */
  let cupom = null; // { codigo, tipo: "percentual" | "valor", valor, pedido_minimo }
  const campoCupom = form.elements.cupom;
  const botaoCupom = $("[data-aplicar-cupom]");
  $("[data-bloco-cupom]").hidden = !PAINEL;

  function descontoDoCupom(subtotal) {
    if (!cupom || (cupom.pedido_minimo && subtotal < cupom.pedido_minimo)) return 0;
    const v = cupom.tipo === "percentual" ? (subtotal * cupom.valor) / 100 : cupom.valor;
    return arred(Math.min(v, subtotal));
  }

  function descreverCupom(c) {
    const numero = (v) => String(v).replace(".", ",");
    return c.tipo === "percentual" ? `${numero(c.valor)}% de desconto` : `${dinheiro(c.valor)} de desconto`;
  }

  function mostrarCupom(texto, tipo = "") {
    const el = $("[data-cupom-status]");
    el.textContent = texto;
    el.dataset.tipo = tipo;
  }

  function atualizarBotaoCupom() {
    botaoCupom.textContent = cupom ? "Remover" : "Aplicar";
    botaoCupom.classList.toggle("aplicado", !!cupom);
    campoCupom.readOnly = !!cupom;
  }

  function limparCupom() {
    cupom = null;
    campoCupom.value = "";
    campoCupom.removeAttribute("aria-invalid");
    mostrarCupom("");
    atualizarBotaoCupom();
  }

  function chamarPainel(caminho, corpo, { headers = {}, keepalive = false } = {}) {
    return fetch(`${PAINEL.url.replace(/\/+$/, "")}/rest/v1/${caminho}`, {
      method: "POST",
      headers: { apikey: PAINEL.chave, "Content-Type": "application/json", ...headers },
      body: JSON.stringify(corpo),
      keepalive,
    });
  }

  // Cupons de "uma vez por cliente" já usados neste celular.
  // (O banco também confere pelo apartamento, que é o que vale de verdade.)
  const cuponsUsadosAqui = () => {
    const lista = ler("ganath:cupons-usados", []);
    return Array.isArray(lista) ? lista : [];
  };
  function marcarCupomUsado(codigo) {
    const lista = cuponsUsadosAqui().filter((c) => c !== codigo);
    lista.push(codigo);
    guardar("ganath:cupons-usados", lista.slice(-50));
  }

  // cupom recusado: limpa o campo e diz o motivo
  function recusarCupom(texto) {
    cupom = null;
    campoCupom.value = "";
    campoCupom.removeAttribute("aria-invalid");
    mostrarCupom(texto, "erro");
  }

  async function aplicarCupom({ silencioso = false } = {}) {
    const codigo = campoCupom.value.replace(/\s+/g, "").toUpperCase();
    if (!codigo) {
      mostrarCupom("Digite o código do cupom.", "erro");
      campoCupom.focus();
      return;
    }
    botaoCupom.disabled = true;
    if (!silencioso) mostrarCupom("Conferindo o cupom…");
    try {
      const resp = await chamarPainel("rpc/conferir_cupom", {
        p_codigo: codigo,
        p_predio: form.elements.predio.value.trim() || null,
        p_apartamento: form.elements.apto.value.trim() || null,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const c = await resp.json();
      if (c && c.erro === "ja_usado") {
        recusarCupom(`O cupom ${codigo} já foi usado no seu apartamento. Ele vale uma vez por cliente.`);
      } else if (c && c.codigo) {
        if (c.uso_unico && cuponsUsadosAqui().includes(c.codigo)) {
          recusarCupom(`Você já usou o cupom ${c.codigo} neste celular. Ele vale uma vez por cliente.`);
        } else {
          cupom = {
            codigo: c.codigo,
            tipo: c.tipo,
            valor: Number(c.valor),
            pedido_minimo: c.pedido_minimo == null ? null : Number(c.pedido_minimo),
            uso_unico: !!c.uso_unico,
          };
          campoCupom.value = cupom.codigo;
          campoCupom.removeAttribute("aria-invalid");
          if (!silencioso) vibrar(12);
        }
      } else {
        recusarCupom(`Cupom ${codigo} não encontrado ou fora da validade.`);
      }
    } catch {
      // sem internet: na conferência silenciosa mantém o cupom (o banco confere de novo ao receber o pedido)
      if (!silencioso) mostrarCupom("Não deu para conferir o cupom agora. Tente de novo em instantes.", "erro");
    } finally {
      botaoCupom.disabled = false;
      atualizarBotaoCupom();
      atualizarTotais();
    }
  }

  // Trocou a torre ou o apartamento depois de aplicar? Confere de novo.
  for (const nome of ["predio", "apto"]) {
    form.elements[nome].addEventListener("change", () => {
      if (cupom && cupom.uso_unico) aplicarCupom({ silencioso: true });
    });
  }

  botaoCupom.addEventListener("click", () => {
    if (cupom) {
      limparCupom();
      atualizarTotais();
      campoCupom.focus();
    } else aplicarCupom();
  });
  campoCupom.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!cupom) aplicarCupom();
  });
  campoCupom.addEventListener("input", () => {
    if (!cupom) mostrarCupom("");
  });

  /* ---------- formulário ---------- */

  function renderPagamentos() {
    $("[data-bloco-pagamento]").hidden = PAGAMENTOS.length === 0;
    $("[data-pagamentos]").innerHTML = PAGAMENTOS.map(
      (p, i) => `
        <label><input class="sr-input" type="radio" name="pagamento" value="${esc(p)}" ${i === 0 ? "checked" : ""}><span>${esc(p)}</span></label>`,
    ).join("");
  }

  const pagamentoEscolhido = () => (PAGAMENTOS.length ? form.elements.pagamento?.value || "" : "");

  function atualizarFormulario() {
    $("[data-bloco-troco]").hidden = pagamentoEscolhido() !== "Dinheiro";
  }

  const CAMPOS_SALVOS = ["nome", "predio", "apto", "pagamento"];

  function restaurarDados() {
    const dados = ler("ganath:dados", {});
    for (const nome of CAMPOS_SALVOS) {
      const campo = form.elements[nome];
      if (!campo || dados[nome] == null) continue;
      if (typeof RadioNodeList !== "undefined" && campo instanceof RadioNodeList) {
        const opcao = [...campo].find((r) => r.value === dados[nome]);
        if (opcao) opcao.checked = true;
      } else if (campo.type === "radio") {
        campo.checked = campo.value === dados[nome];
      } else campo.value = dados[nome];
    }
  }

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target.value.trim()) {
      e.target.removeAttribute("aria-invalid");
    }
    guardar(
      "ganath:dados",
      Object.fromEntries(CAMPOS_SALVOS.map((n) => [n, n === "pagamento" ? pagamentoEscolhido() : form.elements[n]?.value ?? ""])),
    );
  });
  form.addEventListener("change", atualizarFormulario);

  const ROTULOS = { nome: "seu nome", predio: "a torre", apto: "o apartamento" };

  function lerTroco() {
    const bruto = form.elements.troco.value.trim();
    if (!bruto) return null;
    const n = parseFloat(bruto.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function validar() {
    if (!sacola.length) return "Sua sacola está vazia.";
    const comEsgotado = sacola.filter(temEsgotado);
    if (comEsgotado.length) {
      const fora = [...new Set(comEsgotado.flatMap((c) => c.itens.filter((id) => esgotados.has(id))))].map((id) => ITEM[id].nome);
      $(`[data-id="${comEsgotado[0].id}"]`, dialogo)?.scrollIntoView({ behavior: rolagem(), block: "center" });
      return `${listaNatural(fora)} ${fora.length > 1 ? "esgotaram" : "esgotou"}. Toque em "Tirar do copo" para continuar.`;
    }
    let primeiro = null;
    for (const nome of ["nome", "predio", "apto"]) {
      const campo = form.elements[nome];
      const vazio = !campo.value.trim();
      if (vazio) campo.setAttribute("aria-invalid", "true");
      else campo.removeAttribute("aria-invalid");
      if (vazio && !primeiro) primeiro = campo;
    }
    if (primeiro) {
      primeiro.focus();
      return `Preencha ${ROTULOS[primeiro.name]} para continuar.`;
    }
    if (pagamentoEscolhido() === "Dinheiro") {
      const troco = lerTroco();
      const total = calcularTotais().total;
      if (Number.isNaN(troco)) {
        form.elements.troco.focus();
        return "Escreva o troco só com números. Ex.: 50";
      }
      if (troco !== null && troco < total) {
        form.elements.troco.focus();
        return `O troco precisa ser maior que o total de ${dinheiro(total)}.`;
      }
    }
    // O cupom nunca trava o pedido: sem cupom aplicado, o pedido vai sem desconto.
    return "";
  }

  // Código curto do pedido: aparece no WhatsApp e no painel, para achar um no outro.
  const LETRAS_CODIGO = "ACDEFHJKMNPRTUVWXY34679";
  function novoCodigo() {
    const n = new Uint32Array(4);
    try {
      crypto.getRandomValues(n);
    } catch {
      n.forEach((_, i) => (n[i] = Math.floor(Math.random() * 1e9)));
    }
    return Array.from(n, (x) => LETRAS_CODIGO[x % LETRAS_CODIGO.length]).join("");
  }

  // Também manda o pedido para o painel. Se falhar, tudo bem: o WhatsApp é o caminho principal.
  function enviarAoPainel(codigo, t) {
    if (!PAINEL) return;
    const f = form.elements;
    const pagamento = pagamentoEscolhido();
    const troco = pagamento === "Dinheiro" ? lerTroco() : null;
    const dados = {
      codigo,
      nome: f.nome.value.trim().slice(0, 60),
      predio: f.predio.value.trim().slice(0, 20),
      apartamento: f.apto.value.trim().slice(0, 20),
      pagamento: pagamento ? pagamento.slice(0, 30) : null,
      troco: troco > 0 && troco < 10000 ? arred(troco) : null,
      observacoes: f.obs.value.trim().slice(0, 500) || null,
      copos: sacola.slice(0, 30).map((c) => ({ tamanho: c.tamanho, itens: c.itens, qtd: c.qtd, preco: precoCopo(c.tamanho, c.itens) })),
      subtotal: t.subtotal,
      cupom: cupom ? cupom.codigo : null,
      desconto: t.desconto,
      total: t.total,
      loja_fechada: !!(statusAtual && !statusAtual.aberto),
    };
    const enviar = (keepalive) => chamarPainel("pedidos", dados, { keepalive, headers: { Prefer: "return=minimal" } });
    try {
      enviar(true)
        .catch(() => enviar(false))
        .catch(() => {});
    } catch {
      /* sem rede: segue só pelo WhatsApp */
    }
  }

  function montarMensagem(codigo) {
    const f = form.elements;
    const t = calcularTotais();
    const linhas = [`*Pedido ${codigo} - ${L.nome}*`];
    if (statusAtual && !statusAtual.aberto) linhas.push("_(enviado com a loja fechada)_");
    linhas.push("");

    for (const c of sacola) {
      const frutas = nomesDoGrupo(c.itens, "frutas");
      const acomp = nomesDoGrupo(c.itens, "acompanhamentos");
      linhas.push(`*${c.qtd}x Açaí ${TAMANHO[c.tamanho].nome}* - ${dinheiro(arred(precoCopo(c.tamanho, c.itens) * c.qtd))}`);
      linhas.push(`Frutas: ${frutas.length ? frutas.join(", ") : "nenhuma"}`);
      linhas.push(`Acompanhamentos: ${acomp.length ? acomp.join(", ") : "nenhum"}`);
      linhas.push("");
    }

    if (TAXA || t.desconto) linhas.push(`Subtotal: ${dinheiro(t.subtotal)}`);
    if (TAXA) linhas.push(`Entrega: ${dinheiro(t.entrega)}`);
    if (t.desconto) linhas.push(`Cupom ${cupom.codigo}: -${dinheiro(t.desconto)}`);
    linhas.push(`*Total: ${dinheiro(t.total)}*`, "");

    linhas.push(`*Nome:* ${f.nome.value.trim()}`);
    linhas.push(`*Torre:* ${f.predio.value.trim()}`);
    linhas.push(`*Apartamento:* ${f.apto.value.trim()}`);

    const pagamento = pagamentoEscolhido();
    if (pagamento) {
      const troco = pagamento === "Dinheiro" ? lerTroco() : null;
      linhas.push(`*Pagamento:* ${pagamento}${troco ? ` (troco para ${dinheiro(troco)})` : ""}`);
    }
    if (f.obs.value.trim()) linhas.push(`*Observações:* ${f.obs.value.trim()}`);

    return linhas.join("\n");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const erro = validar();
    $("[data-erro]").textContent = erro;
    if (erro) return;

    const codigo = novoCodigo();
    const url = `https://wa.me/${String(L.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(montarMensagem(codigo))}`;
    $("[data-link-pedido]").href = url;
    enviarAoPainel(codigo, calcularTotais());
    if (cupom && cupom.uso_unico) marcarCupomUsado(cupom.codigo); // este celular não usa de novo
    guardar("ganath:ultimo", {
      data: Date.now(),
      copos: sacola.map(({ tamanho, itens, qtd }) => ({ tamanho, itens, qtd })),
    });
    renderRepetir();
    celebrar = true;

    const janela = window.open(url, "_blank");
    if (janela) janela.opener = null;
    else location.href = url;

    // pedido finalizado: a sacola esvazia. Se a pessoa não chegar a enviar no WhatsApp,
    // o "Pedir de novo" (ou o link "toque aqui") recupera tudo.
    sacola = [];
    guardar("ganath:sacola", sacola);
    limparCupom();
    atualizarContador();
    modoEnviado = true;
    renderSacola();
    $(".sacola-corpo").scrollTop = 0;
  });

  /* ---------- aviso rápido ---------- */
  let timerAviso;
  function avisar(texto) {
    const aviso = $("[data-aviso]");
    $("[data-aviso-texto]").textContent = texto;
    aviso.hidden = false;
    aviso.style.animation = "none";
    void aviso.offsetWidth;
    aviso.style.animation = "";
    clearTimeout(timerAviso);
    timerAviso = setTimeout(esconderAviso, 4500);
  }
  function esconderAviso() {
    clearTimeout(timerAviso);
    $("[data-aviso]").hidden = true;
  }

  /* ============================================================
     Aberto/fechado, pedir de novo e festa de frutas
     ============================================================ */

  /* ---------- aberto / fechado: vocês ligam e desligam pelo painel ---------- */
  let statusAtual = null; // { aberto: true | false }, ou null se não deu para saber

  async function lerStatusLoja() {
    if (!PAINEL) return null;
    try {
      const resp = await fetch(`${PAINEL.url.replace(/\/+$/, "")}/rest/v1/loja?select=aberta,esgotados&id=eq.1`, {
        headers: { apikey: PAINEL.chave },
        cache: "no-store",
      });
      if (!resp.ok) return statusAtual; // mantém o último que se sabia
      const [linha] = await resp.json();
      return linha ? { aberto: !!linha.aberta, esgotados: Array.isArray(linha.esgotados) ? linha.esgotados : [] } : null;
    } catch {
      return statusAtual; // sem internet: mantém o último que se sabia
    }
  }

  async function atualizarStatus() {
    statusAtual = await lerStatusLoja();
    if (statusAtual) aplicarEsgotados(statusAtual.esgotados);
    const el = $("[data-status]");
    const aviso = $("[data-aviso-fechado]");
    el.hidden = !statusAtual;
    aviso.hidden = !statusAtual || statusAtual.aberto;
    if (!statusAtual) return;
    el.classList.toggle("aberto", statusAtual.aberto);
    $("[data-status-texto]").textContent = statusAtual.aberto ? "Aberto agora" : "Fechado no momento";
    if (!statusAtual.aberto) {
      aviso.textContent = "Estamos fechados agora. Pode enviar o pedido mesmo assim: a gente responde assim que abrir.";
    }
  }

  /* ---------- esgotados: vocês marcam no painel ----------
     O item fica cinza e não dá para escolher. Se estava no copo sendo montado, sai.
     Se já estava na sacola, o copo mostra "esgotou" com o botão "Tirar do copo". */
  function aplicarEsgotados(lista) {
    const novo = new Set((Array.isArray(lista) ? lista : []).filter((id) => ITEM[id]));
    if (novo.size === esgotados.size && [...novo].every((id) => esgotados.has(id))) return;
    esgotados = novo;

    $$(".ingrediente input").forEach((inp) => {
      const fora = esgotados.has(inp.value);
      inp.disabled = fora;
      const label = inp.closest(".ingrediente");
      label.classList.toggle("esgotado", fora);
      $(".ingrediente-preco", label).textContent = fora ? "Esgotado" : `+ ${dinheiro(ITEM[inp.value].preco)}`;
    });

    $$("[data-classico]").forEach((b) => {
      const c = CLASSICOS[+b.dataset.classico];
      const fora = c.itens.filter((id) => esgotados.has(id)).map((id) => minuscula(ITEM[id].nome));
      b.disabled = fora.length > 0;
      b.title = fora.length ? `Hoje sem ${listaNatural(fora)}` : "";
    });

    const tirados = [...montagem.itens].filter((id) => esgotados.has(id));
    if (tirados.length) {
      tirados.forEach((id) => montagem.itens.delete(id));
      atualizarMontagem();
      if (!dialogo.open) {
        const nomes = tirados.map((id) => ITEM[id].nome);
        avisar(`${listaNatural(nomes)} ${nomes.length > 1 ? "esgotaram" : "esgotou"} e ${nomes.length > 1 ? "saíram" : "saiu"} do seu copo.`);
      }
    }

    if (dialogo.open && !modoEnviado) renderSacola();
  }

  /* ---------- pedir de novo ---------- */
  function lerUltimo() {
    const u = ler("ganath:ultimo", null);
    if (!u || !Array.isArray(u.copos)) return null;
    const copos = u.copos
      .filter((c) => c && TAMANHO[c.tamanho])
      .map((c) => ({
        tamanho: c.tamanho,
        itens: (c.itens || []).filter((id) => ITEM[id]),
        qtd: Math.max(1, c.qtd | 0),
      }));
    return copos.length ? { ...u, copos } : null;
  }

  function descreverCopo(c) {
    const nomes = c.itens.map((id) => minuscula(ITEM[id].nome));
    return `Açaí ${TAMANHO[c.tamanho].nome}${nomes.length ? ` com ${listaNatural(nomes)}` : " puro"}`;
  }

  function renderRepetir() {
    const u = lerUltimo();
    const box = $("[data-repetir]");
    box.hidden = !u;
    if (!u) return;
    const total = u.copos.reduce((s, c) => s + c.qtd, 0);
    const primeiro = u.copos[0];
    $("[data-repetir-resumo]").textContent =
      u.copos.length === 1
        ? `${primeiro.qtd > 1 ? `${primeiro.qtd}x ` : ""}${descreverCopo(primeiro)}`
        : `${total} copos: ${descreverCopo(primeiro)} e mais`;
    criarCopo($("[data-repetir-copo]"), { estatico: true }).desenhar(primeiro.tamanho, new Set(primeiro.itens));
  }

  $("[data-repetir-botao]").addEventListener("click", () => {
    const u = lerUltimo();
    if (!u) return;
    for (const c of u.copos) {
      const igual = sacola.find((x) => x.tamanho === c.tamanho && x.itens.join() === c.itens.join());
      if (igual) igual.qtd += c.qtd;
      else sacola.push({ id: novoId(), ...c });
    }
    salvarSacola();
    pularContador();
    vibrar([10, 40, 10]);
    abrirSacola();
  });

  /* ---------- festa de frutas quando a pessoa volta do WhatsApp ---------- */
  let celebrar = false;

  function festa() {
    if (semMovimento()) return;
    const u = lerUltimo();
    const doPedido = [...new Set((u?.copos || []).flatMap((c) => c.itens))].map((id) => ITEM[id].img);
    const fotos = doPedido.length >= 3 ? doPedido : ITENS.map((i) => i.img);
    const palco = dialogo.open ? dialogo : document.body;
    const cx = innerWidth / 2;
    const cy = innerHeight * 0.42;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement("span");
      p.className = "confete";
      const t = 16 + Math.random() * 24;
      p.style.cssText = `width:${t}px;height:${t}px;left:${cx - t / 2}px;top:${cy - t / 2}px;background-image:url("${fotos[i % fotos.length]}")`;
      palco.append(p);
      const ang = Math.random() * Math.PI * 2;
      const forca = 110 + Math.random() * 190;
      const dx = Math.cos(ang) * forca;
      const dy = Math.sin(ang) * forca - 150;
      p.animate(
        [
          { transform: "translate(0, 0) scale(0.3) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.42 },
          { transform: `translate(${dx * 1.15}px, ${dy + 460}px) scale(0.9) rotate(${Math.random() * 720}deg)`, opacity: 0 },
        ],
        { duration: 1500 + Math.random() * 800, easing: "cubic-bezier(.2,.7,.35,1)" },
      ).finished.finally(() => p.remove());
    }
    vibrar([15, 60, 15]);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    atualizarStatus(); // a loja pode ter aberto/fechado enquanto a pessoa estava em outro app
    if (celebrar) {
      celebrar = false;
      setTimeout(festa, 300);
    }
  });

  /* ---------- informações da loja ---------- */
  function preencherLoja() {
    document.title = `${L.nome} | Monte o seu açaí`;

    const infos = [
      ["Endereço", L.endereco],
      ["Entrega", TAXA ? `${dinheiro(TAXA)}, até o seu apartamento` : "Grátis, até o seu apartamento"],
      ["Horário", L.horario],
      ["Pagamento", PAGAMENTOS.length ? listaNatural(PAGAMENTOS.map((p, i) => (i ? minuscula(p) : p))) : ""],
    ].filter(([, valor]) => valor);
    $("[data-infos]").innerHTML = infos.map(([rotulo, valor]) => `<div><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`).join("");

    const whats = $("[data-link-whats]");
    whats.href = `https://wa.me/${String(L.whatsapp).replace(/\D/g, "")}`;
    whats.textContent = L.telefoneExibicao;
    whats.target = "_blank";
    whats.rel = "noopener";
    $("[data-rodape-endereco]").textContent = L.endereco || "";
  }

  /* ---------- início ---------- */
  renderTamanhos();
  renderIngredientes();
  renderClassicos();
  renderPagamentos();
  preencherLoja();
  restaurarDados();
  atualizarFormulario();
  atualizarContador();
  atualizarMontagem();
  marcarAba(0);
  atualizarStatus();
  setInterval(atualizarStatus, 30 * 1000);
  renderRepetir();
})();
