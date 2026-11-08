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

  const precoCopo = (tamanho, itens) =>
    arred(TAMANHO[tamanho].preco + [...itens].reduce((s, id) => s + (ITEM[id]?.preco || 0), 0));

  const listaNatural = (arr) =>
    arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;

  const minuscula = (nome) => (/^Nutella/.test(nome) ? nome : nome.charAt(0).toLowerCase() + nome.slice(1));

  const nomesDoGrupo = (ids, grupo) => ids.filter((id) => ITEM[id].grupo === grupo).map((id) => ITEM[id].nome);

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
          <div class="copo-fatias"></div>
          ${CALDAS.map(
            (c, i) =>
              `<div class="calda" data-id="${esc(c.id)}" style="--giro:${GIRO_CALDA[i % GIRO_CALDA.length]}deg;background-image:url('${esc(c.calda)}')"></div>`,
          ).join("")}
          <div class="copo-brilho"></div>
        </div>
      </div>`;
    alvo.replaceChildren(el);
    if (chegada) el.addEventListener("animationend", () => el.classList.remove("copo-chegada"), { once: true });

    const caixa = $(".copo-fatias", el);
    const caldas = $$(".calda", el);
    const fatias = new Map();

    function desenhar(tamanho, itens) {
      el.style.setProperty("--escala", ESCALA[tamanho] ?? 1);

      const lista = ITENS.filter((i) => itens.has(i.id) && !i.calda);
      const n = lista.length;
      const arco = n === 0 ? 0 : n < 5 ? 72 : 360 / n;
      const inicio = -(arco * n) / 2;

      for (const [id, f] of fatias) {
        if (itens.has(id)) continue;
        fatias.delete(id);
        if (estatico) {
          f.remove();
          continue;
        }
        const ini = parseFloat(f.style.getPropertyValue("--ini")) || 0;
        const a = parseFloat(f.style.getPropertyValue("--arco")) || 0;
        f.style.setProperty("--ini", `${ini + a / 2}deg`);
        f.style.setProperty("--arco", "0deg");
        setTimeout(() => f.remove(), 800);
      }

      lista.forEach((item, i) => {
        const ini = inicio + i * arco;
        let f = fatias.get(item.id);
        if (!f) {
          f = document.createElement("div");
          f.className = "fatia";
          const foto = document.createElement("div");
          foto.className = "fatia-foto";
          foto.style.backgroundImage = `url("${item.img}")`;
          f.append(foto);
          f.style.setProperty("--ini", `${ini + arco / 2}deg`);
          f.style.setProperty("--arco", "0deg");
          caixa.append(f);
          fatias.set(item.id, f);
          if (!estatico) f.getBoundingClientRect(); // fixa o estado inicial antes de animar
        }
        f.style.setProperty("--ini", `${ini}deg`);
        f.style.setProperty("--arco", `${arco}deg`);
      });

      caldas.forEach((c) => c.classList.toggle("ativa", itens.has(c.dataset.id)));
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
  const copoMini = criarCopo($("[data-copo-mini]"));
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
        { duration: 600, easing: "cubic-bezier(.4,.05,.5,1)" },
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
      atualizarMontagem({ atraso: voou ? 400 : 0 });
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
    else
      sacola.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tamanho: montagem.tamanho,
        itens,
        qtd: 1,
      });
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

  function abrirSacola() {
    esconderAviso();
    renderSacola();
    if (!dialogo.open) dialogo.showModal();
  }

  function fecharSacola() {
    if (dialogo.open) dialogo.close();
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
    li.innerHTML = `
      <div class="pedido-copo" aria-hidden="true"></div>
      <div class="pedido-info">
        <h3>Açaí ${esc(TAMANHO[c.tamanho].nome)}</h3>
        <p>${frutas.length ? `Frutas: ${esc(frutas.join(", "))}` : "Sem frutas"}</p>
        <p>${acomp.length ? `Acompanhamentos: ${esc(acomp.join(", "))}` : "Sem acompanhamentos"}</p>
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
    }
  });

  function calcularTotais() {
    const subtotal = arred(sacola.reduce((s, c) => s + precoCopo(c.tamanho, c.itens) * c.qtd, 0));
    return { subtotal, entrega: TAXA, total: arred(subtotal + TAXA) };
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
    $("[data-linha-subtotal]").hidden = !TAXA;
    $("[data-linha-entrega]").hidden = !TAXA;
    $("[data-subtotal]").textContent = dinheiro(t.subtotal);
    $("[data-entrega]").textContent = dinheiro(t.entrega);
    $("[data-total-pedido]").textContent = dinheiro(t.total);
  }

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

  const ROTULOS = { nome: "seu nome", predio: "o prédio", apto: "o apartamento" };

  function lerTroco() {
    const bruto = form.elements.troco.value.trim();
    if (!bruto) return null;
    const n = parseFloat(bruto.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function validar() {
    if (!sacola.length) return "Sua sacola está vazia.";
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
    return "";
  }

  function montarMensagem() {
    const f = form.elements;
    const t = calcularTotais();
    const linhas = [`*Pedido - ${L.nome}*`, ""];

    for (const c of sacola) {
      const frutas = nomesDoGrupo(c.itens, "frutas");
      const acomp = nomesDoGrupo(c.itens, "acompanhamentos");
      linhas.push(`*${c.qtd}x Açaí ${TAMANHO[c.tamanho].nome}* - ${dinheiro(arred(precoCopo(c.tamanho, c.itens) * c.qtd))}`);
      linhas.push(`Frutas: ${frutas.length ? frutas.join(", ") : "nenhuma"}`);
      linhas.push(`Acompanhamentos: ${acomp.length ? acomp.join(", ") : "nenhum"}`);
      linhas.push("");
    }

    if (TAXA) {
      linhas.push(`Subtotal: ${dinheiro(t.subtotal)}`);
      linhas.push(`Entrega: ${dinheiro(t.entrega)}`);
    }
    linhas.push(`*Total: ${dinheiro(t.total)}*`, "");

    linhas.push(`*Nome:* ${f.nome.value.trim()}`);
    linhas.push(`*Prédio:* ${f.predio.value.trim()}`);
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

    const url = `https://wa.me/${String(L.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(montarMensagem())}`;
    $("[data-link-pedido]").href = url;
    const janela = window.open(url, "_blank");
    if (janela) janela.opener = null;
    else location.href = url;

    modoEnviado = true;
    renderSacola();
    $(".sacola-corpo").scrollTop = 0;
  });

  $("[data-limpar-sacola]").addEventListener("click", () => {
    sacola = [];
    salvarSacola();
    irParaMontador();
  });
  $("[data-voltar-sacola]").addEventListener("click", () => {
    modoEnviado = false;
    renderSacola();
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
})();
