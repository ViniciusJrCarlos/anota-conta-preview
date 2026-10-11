const APP_VERSAO = "0.8";
const VERSAO_KEY = "anota-conta-versao-vista";
const dlg = document.getElementById("dlg");
let estado = carregar();
let atual = estado.mesAtual || mesHoje();
let tela = "mes";
let filtro = "todas";
let editando = null;
let tipoSel = "basico";
let formaSel = "Pix";
let selecao = null; // Set com os meses marcados no modo de seleção (aba Meses)
let catsExtraForm = new Set(); // categorias trazidas pelo "+ Categoria" enquanto o formulário está aberto
const dlgCat = document.getElementById("dlgCat");

function lista() {
  if (!estado.meses[atual]) estado.meses[atual] = [];
  return estado.meses[atual];
}
function cats() {
  if (!estado.categorias || !estado.categorias.length) estado.categorias = CATS_PADRAO.slice();
  return estado.categorias;
}
function catNome(id) {
  const c = cats().find(x => x.id === id);
  if (c) return c.nome;
  const s = String(id || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Sem categoria";
}
function catsDoMes(items) {
  const usados = new Set(items.map(i => i.tipo));
  const lista = cats().filter(c => usados.has(c.id));
  usados.forEach(id => { if (!lista.some(c => c.id === id)) lista.push({id, nome: catNome(id)}); });
  return lista;
}
function persist() { persistir(estado, atual); }

function ir(t) {
  if (t !== "meses" && selecao) { selecao = null; atualizarSelbar(); }
  tela = t;
  ["tMes","tMeses","tResumo","tMais"].forEach(id => document.getElementById(id).classList.remove("on"));
  const map = {mes:"tMes", meses:"tMeses", resumo:"tResumo", mais:"tMais"};
  document.getElementById(map[t]).classList.add("on");
  document.getElementById("fab").style.display = t === "mes" ? "block" : "none";
  render();
}
function shift(dlt) {
  const [y,m] = atual.split("-").map(Number);
  const d = new Date(y, m - 1 + dlt, 1);
  atual = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
  persist(); render();
}
function badge(st) {
  if (st === "pago") return ["OK","ok"];
  if (st === "nok") return ["NOK","nok"];
  return ["Pendente","wait"];
}
function render() {
  aplicarTema(estado);
  persist();
  const main = document.getElementById("main");
  if (tela === "mes") main.innerHTML = viewMes();
  else if (tela === "meses") main.innerHTML = viewMeses();
  else if (tela === "resumo") main.innerHTML = viewResumo();
  else main.innerHTML = viewMais();
}
function viewMes() {
  const items = lista();
  const usadas = catsDoMes(items);
  if (filtro !== "todas" && !usadas.some(c => c.id === filtro)) filtro = "todas";
  const vis = items.filter(i => filtro === "todas" || i.tipo === filtro);
  const somaTipo = (id) => items.filter(i => i.tipo === id).reduce((a,b)=>a+Number(b.valor||0),0);
  const totalMes = items.reduce((a,b)=>a+Number(b.valor||0),0);
  const htmlItems = vis.length ? vis.map(it => {
    const real = items.indexOf(it);
    const [lb, cls] = badge(it.status);
    const bits = [catNome(it.tipo), it.forma, it.data ? fmtData(it.data) : "", it.repete ? "repete" : "", it.obs].filter(Boolean);
    return `<article class="item ${it.status==="pago"?"pago":""}" data-idx="${real}">
      <button class="check" onclick="toggle(${real})"></button>
      <div onclick="abrirForm(${real})">
        <div class="name">${esc(it.nome)}</div>
        <div class="meta">${esc(bits.join(" · "))}</div>
        <span class="badge ${cls}">${lb}</span>
      </div>
      <div class="amt">${it.valor ? money(it.valor) : "—"}</div>
    </article>`;
  }).join("") : `<div class="empty">${items.length ? "Nada neste filtro." : "Nenhuma conta neste mês."}<br>Toque em + para anotar.</div>`;
  return `<p class="frase">Lembre o que vence. Agradeça por poder pagar.</p>
    <div class="month">
      <button class="nav-btn" onclick="shift(-1)">‹</button>
      <h1>${tituloMes(atual)}</h1>
      <button class="nav-btn" onclick="shift(1)">›</button>
    </div>
    <div class="stats">
      ${usadas.map(c => `<div class="stat"><b>${money(somaTipo(c.id))}</b><span>${esc(c.nome)}</span><i></i></div>`).join("")}
      <div class="stat total"><b>${money(totalMes)}</b><span>Total do mês</span><i></i></div>
    </div>
    <div class="chips">
      <button class="chip ${filtro==="todas"?"on":""}" onclick="filtro='todas';render()">Todas</button>
      ${usadas.map(c => `<button class="chip ${filtro===c.id?"on":""}" onclick="filtro='${esc(c.id)}';render()">${esc(c.nome)}</button>`).join("")}
    </div>
    <div class="list" id="listaContas">${htmlItems}</div>
    ${vis.length > 1 ? `<p class="hint ordem-dica">Segure uma conta e arraste para mudar a ordem.</p>` : ""}`;
}
function viewMeses() {
  const keys = Object.keys(estado.meses).sort().reverse();
  if (!keys.length) return `<div class="empty">Nenhum mês ainda.</div>`;
  return `<h2>Meses</h2>` + keys.map(k => {
    const arr = estado.meses[k] || [];
    const pagas = arr.filter(i => i.status==="pago").length;
    const tot = arr.reduce((a,b)=>a+Number(b.valor||0),0);
    const pct = arr.length ? Math.round(pagas/arr.length*100) : 0;
    const sel = selecao && selecao.has(k);
    return `<button type="button" class="card mes-card ${sel?"sel":""}" data-mes="${esc(k)}" aria-pressed="${sel?"true":"false"}">
      ${selecao ? `<span class="check" aria-hidden="true"></span>` : ""}
      <div class="mes-info">
        <div class="row"><strong>${tituloMes(k)}</strong><b>${money(tot)}</b></div>
        <div class="meta">${pagas} de ${arr.length} pagas</div>
        <div class="bar ${pct===100?"done":""}"><i style="width:${pct}%"></i></div>
      </div>
    </button>`;
  }).join("") + `<p class="hint">${selecao ? "Toque nos meses para marcar ou desmarcar." : "Segure um mês para selecionar e excluir. Salvo só neste aparelho."}</p>`;
}
function viewResumo() {
  const items = lista();
  const pago = items.filter(i => i.status==="pago").reduce((a,b)=>a+Number(b.valor||0),0);
  const pend = items.filter(i => i.status!=="pago").reduce((a,b)=>a+Number(b.valor||0),0);
  const max = Math.max(pago, pend, 1);
  const porCat = cats().map(c => ({
    nome: c.nome,
    v: items.filter(i => i.tipo===c.id).reduce((a,b)=>a+Number(b.valor||0),0)
  })).filter(x => x.v > 0).sort((a,b)=>b.v-a.v);
  const maxC = Math.max(...porCat.map(x=>x.v), 1);
  const porForma = FORMAS.map(f => ({
    nome: f,
    v: items.filter(i => (i.forma||"Outro")===f).reduce((a,b)=>a+Number(b.valor||0),0)
  })).filter(x => x.v > 0).sort((a,b)=>b.v-a.v);
  const maxF = Math.max(...porForma.map(x=>x.v), 1);
  return `<h2>Resumo · ${tituloMes(atual)}</h2>
    ${faixaAnoVisto()}
    <div class="card">
      <h3>Pago x pendente</h3>
      ${barra("Pago", pago, max)}
      ${barra("Pendente / NOK", pend, max)}
    </div>
    <div class="card">
      <h3>Onde mais saiu</h3>
      ${porCat.length ? porCat.map(x => barra(x.nome, x.v, maxC)).join("") : `<p class="hint">Sem valores neste mês.</p>`}
    </div>
    <div class="card">
      <h3>Pix, débito e crédito</h3>
      ${porForma.length ? porForma.map(x => barra(x.nome, x.v, maxF)).join("") : `<p class="hint">Marque a forma na conta para aparecer aqui.</p>`}
    </div>
    ${cardMaiores()}
    ${graficosResumo()}`;
}
/* ---------- Maiores pagamentos (v0.7): rosca com as 5 maiores contas + "Outras", no mês ou no ano ---------- */
let maioresModo = "mes"; // "mes" = mês aberto · "ano" = ano do mês aberto (contas de mesmo nome somadas)
function somaPorNome(listas) {
  const m = new Map();
  listas.flat().forEach(i => {
    const k = normNome(i.nome); if (!k) return;
    const x = m.get(k) || {nome: String(i.nome).trim(), v: 0};
    x.v += Number(i.valor || 0); m.set(k, x);
  });
  return [...m.values()].map(x => ({...x, v: Math.round(x.v * 100) / 100})).sort((a, b) => b.v - a.v);
}
function mesesDoAno(ano) { return Array.from({length: 12}, (_, m) => estado.meses[ano + "-" + String(m + 1).padStart(2, "0")] || []); }
function pctTxt(v) { return (v * 100).toLocaleString("pt-BR", {maximumFractionDigits: 1, minimumFractionDigits: v < 0.1 ? 1 : 0}) + "%"; }
function svgRosca(fatias, total, legenda) {
  const R = 58, C = 2 * Math.PI * R, S = 150, meio = S / 2;
  const gap = fatias.length > 1 ? 2 : 0;
  let acc = 0, arcos = "";
  fatias.forEach((f, k) => {
    const frac = f.v / total, len = Math.max(0.5, frac * C - gap);
    arcos += `<circle cx="${meio}" cy="${meio}" r="${R}" fill="none" class="d${f.outras ? 5 : k}" stroke-width="22"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}"
      transform="rotate(-90 ${meio} ${meio})"><title>${esc(f.nome)}: ${money(f.v)} (${pctTxt(frac)})</title></circle>`;
    acc += frac;
  });
  const txt = money(total), fs = txt.length > 13 ? 11.5 : txt.length > 11 ? 12.5 : 13.5;
  return `<svg class="rosca" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="Total ${esc(txt)} ${legenda}">
    <circle cx="${meio}" cy="${meio}" r="${R}" fill="none" stroke="var(--line)" stroke-width="22"/>${arcos}
    <text x="${meio}" y="${meio - 4}" text-anchor="middle" class="rosca-v" style="font-size:${fs}px">${esc(txt)}</text>
    <text x="${meio}" y="${meio + 14}" text-anchor="middle" class="rosca-l">${legenda}</text></svg>`;
}
function cardMaiores() {
  const ano = atual.slice(0, 4), noMes = maioresModo !== "ano";
  const todas = somaPorNome(noMes ? [lista()] : mesesDoAno(ano)).filter(x => x.v > 0);
  const total = Math.round(todas.reduce((a, x) => a + x.v, 0) * 100) / 100;
  const top = todas.slice(0, 5);
  const resto = Math.round(todas.slice(5).reduce((a, x) => a + x.v, 0) * 100) / 100;
  const fatias = top.concat(resto > 0 ? [{nome: `Outras (${todas.length - 5})`, v: resto, outras: true}] : []);
  const seg = `<div class="seg" role="group" aria-label="Período do gráfico">
      <button type="button" class="${noMes ? "on" : ""}" aria-pressed="${noMes}" onclick="maioresModo='mes';render()">Mês</button>
      <button type="button" class="${noMes ? "" : "on"}" aria-pressed="${!noMes}" onclick="maioresModo='ano';render()">Ano</button></div>`;
  const comDados = mesesDoAno(ano).map((a, m) => a.length ? m : -1).filter(m => m >= 0);
  const faixa = comDados.length ? MESES[comDados[0]] + (comDados.length > 1 ? "–" + MESES[comDados[comDados.length - 1]] : "") : "";
  const sub = noMes
    ? `${tituloMes(atual)} · ${todas.length === 1 ? "a única conta com valor" : todas.length > 5 ? "as 5 maiores contas do mês" : "as maiores contas do mês"}`
    : `${ano}${faixa ? " · soma de " + faixa + " por conta" : ""}`;
  const corpo = !fatias.length
    ? `<p class="hint maiores-vazio">${noMes
        ? (lista().length ? "As contas deste mês ainda estão sem valor. Coloque o valor nelas para ver o gráfico." : "Nenhuma conta neste mês ainda. Anote as contas para ver as maiores aqui.")
        : `Sem contas com valor em ${ano}.`}</p>`
    : `<div class="maiores">
      ${svgRosca(fatias, total, noMes ? "no mês" : "no ano")}
      <ol class="mlista">${fatias.map((f, k) => `<li><i class="d${f.outras ? 5 : k}"></i><span class="mn">${esc(f.nome)}</span>
        <b>${money(f.v)}</b><span class="mp">${pctTxt(f.v / total)}</span></li>`).join("")}</ol>
    </div>`;
  return `<div class="card maiores-card"><div class="row" style="align-items:center;gap:8px"><h3 style="margin:0">Maiores pagamentos</h3>${seg}</div>
    <p class="hint" style="margin:6px 0 4px">${sub}</p>${corpo}</div>`;
}
/* ---------- Gráficos do Resumo (v0.6): SVG feito aqui, sem biblioteca ---------- */
// Total de cada mês = soma das contas do mês, de todas as categorias (igual ao total do mês na tela).
function totaisPorAno() {
  const anos = {};
  Object.keys(estado.meses || {}).forEach(k => {
    if (!/^\d{4}-\d{2}$/.test(k)) return;
    const arr = estado.meses[k] || [];
    const m = Number(k.slice(5, 7)) - 1;
    if (!arr.length || m < 0 || m > 11) return;
    const a = anos[k.slice(0, 4)] = anos[k.slice(0, 4)] || {meses: Array(12).fill(null), total: 0, n: 0};
    const t = arr.reduce((s, i) => s + Number(i.valor || 0), 0);
    a.meses[m] = (a.meses[m] || 0) + t; a.total += t; a.n++;
  });
  return anos;
}
function passoGrafico(x) {
  const pot = Math.pow(10, Math.floor(Math.log10(x || 1))), m = x / pot;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pot;
}
function valorCurto(v) {
  if (v >= 1000) return (v / 1000).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " mil";
  return Math.round(v).toLocaleString("pt-BR");
}
function larguraGrafico() {
  const main = document.getElementById("main");
  const w = (main && main.clientWidth ? main.clientWidth : 360) - 32 - 30;
  return Math.max(260, Math.min(660, Math.round(w)));
}
// Cor de cada ano: o mais recente em amarelo, o anterior em azul-acinzentado, os mais antigos em cinza.
function classeAno(i, n) { return i === n - 1 ? "g2" : i === n - 2 ? "g1" : "g0"; }
/* ---------- Escolher ano no Resumo (v0.8) ----------
   Tocar num ano do "Total anual" abre um mês desse ano: o mesmo número de mês, se tiver contas; senão o último
   mês com contas do ano. O Resumo inteiro segue o mês aberto (cards do mês, rosca Mês/Ano). "Voltar pro ano atual"
   reabre o mês que estava aberto antes de escolher o ano. Não fica salvo: ao recarregar, o Resumo é o normal. */
let anoVisto = null, voltarPara = null;
function anoEmVista() {
  if (anoVisto && atual.slice(0, 4) !== anoVisto) { anoVisto = null; voltarPara = null; } // saiu do ano por outro caminho
  return anoVisto;
}
function mesParaAno(y) {
  const com = Array.from({length: 12}, (_, m) => y + "-" + String(m + 1).padStart(2, "0")).filter(k => (estado.meses[k] || []).length);
  const mesmo = y + atual.slice(4);
  return com.includes(mesmo) ? mesmo : com[com.length - 1] || null;
}
function verAno(y) {
  y = String(y);
  const anos = Object.keys(totaisPorAno());
  if (anos.length < 2 || !anos.includes(y)) return;
  if (anoEmVista() === y) return;
  if (anoVisto && voltarPara && voltarPara.slice(0, 4) === y) { voltarAnoAtual(); return; }
  if (!anoVisto && atual.slice(0, 4) === y) return; // já é o ano em vista
  const k = mesParaAno(y);
  if (!k) return;
  if (!anoVisto) voltarPara = atual;
  anoVisto = y; atual = k; persist(); render();
  window.scrollTo({top: 0, behavior: "smooth"});
  aviso(`Resumo de ${y} · ${tituloMes(k)}`);
}
function voltarAnoAtual() {
  const k = voltarPara;
  anoVisto = null; voltarPara = null;
  if (k) atual = k;
  persist(); render();
  window.scrollTo({top: 0, behavior: "smooth"});
}
function faixaAnoVisto() {
  const y = anoEmVista();
  if (!y) return "";
  return `<div class="ano-visto" role="status"><span>Vendo <b>${y}</b></span>
    <button type="button" class="chip" onclick="voltarAnoAtual()">Voltar pro ano atual${voltarPara ? " (" + voltarPara.slice(0, 4) + ")" : ""}</button></div>`;
}
// Cor de cada ano: o escolhido (ou o mais recente) em amarelo, o mais recente dos outros em azul, o resto em cinza.
function corAno(y, lista, sel) {
  if (!sel) return classeAno(lista.indexOf(y), lista.length);
  if (y === sel) return "g2";
  const outros = lista.filter(x => x !== sel);
  return y === outros[outros.length - 1] ? "g1" : "g0";
}
function teclaAno(e, y) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); verAno(y); } }
function pctVar(v) {
  return (v > 0 ? "+" : "") + (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "%";
}
function svgTotalMes(anos, lista, sel = null) {
  const W = larguraGrafico(), H = Math.round(Math.max(170, Math.min(230, W * 0.46)));
  const padL = 40, padR = 4, padT = 10, padB = 22, n = lista.length;
  const vals = lista.flatMap(y => anos[y].meses.filter(v => v != null));
  const maxV = Math.max(...vals, 1);
  const passo = passoGrafico(maxV / 4), topo = Math.ceil(maxV / passo) * passo;
  const alt = H - padT - padB, gw = (W - padL - padR) / 12;
  const inner = gw * (n === 1 ? 0.62 : 0.84), bw = inner / n;
  const yv = v => padT + alt - (v / topo) * alt;
  let g = "";
  for (let t = 0; t <= topo + 1e-9; t += passo) {
    const y = yv(t).toFixed(1);
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="grade"/><text x="${padL - 5}" y="${y}" dy="3.5" text-anchor="end">${valorCurto(t)}</text>`;
  }
  const fs = gw < 26 ? 9 : 10;
  for (let m = 0; m < 12; m++) {
    const x0 = padL + m * gw;
    lista.forEach((y, k) => {
      const v = anos[y].meses[m];
      if (v == null) return;
      const h = Math.max(v > 0 ? 1.5 : 0, (v / topo) * alt);
      const x = x0 + (gw - inner) / 2 + k * bw;
      g += `<rect x="${x.toFixed(1)}" y="${(padT + alt - h).toFixed(1)}" width="${Math.max(1, bw - (n > 1 ? 1 : 0)).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${corAno(y, lista, sel)}"><title>${MESES[m]} ${y}: ${money(v)}</title></rect>`;
    });
    g += `<text x="${(x0 + gw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" style="font-size:${fs}px">${MESES[m]}</text>`;
  }
  return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Total por mês ${lista.join(", ")}">${g}</svg>`;
}
function graficosResumo() {
  const anos = totaisPorAno();
  const lista = Object.keys(anos).sort();
  if (!lista.length) {
    return `<div class="card"><h3>Gráficos</h3><p class="hint" style="margin:0">Os gráficos de cada mês e de cada ano aparecem aqui quando você anotar contas.</p></div>`;
  }
  const sel = anoEmVista();
  // o ano escolhido entra no gráfico mesmo se for mais antigo: escolhido + os 2 mais recentes
  const ult = sel && !lista.slice(-3).includes(sel) ? [sel].concat(lista.filter(y => y !== sel).slice(-2)).sort() : lista.slice(-3);
  const n = ult.length;
  const legenda = n > 1
    ? `<div class="glegenda">${ult.map(y => `<span class="${y === sel ? "sel" : ""}"><i class="${corAno(y, ult, sel)}"></i>${y}</span>`).join("")}</div>`
    : "";
  const meses = y => `${anos[y].n} ${anos[y].n === 1 ? "mês com contas" : "meses com contas"}`;
  let anual;
  if (lista.length === 1) {
    const y = lista[0];
    anual = `<div class="ganual-um"><b>${money(anos[y].total)}</b><span>${y} · ${meses(y)}</span></div>`;
  } else {
    const maxT = Math.max(...lista.map(y => anos[y].total), 1);
    const emVista = sel || atual.slice(0, 4);
    anual = lista.map((y, i) => {
      const t = anos[y].total, ant = i ? anos[lista[i - 1]].total : null;
      const v = ant ? t / ant - 1 : null;
      const varTxt = v == null ? "" : `<span class="${v > 0 ? "nok-txt" : v < 0 ? "ok-txt" : ""}">${pctVar(v)} vs ${lista[i - 1]}</span> · `;
      const on = y === emVista;
      return `<div class="ganual-linha ${on ? "sel" : ""}" data-ano="${y}" role="button" tabindex="0" aria-pressed="${on}"
          aria-label="Ver o Resumo de ${y}: ${money(t)}" onclick="verAno('${y}')" onkeydown="teclaAno(event, '${y}')">
        <div class="ganual"><span class="ano">${y}</span><div class="track"><i class="${corAno(y, lista, sel)}" style="width:${Math.max(1, Math.round(t / maxT * 100))}%"></i></div><b>${money(t)}</b></div>
        <div class="ganual-sub">${varTxt}${meses(y)}</div></div>`;
    }).join("") + `<p class="hint" style="margin:8px 0 0">Toque num ano para ver o Resumo dele. Vermelho = gastou mais que no ano anterior; verde = gastou menos.</p>`;
  }
  return `<div class="card graf">
      <h3>Total por mês</h3>
      <p class="hint" style="margin:-4px 0 6px">${n > 1 ? ult.join(" x ") + (sel ? ` · destaque ${sel}` : lista.length > 3 ? " (últimos 3 anos)" : "") : ult[0]}</p>
      ${svgTotalMes(anos, ult, sel)}
      ${legenda}
    </div>
    <div class="card graf">
      <h3>Total anual</h3>
      ${anual}
    </div>`;
}
let resizeGraf = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeGraf);
  resizeGraf = setTimeout(() => {
    if (tela === "resumo" && !document.body.classList.contains("travado")) render();
  }, 150);
});
function barra(nome, v, max) {
  const pct = Math.round((v/max)*100);
  return `<div class="gbar"><span>${esc(nome)}</span><div class="track"><i style="width:${pct}%"></i></div><b>${money(v)}</b></div>`;
}
function viewMais() {
  const t = estado.tema;
  return `<h2>Aparência</h2>
    ${[["branca","Branca padrão"],["preta","Preta noturna"],["luz","Amarelo-luz"]].map(([k,l]) =>
      `<button class="card" style="width:100%;text-align:left;cursor:pointer;border-color:${t===k?"var(--marca)":"var(--line)"}"
        onclick="estado.tema='${k}';persist();render()"><strong>${l}</strong>${t===k?" · em uso":""}</button>`).join("")}
    <h2 style="margin-top:22px">Seus dados</h2>
    <button class="card" style="width:100%;text-align:left" onclick="exportarExcel()"><strong>Baixar Excel</strong><div class="meta">Todos os anos: resumo com gráficos e uma aba por ano, mês a mês</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="exportarBackup()"><strong>Exportar backup</strong><div class="meta">Baixa um arquivo .json com todos os meses, contas e categorias</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="document.getElementById('fileIn').click()"><strong>Importar backup</strong><div class="meta">Carrega um arquivo .json exportado pelo Anota Conta</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="abrirImportarExcel()"><strong>Importar planilha (Excel)</strong><div class="meta">Carrega um .xlsx do Baixar Excel (uma aba por ano) ou com uma aba por mês (JAN a DEZ)</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="copiarProx()">Copiar mês para o próximo</button>
    <div class="warn">O Excel traz um resumo com gráficos e uma aba por ano, com todos os meses, e pode ser importado de volta. O backup é o arquivo para guardar no Drive, no e-mail ou no WhatsApp e passar os dados para outro aparelho. Tudo continua neste aparelho.</div>
    ${appJaInstalado() ? "" : `<h2 style="margin-top:22px">App</h2>
    <button class="card" id="maisInstalar" style="width:100%;text-align:left" onclick="abrirInstalar()"><strong>Instalar app</strong><div class="meta">Coloca o Anota Conta na tela inicial ou na área de trabalho e usa offline</div></button>`}
    <h2 style="margin-top:22px">Acesso</h2>
    <button class="card" style="width:100%;text-align:left" onclick="abrirTrocaSenha()"><strong>Trocar senha</strong><div class="meta">Altera a senha salva neste aparelho</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="sairApp()"><strong>Sair</strong><div class="meta">Bloqueia o app até digitar a senha de novo</div></button>
    <p class="hint" style="margin-top:18px;text-align:center;line-height:1.5"><strong>Anota Conta</strong><br>Versão ${APP_VERSAO}<br>© ${new Date().getFullYear()} webdev. Todos os direitos reservados.</p>`;
}
function pintarchips(boxId, opcoes, campo) {
  const box = document.getElementById(boxId);
  box.innerHTML = opcoes.map(o => {
    const id = o.id || o;
    const nome = o.nome || o;
    const on = (campo==="tipo" ? tipoSel : formaSel) === id ? "on" : "";
    return `<div class="tipo ${on}" data-id="${esc(id)}" onclick="pick('${campo}','${esc(id)}', this)">${esc(nome)}</div>`;
  }).join("") + (campo === "tipo" ? `<div class="tipo add" id="btnCatMais" onclick="abrirCategorias()">+ Categoria</div>` : "");
}
function pick(campo, id, el) {
  if (campo === "tipo") tipoSel = id;
  else formaSel = id;
  el.parentElement.querySelectorAll(".tipo").forEach(t => t.classList.remove("on"));
  el.classList.add("on");
}
/* ---------- Categorias por mês ---------- */
// O cadastro de categorias é um só (estado.categorias). Cada mês mostra só Fixos, Básicos e as usadas nele.
function normNome(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
function idsCatsForm() {
  const ids = new Set(CATS_PADRAO.map(c => c.id));
  lista().forEach(i => { if (i.tipo) ids.add(i.tipo); });
  if (editando != null && lista()[editando] && lista()[editando].tipo) ids.add(lista()[editando].tipo);
  catsExtraForm.forEach(id => ids.add(id));
  if (tipoSel) ids.add(tipoSel);
  return ids;
}
function catsForm() {
  const ids = idsCatsForm();
  const out = cats().filter(c => ids.has(c.id));
  ids.forEach(id => { if (!out.some(c => c.id === id)) out.push({id, nome: catNome(id)}); });
  return out;
}
function pintarCatsForm() { pintarchips("catsBox", catsForm(), "tipo"); }
function avisoCat(msg) {
  const el = document.getElementById("catAviso");
  el.textContent = msg || "";
  el.hidden = !msg;
}
function abrirCategorias() {
  const ids = idsCatsForm();
  const outras = cats().filter(c => !ids.has(c.id));
  const box = document.getElementById("jaUsadasBox");
  box.innerHTML = outras.length
    ? outras.map(c => `<div class="tipo" data-id="${esc(c.id)}" onclick="usarCategoria('${esc(c.id)}')">${esc(c.nome)}</div>`).join("")
    : `<p class="hint" style="margin:0">Nenhuma outra categoria ainda. Crie uma abaixo.</p>`;
  document.getElementById("fCatNome").value = "";
  document.getElementById("catErro").hidden = true;
  dlgCat.showModal();
}
function usarCategoria(id, msg = "") {
  catsExtraForm.add(id);
  tipoSel = id;
  if (dlgCat.open) dlgCat.close();
  pintarCatsForm();
  avisoCat(msg);
}
function slugCat(nome) {
  return normNome(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "categoria";
}
function criarCategoria(e) {
  e.preventDefault();
  const input = document.getElementById("fCatNome");
  const nome = input.value.trim().replace(/\s+/g, " ");
  const erro = document.getElementById("catErro");
  if (!nome) { erro.textContent = "Digite o nome da categoria."; erro.hidden = false; input.focus(); return; }
  const chave = normNome(nome);
  const existente = cats().find(c => normNome(c.nome) === chave);
  if (existente) {
    usarCategoria(existente.id, `“${existente.nome}” já existia e foi usada de novo.`);
    return;
  }
  let id = slugCat(nome), n = 2;
  const base = id;
  while (cats().some(c => c.id === id)) id = base + "-" + (n++);
  cats().push({id, nome});
  persist();
  usarCategoria(id, `Categoria “${nome}” criada.`);
}
function abrirForm(idx=null) {
  editando = idx;
  const it = idx==null ? {} : lista()[idx];
  document.getElementById("formTitulo").textContent = idx==null ? "Nova conta" : "Editar conta";
  fNome.value = it.nome || "";
  fValor.value = it.valor ? String(it.valor).replace(".",",") : "";
  fStatus.value = it.status || "pendente";
  fData.value = it.data || defaultData();
  fObs.value = it.obs || "";
  fRepete.checked = !!it.repete;
  tipoSel = it.tipo || "basico";
  formaSel = it.forma || "Pix";
  catsExtraForm = new Set();
  avisoCat("");
  pintarchips("formasBox", FORMAS, "forma");
  pintarCatsForm();
  btnApagar.hidden = idx==null;
  pintarOrdemForm();
  dlg.showModal();
}
/* ---------- Ordem das contas (v0.7) ----------
   A ordem é a própria ordem do array do mês (estado.meses[k]); não há campo novo, então backups antigos,
   o JSON e o Excel (linhas na ordem do array) continuam compatíveis. Com um filtro de categoria ativo, só as
   contas visíveis trocam de lugar entre si (as escondidas ficam onde estavam). */
function idxVisiveis() {
  return lista().map((it, i) => (filtro === "todas" || it.tipo === filtro) ? i : -1).filter(i => i >= 0);
}
// Move a conta visível da posição "de" para "para" (posições dentro da lista visível). Devolve o novo índice real.
function moverVisivel(de, para) {
  const arr = lista(), idx = idxVisiveis();
  if (de === para || de < 0 || para < 0 || de >= idx.length || para >= idx.length) return idx[de];
  const vis = idx.map(i => arr[i]);
  const [it] = vis.splice(de, 1);
  vis.splice(para, 0, it);
  idx.forEach((i, k) => { arr[i] = vis[k]; });
  persist();
  return idx[para];
}
function pintarOrdemForm() {
  const box = document.getElementById("ordemBox");
  if (!box) return;
  const idx = idxVisiveis(), pos = editando == null ? -1 : idx.indexOf(editando);
  box.hidden = pos < 0 || idx.length < 2;
  if (box.hidden) return;
  document.getElementById("ordemPos").textContent = `${pos + 1}ª de ${idx.length}`;
  document.getElementById("ordemSobe").disabled = pos === 0;
  document.getElementById("ordemDesce").disabled = pos === idx.length - 1;
}
function moverNoForm(dlt) {
  const idx = idxVisiveis(), pos = idx.indexOf(editando);
  if (pos < 0) return;
  editando = moverVisivel(pos, Math.max(0, Math.min(idx.length - 1, pos + dlt)));
  render(); pintarOrdemForm();
}
(function ligarArrastarContas() {
  const main = document.getElementById("main");
  const SEGURAR = 500, TOLERA = 10, BORDA = 70;
  let toque = null;   // {id, x0, y0, card, mouse, timer}
  let arraste = null; // {card, cards, tops, alturas, de, para, y0doc, ultY, raf}
  let ignorarClique = false;
  const limiteTopo = () => { const h = document.querySelector("header.top"); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; };
  const limiteBase = () => { const n = document.querySelector("nav.tab"); return n ? n.getBoundingClientRect().top : innerHeight; };
  function cancelarToque() { if (toque) { clearTimeout(toque.timer); toque = null; } }
  main.addEventListener("pointerdown", e => {
    ignorarClique = false;
    if (tela !== "mes" || arraste || (e.pointerType === "mouse" && e.button !== 0)) return;
    const card = e.target.closest(".list .item[data-idx]");
    if (!card || document.querySelectorAll("#listaContas .item").length < 2) return;
    cancelarToque();
    toque = {id: e.pointerId, x0: e.clientX, y0: e.clientY, card, mouse: e.pointerType === "mouse"};
    toque.timer = setTimeout(() => { if (toque) erguer(toque.card, toque.y0, true); }, SEGURAR);
  });
  function erguer(card, clientY, vibrar) {
    const lista = document.getElementById("listaContas");
    if (!lista || !card.isConnected) { cancelarToque(); return; }
    const pid = toque && toque.id;
    cancelarToque();
    const cards = [...lista.querySelectorAll(".item")];
    const sy = scrollY;
    const rects = cards.map(c => c.getBoundingClientRect());
    arraste = {card, cards, pid, tops: rects.map(r => r.top + sy), alturas: rects.map(r => r.height),
      de: cards.indexOf(card), para: cards.indexOf(card), y0doc: clientY + sy, ultY: clientY, raf: 0};
    arraste.passo = cards.length > 1 ? arraste.tops[1] - arraste.tops[0] - arraste.alturas[0] : 8;
    lista.classList.add("ordenando"); card.classList.add("erguida");
    document.body.classList.add("arrastando");
    card.style.transform = "scale(1.03)";
    ignorarClique = true;
    if (vibrar && navigator.vibrate) { try { navigator.vibrate(25); } catch (_) {} }
    arraste.raf = requestAnimationFrame(quadro);
  }
  function posicionar() {
    const a = arraste, sy = scrollY, ydoc = a.ultY + sy, dy = ydoc - a.y0doc;
    a.card.style.transform = `translateY(${dy}px) scale(1.03)`;
    const centro = a.tops[a.de] + a.alturas[a.de] / 2 + dy;
    let para = a.de;
    for (let k = 0; k < a.cards.length; k++) {
      if (k === a.de) continue;
      const meio = a.tops[k] + a.alturas[k] / 2;
      if (k < a.de && centro <= meio) { para = Math.min(para, k); }
      if (k > a.de && centro >= meio) { para = Math.max(para, k); }
    }
    a.para = para;
    const desloca = a.alturas[a.de] + a.passo;
    a.cards.forEach((c, k) => {
      if (k === a.de) return;
      let t = 0;
      if (a.de < para && k > a.de && k <= para) t = -desloca;
      if (a.de > para && k < a.de && k >= para) t = desloca;
      c.style.transform = t ? `translateY(${t}px)` : "";
    });
  }
  function quadro() {
    if (!arraste) return;
    const y = arraste.ultY, topo = limiteTopo(), base = limiteBase();
    let v = 0;
    if (y < topo + BORDA) v = -Math.ceil((topo + BORDA - y) / BORDA * 14);
    else if (y > base - BORDA) v = Math.ceil((y - (base - BORDA)) / BORDA * 14);
    if (v) window.scrollBy(0, Math.max(-18, Math.min(18, v)));
    posicionar();
    arraste.raf = requestAnimationFrame(quadro);
  }
  function soltar(cancelou) {
    const a = arraste; if (!a) return;
    if (!cancelou) posicionar(); // usa a última posição do dedo/mouse, mesmo sem um quadro novo
    arraste = null;
    cancelAnimationFrame(a.raf);
    document.body.classList.remove("arrastando");
    if (!cancelou && a.para !== a.de) { moverVisivel(a.de, a.para); render(); }
    else {
      a.cards.forEach(c => { c.style.transform = ""; });
      a.card.classList.remove("erguida");
      const l = document.getElementById("listaContas"); if (l) l.classList.remove("ordenando");
    }
    setTimeout(() => { ignorarClique = false; }, 400);
  }
  window.addEventListener("pointermove", e => {
    if (arraste) { if (arraste.pid == null || e.pointerId === arraste.pid) { arraste.ultY = e.clientY; } return; }
    if (!toque || e.pointerId !== toque.id) return;
    const dx = Math.abs(e.clientX - toque.x0), dy = Math.abs(e.clientY - toque.y0);
    if (toque.mouse && dy > 6 && dy >= dx) { const c = toque.card, y0 = toque.y0; erguer(c, y0, false); arraste && (arraste.ultY = e.clientY); return; }
    if (dx > TOLERA || dy > TOLERA) cancelarToque(); // dedo andou antes do tempo: é rolagem, não arraste
  });
  window.addEventListener("pointerup", e => { if (arraste) soltar(false); else cancelarToque(); });
  window.addEventListener("pointercancel", () => { if (arraste) soltar(true); else cancelarToque(); });
  window.addEventListener("scroll", () => { if (toque && !toque.mouse) cancelarToque(); }, {passive: true});
  // Depois de erguer, o dedo não rola a página (a rolagem fica por conta das bordas).
  window.addEventListener("touchmove", e => { if (arraste && e.cancelable) e.preventDefault(); }, {passive: false});
  main.addEventListener("contextmenu", e => { if (e.target.closest(".list .item")) e.preventDefault(); });
  main.addEventListener("click", e => {
    if (ignorarClique && e.target.closest(".list")) { e.stopPropagation(); e.preventDefault(); ignorarClique = false; }
  }, true);
  document.addEventListener("keydown", e => { if (arraste && e.key === "Escape") soltar(true); });
})();
function defaultData() {
  const [y,m] = atual.split("-");
  const d = new Date().getDate();
  return `${y}-${m}-${String(Math.min(d,28)).padStart(2,"0")}`;
}
function salvarItem(e) {
  e.preventDefault();
  const novo = item(fNome.value.trim(), parseMoney(fValor.value), fStatus.value, tipoSel, fData.value, formaSel, fRepete.checked, fObs.value.trim());
  if (editando==null) lista().push(novo);
  else { const velho = lista()[editando]; lista()[editando] = {...velho, ...novo, id: velho.id}; }
  persist(); dlg.close(); render();
}
function apagarItem() {
  if (editando==null) return;
  lista().splice(editando,1); persist(); dlg.close(); render();
}
function toggle(i) {
  const it = lista()[i];
  it.status = it.status==="pago" ? "pendente" : "pago";
  persist(); render();
}
function proxKey() {
  const [y,m] = atual.split("-").map(Number);
  const d = new Date(y, m, 1);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}
function dataNoMes(iso, mes) {
  if (!iso) return "";
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const d = Math.min(Number(iso.split("-")[2]) || 1, ultimo);
  return `${mes}-${String(d).padStart(2,"0")}`;
}
function mesmaConta(a, b) {
  return normNome(a.nome) === normNome(b.nome) && (a.tipo || "") === (b.tipo || "") && Number(a.valor || 0) === Number(b.valor || 0);
}
function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
async function copiarProx() {
  const orig = atual, dest = proxKey();
  const src = lista();
  const cand = src.filter(i => i.repete || i.status !== "pago");
  if (!cand.length) {
    aviso(`${tituloMes(orig)} não tem contas com repete nem pendentes.`, "nok");
    return;
  }
  const ok = await perguntar(`Copiar para ${tituloMes(dest)}?`,
    `Vão as contas com repete (como pendentes) e as que ainda não foram pagas. ` +
    `As pendentes sem repete saem de ${tituloMes(orig)} e passam para ${tituloMes(dest)}, para não contar duas vezes. ` +
    `Contas que já estão em ${tituloMes(dest)} não são copiadas de novo.`, [
      {rotulo: "Cancelar", classe: "ghost", valor: null},
      {rotulo: "Copiar", classe: "main", valor: "copiar"}
    ]);
  if (ok !== "copiar") return;
  if (!estado.meses[dest]) estado.meses[dest] = [];
  const alvo = estado.meses[dest];
  let copiadas = 0, movidas = 0, existiam = 0;
  const sair = new Set();
  cand.forEach(i => {
    const mover = !i.repete; // pendente sem repete: muda de mês
    const jaTem = alvo.some(d => d.id === i.id || d.origemId === i.id || mesmaConta(d, i));
    if (jaTem) {
      existiam++;
      if (mover) sair.add(i); // já está no próximo mês: não conta duas vezes
      return;
    }
    if (mover) {
      alvo.push({...i, status: "pendente", data: dataNoMes(i.data, dest), origemId: i.origemId || i.id});
      sair.add(i); movidas++;
    } else {
      alvo.push({...i, id: crypto.randomUUID(), status: "pendente", data: dataNoMes(i.data, dest), origemId: i.id});
      copiadas++;
    }
  });
  estado.meses[orig] = src.filter(i => !sair.has(i));
  atual = dest; persist(); ir("mes");
  const partes = [];
  if (copiadas) partes.push(plural(copiadas, "conta copiada", "contas copiadas"));
  if (movidas) partes.push(plural(movidas, "conta movida", "contas movidas"));
  if (existiam) partes.push(existiam === 1 ? "1 já existia" : existiam + " já existiam");
  aviso(partes.length ? partes.join(", ") + "." : "Nada novo para copiar.", "ok");
}
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function exportarBackup() {
  persist();
  const dados = {app: "anota-conta", formato: 1, exportadoEm: new Date().toISOString(), ...estado};
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], {type:"application/json"}));
  a.href = url;
  a.download = "anota-conta-backup-" + hojeISO() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso("Backup exportado.");
}
// v0.6: um arquivo com TODOS os anos (aba Resumo com gráficos + uma aba por ano). Gerado no aparelho, sem internet.
function exportarExcel() {
  persist();
  let dados = null;
  try { dados = EXCEL.gerar(estado, catNome); } catch (_) { dados = undefined; }
  if (dados === null) { aviso("Ainda não há contas para colocar no Excel.", "nok"); return; }
  if (!dados) { aviso("Não foi possível gerar o Excel neste navegador. Use o Exportar backup.", "nok"); return; }
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([dados], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.href = url;
  a.download = "anota-conta-" + hojeISO() + ".xlsx";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso("Excel baixado com todos os anos.");
}

/* ---------- Aviso rápido e diálogo de confirmação ---------- */
let avisoTimer = null;
function aviso(msg, tipo = "ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + tipo;
  t.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
// botoes: [{rotulo, classe, valor}] · devolve o valor do botão tocado, ou null se fechar/cancelar
function perguntar(titulo, texto, botoes, coluna = false) {
  const d = document.getElementById("dlgConf");
  document.getElementById("confTitulo").textContent = titulo;
  document.getElementById("confTexto").textContent = texto;
  const box = document.getElementById("confAcoes");
  box.className = "actions" + (coluna ? " col" : "");
  box.innerHTML = "";
  return new Promise(resolve => {
    let valor = null;
    botoes.forEach(b => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "btn " + (b.classe || "ghost");
      el.textContent = b.rotulo;
      el.addEventListener("click", () => { valor = b.valor; d.close(); });
      box.appendChild(el);
    });
    d.addEventListener("close", () => resolve(valor), { once: true });
    d.showModal();
  });
}

/* ---------- Meses: segurar para selecionar e excluir ---------- */
function atualizarSelbar() {
  const bar = document.getElementById("selbar");
  const n = selecao ? selecao.size : 0;
  bar.hidden = !selecao;
  document.body.classList.toggle("selecionando", !!selecao);
  document.getElementById("selN").textContent = n === 1 ? "1 selecionado" : n + " selecionados";
  document.getElementById("selExcluir").disabled = n === 0;
}
function entrarSelecao(k) {
  selecao = new Set([k]);
  if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
  atualizarSelbar(); render();
}
function sairSelecao() {
  selecao = null;
  atualizarSelbar();
  if (tela === "meses") render();
}
function alternarSelecao(k) {
  if (selecao.has(k)) selecao.delete(k); else selecao.add(k);
  atualizarSelbar(); render();
}
function chaveNum(k) { const [y,m] = k.split("-").map(Number); return y * 12 + (m - 1); }
async function excluirSelecionados() {
  if (!selecao || !selecao.size) return;
  const n = selecao.size;
  const titulo = n === 1 ? `Excluir ${tituloMes([...selecao][0])}?` : `Excluir ${n} meses?`;
  const ok = await perguntar(titulo, "Todas as contas desse" + (n === 1 ? " mês" : "s meses") + " serão apagadas. Essa ação não pode ser desfeita.", [
    {rotulo: "Cancelar", classe: "ghost", valor: null},
    {rotulo: "Excluir", classe: "danger", valor: "excluir"}
  ]);
  if (ok !== "excluir") return;
  const apagados = [...selecao];
  apagados.forEach(k => { delete estado.meses[k]; });
  if (apagados.includes(atual)) {
    const resto = Object.keys(estado.meses);
    if (resto.length) {
      const alvo = chaveNum(atual);
      resto.sort((a, b) => Math.abs(chaveNum(a) - alvo) - Math.abs(chaveNum(b) - alvo) || chaveNum(b) - chaveNum(a));
      atual = resto[0];
    } else {
      atual = mesHoje();
    }
  }
  selecao = null;
  persist(); atualizarSelbar(); render();
  aviso(n === 1 ? "1 mês excluído." : n + " meses excluídos.");
}
(function ligarSegurarMeses() {
  const main = document.getElementById("main");
  let timer = null, x0 = 0, y0 = 0, alvo = null, ignorarClique = false;
  const cancelar = () => { clearTimeout(timer); timer = null; alvo = null; };
  main.addEventListener("pointerdown", e => {
    ignorarClique = false;
    const card = e.target.closest("[data-mes]");
    if (!card || tela !== "meses" || (e.pointerType === "mouse" && e.button !== 0)) return;
    alvo = card.dataset.mes; x0 = e.clientX; y0 = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const k = alvo; alvo = null;
      if (!k) return;
      ignorarClique = true;
      if (selecao) { if (!selecao.has(k)) alternarSelecao(k); }
      else entrarSelecao(k);
    }, 500);
  });
  main.addEventListener("pointermove", e => {
    if (timer && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) cancelar();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => main.addEventListener(ev, () => { if (timer) cancelar(); }));
  window.addEventListener("scroll", () => { if (timer) cancelar(); }, { passive: true });
  main.addEventListener("contextmenu", e => { if (e.target.closest("[data-mes]")) e.preventDefault(); });
  main.addEventListener("click", e => {
    const card = e.target.closest("[data-mes]");
    if (!card) return;
    if (ignorarClique) { ignorarClique = false; return; }
    const k = card.dataset.mes;
    if (selecao) alternarSelecao(k);
    else { atual = k; ir("mes"); }
  });
})();

/* ---------- Backup: importar ---------- */
function validarBackup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  if (!obj.meses || typeof obj.meses !== "object" || Array.isArray(obj.meses)) return false;
  for (const [k, arr] of Object.entries(obj.meses)) {
    if (!/^\d{4}-\d{2}$/.test(k) || !Array.isArray(arr)) return false;
    for (const it of arr) {
      if (!it || typeof it !== "object" || typeof it.nome !== "string") return false;
      if (it.valor !== undefined && it.valor !== null && it.valor !== "" && isNaN(Number(it.valor))) return false;
      if (!("valor" in it)) return false;
    }
  }
  if (obj.categorias !== undefined && !Array.isArray(obj.categorias)) return false;
  return true;
}
function limparItem(it) {
  return { ...it, id: it.id || crypto.randomUUID(), valor: Number(it.valor || 0) };
}
function limparCats(lista) {
  return (lista || []).filter(c => c && c.id && c.nome).map(c => ({id: String(c.id), nome: String(c.nome)}));
}
function substituirTudo(obj) {
  const meses = {};
  Object.entries(obj.meses).forEach(([k, arr]) => { meses[k] = arr.map(limparItem); });
  const categorias = limparCats(obj.categorias);
  estado = {
    versao: 2,
    tema: ["branca","preta","luz"].includes(obj.tema) ? obj.tema : estado.tema,
    mesAtual: obj.mesAtual,
    categorias: categorias.length ? categorias : CATS_PADRAO.map(c => ({...c})),
    meses
  };
  const chaves = Object.keys(meses).sort();
  atual = meses[obj.mesAtual] ? obj.mesAtual : (chaves[chaves.length - 1] || mesHoje());
}
function juntarDados(obj) {
  const cs = cats();
  limparCats(obj.categorias).forEach(c => { if (!cs.some(x => x.id === c.id)) cs.push(c); });
  Object.entries(obj.meses).forEach(([k, arr]) => {
    if (!estado.meses[k]) estado.meses[k] = [];
    const ids = new Set(estado.meses[k].map(i => i.id));
    arr.forEach(it => {
      if (it.id && ids.has(it.id)) return;
      const novo = limparItem(it);
      ids.add(novo.id);
      estado.meses[k].push(novo);
    });
  });
}
document.getElementById("fileIn").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  let obj = null;
  try { obj = JSON.parse(await f.text()); } catch (_) { obj = null; }
  if (!validarBackup(obj)) { aviso("Arquivo inválido. Escolha um backup do Anota Conta.", "nok"); return; }
  const qtdMeses = Object.keys(obj.meses).length;
  const qtdContas = Object.values(obj.meses).reduce((a, arr) => a + arr.length, 0);
  const escolha = await perguntar("Importar backup",
    `O arquivo tem ${qtdMeses} ${qtdMeses === 1 ? "mês" : "meses"} e ${qtdContas} ${qtdContas === 1 ? "conta" : "contas"}. Como você quer importar?`, [
      {rotulo: "Substituir tudo", classe: "main", valor: "substituir"},
      {rotulo: "Juntar com os dados atuais", classe: "ghost", valor: "juntar"},
      {rotulo: "Cancelar", classe: "ghost", valor: null}
    ], true);
  if (!escolha) return;
  try {
    if (escolha === "substituir") substituirTudo(obj); else juntarDados(obj);
    persist(); render();
    aviso(escolha === "substituir" ? "Backup importado. Dados substituídos." : "Backup importado. Dados juntados.");
  } catch (err) {
    aviso("Não foi possível importar esse arquivo.", "nok");
  }
});

/* ---------- Planilha (Excel): importar ---------- */
const MESES_NORM = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const COLS_XLSX = {
  nome: ["nome", "conta", "descricao"],
  valor: ["valor", "valor (r$)", "valor r$", "r$"],
  status: ["status", "situacao"],
  categoria: ["categoria", "tipo"],
  data: ["data", "data do pagamento", "data pagamento", "vencimento"],
  forma: ["forma", "forma de pagamento", "como pagou", "pagamento"],
  obs: ["observacao", "observacoes", "obs", "obs."],
  repete: ["repete", "repete todo mes", "recorrente"]
};
function abrirImportarExcel() {
  document.getElementById("fileXlsx").click();
}
function celulaVazia(v) { return v === null || v === undefined || String(v).trim() === ""; }
function mesDaAba(nome) {
  const n = normNome(nome);
  if (n === "ano") return null;
  const m = n.match(/^(jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)(?![a-z])/);
  if (!m) return null;
  const ano = n.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return {mes: MESES_NORM.indexOf(m[1].slice(0, 3)) + 1, ano: ano ? Number(ano[1]) : null};
}
function anoDoArquivo(nome) {
  const s = String(nome || "");
  const m = s.match(/anota-conta-(\d{4})/i) || s.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return m ? Number(m[1]) : null;
}
function mapaColunas(linha) {
  const mapa = {};
  (linha || []).forEach((v, idx) => {
    const n = normNome(v);
    if (!n) return;
    for (const [campo, nomes] of Object.entries(COLS_XLSX)) {
      if (mapa[campo] === undefined && nomes.includes(n)) { mapa[campo] = idx; break; }
    }
  });
  return mapa.nome !== undefined ? mapa : null;
}
function valorPlanilha(v) {
  if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : 0;
  let s = String(v || "").replace(/r\$/i, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const neg = /^-|^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isFinite(n) ? (neg ? -n : n) : 0;
}
function statusPlanilha(v) {
  const n = normNome(v);
  if (["pago", "paga", "ok", "sim", "quitado", "pago (ok)"].includes(n)) return "pago";
  if (["nok", "nao pago", "nao paga", "nao pago (nok)", "atrasado"].includes(n)) return "nok";
  return "pendente";
}
function repetePlanilha(v) {
  if (v === true) return true;
  return ["sim", "s", "x", "yes", "true", "1", "verdadeiro"].includes(normNome(v));
}
function formaPlanilha(v) {
  const n = normNome(v);
  if (!n) return "";
  const exata = FORMAS.find(f => normNome(f) === n);
  if (exata) return exata;
  const parcial = FORMAS.find(f => n.includes(normNome(f)));
  return parcial || "Outro";
}
function isoData(y, m, d) {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}
function dataPlanilha(v) {
  if (celulaVazia(v)) return "";
  if (v instanceof Date && !isNaN(v)) return isoData(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") {
    if (v < 1 || v > 2958465) return "";
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return isoData(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoData(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return isoData(y, +m[2], +m[1]);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return dataPlanilha(Number(s));
  return "";
}
function chaveMes(ano, mes) { return ano + "-" + String(mes).padStart(2, "0"); }
// Linha que é só "JANEIRO 2026" (faixa de mês do Excel por ano).
function bandaMes(row) {
  const cheias = (row || []).filter(v => !celulaVazia(v));
  if (cheias.length !== 1 || typeof cheias[0] !== "string") return null;
  const n = normNome(cheias[0]);
  if (!/^[a-z]+\.?\s*(de\s+)?(\/\s*)?(19|20)\d{2}$/.test(n)) return null;
  const m = mesDaAba(n.replace(/\./, ""));
  return m && m.ano ? m : null;
}
// Lê os blocos de contas de uma aba: cada cabeçalho (Nome/Conta, Valor...) abre um bloco, que vai até uma
// linha em branco ou de total. Faixas "JANEIRO 2026" dizem o mês do bloco seguinte (formato por ano, v0.6).
// No formato antigo (uma aba por mês) há um bloco só. Devolve null se a aba não tem cabeçalho.
function blocosDaAba(rows) {
  const blocos = [];
  let mapa = null, bloco = null, banda = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every(celulaVazia)) { bloco = null; continue; }
    const b = bandaMes(row);
    if (b) { banda = b; bloco = null; continue; }
    const m = mapaColunas(row);
    if (m) { mapa = m; bloco = {banda, linhas: []}; blocos.push(bloco); banda = null; continue; }
    if (!bloco) continue;
    const pega = campo => mapa[campo] === undefined ? "" : row[mapa[campo]];
    const nome = String(pega("nome") ?? "").trim();
    if (/^total\b/.test(normNome(nome))) { bloco = null; continue; }
    if (!nome) continue;
    bloco.linhas.push({
      nome,
      valor: valorPlanilha(pega("valor")),
      status: statusPlanilha(pega("status")),
      categoria: String(pega("categoria") ?? "").trim(),
      data: dataPlanilha(pega("data")),
      forma: formaPlanilha(pega("forma")),
      obs: String(pega("obs") ?? "").trim(),
      repete: repetePlanilha(pega("repete"))
    });
  }
  return blocos.length ? blocos : null;
}
function pedirAno() {
  const d = document.getElementById("dlgAno");
  const form = document.getElementById("anoForm");
  const inp = document.getElementById("fAno");
  const erro = document.getElementById("anoErro");
  inp.value = new Date().getFullYear();
  erro.hidden = true;
  return new Promise(resolve => {
    let valor = null;
    const enviar = e => {
      e.preventDefault();
      const n = Number(inp.value);
      if (!Number.isInteger(n) || n < 1900 || n > 2100) {
        erro.textContent = "Digite um ano válido, por exemplo " + new Date().getFullYear() + ".";
        erro.hidden = false; inp.focus(); return;
      }
      valor = n; d.close();
    };
    const cancelar = () => { valor = null; d.close(); };
    form.addEventListener("submit", enviar);
    document.getElementById("anoCancelar").addEventListener("click", cancelar);
    d.addEventListener("close", () => {
      form.removeEventListener("submit", enviar);
      document.getElementById("anoCancelar").removeEventListener("click", cancelar);
      resolve(valor);
    }, {once: true});
    d.showModal();
    setTimeout(() => { try { inp.select(); } catch (_) {} }, 40);
  });
}
// Devolve {meses: {"AAAA-MM": [linhas]}, semData} ou null se não achou nada no formato.
// wb = {nomes, abas: {nome: linhas[][]}} (js/xlsx.js).
async function lerPlanilha(wb, nomeArquivo) {
  const porBanda = [], porAba = [], soltas = [];
  wb.nomes.forEach(nome => {
    const n = normNome(nome);
    if (n === "ano" || n === "resumo") return;
    const blocos = blocosDaAba(wb.abas[nome] || []);
    if (!blocos) return;
    const m = mesDaAba(nome);
    blocos.forEach(b => {
      if (b.banda) porBanda.push({...b.banda, linhas: b.linhas}); // aba por ano: o mês vem da faixa
      else if (m) porAba.push({...m, linhas: b.linhas});          // aba por mês (formato antigo)
      else soltas.push(...b.linhas);                              // outra aba: cada conta vai para o mês da própria data
    });
  });
  if (!porBanda.some(a => a.linhas.length) && !porAba.some(a => a.linhas.length) && !soltas.length) return null;
  let anoArq = anoDoArquivo(nomeArquivo);
  if (porAba.some(a => a.linhas.length && !a.ano) && !anoArq) {
    anoArq = await pedirAno();
    if (!anoArq) return {cancelado: true};
  }
  const meses = {};
  let semData = 0;
  porBanda.concat(porAba).forEach(a => {
    if (!a.linhas.length) return;
    const k = chaveMes(a.ano || anoArq, a.mes);
    (meses[k] = meses[k] || []).push(...a.linhas);
  });
  soltas.forEach(l => {
    if (!l.data) { semData++; return; }
    const k = l.data.slice(0, 7);
    (meses[k] = meses[k] || []).push(l);
  });
  return {meses, semData};
}
function idCategoriaPorNome(nome) {
  const n = normNome(nome);
  if (!n || n === "sem categoria") return "basico";
  const cs = cats();
  const achou = cs.find(c => normNome(c.nome) === n) || cs.find(c => normNome(c.id) === n);
  if (achou) return achou.id;
  const limpo = String(nome).trim().replace(/\s+/g, " ");
  let id = slugCat(limpo), k = 2;
  const base = id;
  while (cs.some(c => c.id === id)) id = base + "-" + (k++);
  cs.push({id, nome: limpo});
  return id;
}
function aplicarPlanilha(meses, modo) {
  let contas = 0, repetidas = 0;
  const tocados = [];
  Object.keys(meses).sort().forEach(k => {
    const novos = meses[k].map(l => item(l.nome, l.valor, l.status, idCategoriaPorNome(l.categoria), l.data, l.forma, l.repete, l.obs));
    if (modo === "substituir") {
      estado.meses[k] = novos;
      contas += novos.length;
    } else {
      const antes = (estado.meses[k] || []).slice();
      const add = novos.filter(n => {
        if (antes.some(a => mesmaConta(a, n))) { repetidas++; return false; }
        return true;
      });
      if (!add.length) return;
      estado.meses[k] = antes.concat(add);
      contas += add.length;
    }
    tocados.push(k);
  });
  return {contas, repetidas, tocados};
}
document.getElementById("fileXlsx").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  let wb = null, erroLer = "";
  try { wb = await XLSXA.ler(await f.arrayBuffer()); } catch (err) { wb = null; erroLer = err && err.message; }
  if (!wb) {
    aviso(erroLer === "sem-descompressao"
      ? "Este navegador é antigo para abrir essa planilha. Atualize o navegador ou use o Importar backup."
      : "Não consegui abrir esse arquivo. Escolha uma planilha .xlsx.", "nok");
    return;
  }
  let lido = null;
  try { lido = await lerPlanilha(wb, f.name); } catch (_) { lido = null; }
  if (lido && lido.cancelado) return;
  const chaves = lido ? Object.keys(lido.meses).sort() : [];
  if (!chaves.length) {
    aviso("Não encontrei contas na planilha. Use o arquivo do Baixar Excel ou abas JAN a DEZ com as colunas Nome, Valor, Status, Categoria, Data, Forma, Observação e Repete.", "nok");
    return;
  }
  const qtdContas = chaves.reduce((a, k) => a + lido.meses[k].length, 0);
  const nomesMeses = chaves.map(tituloMes).join(", ");
  const escolha = await perguntar("Importar planilha",
    `A planilha tem ${plural(qtdContas, "conta", "contas")} em ${plural(chaves.length, "mês", "meses")} (${nomesMeses}). ` +
    `Substituir apaga as contas atuais desses meses e coloca as da planilha. Juntar mantém as atuais e não repete contas iguais.` +
    (lido.semData ? ` ${plural(lido.semData, "linha sem data foi ignorada", "linhas sem data foram ignoradas")}.` : ""), [
      {rotulo: "Substituir os meses da planilha", classe: "main", valor: "substituir"},
      {rotulo: "Juntar", classe: "ghost", valor: "juntar"},
      {rotulo: "Cancelar", classe: "ghost", valor: null}
    ], true);
  if (!escolha) return;
  try {
    const r = aplicarPlanilha(lido.meses, escolha);
    atual = r.tocados[r.tocados.length - 1] || atual;
    persist(); render();
    let msg = r.contas
      ? `${plural(r.contas, "conta importada", "contas importadas")} em ${plural(r.tocados.length, "mês", "meses")}`
      : "Nada novo para importar";
    if (r.repetidas) msg += ` · ${r.repetidas === 1 ? "1 repetida ignorada" : r.repetidas + " repetidas ignoradas"}`;
    aviso(msg + ".");
  } catch (_) {
    aviso("Não foi possível importar essa planilha.", "nok");
  }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ---------- Capa de login / sessão ---------- */

const OLHO_SVG = {
  mostrar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ocultar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
};

function alternarOlho(btn) {
  const id = btn.getAttribute("data-alvo");
  const inp = document.getElementById(id);
  if (!inp) return;
  const mostrar = inp.type === "password";
  inp.type = mostrar ? "text" : "password";
  btn.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
  btn.innerHTML = mostrar ? OLHO_SVG.ocultar : OLHO_SVG.mostrar;
}

function resetarOlhos(ids) {
  (ids || []).forEach(id => {
    const inp = document.getElementById(id);
    if (inp) inp.type = "password";
    const btn = document.querySelector('.olho[data-alvo="' + id + '"]');
    if (btn) {
      btn.setAttribute("aria-label", "Mostrar senha");
      btn.innerHTML = OLHO_SVG.mostrar;
    }
  });
}

const dlgSenha = document.getElementById("dlgSenha");

function atualizarLoginRodape() {
  const el = document.getElementById("loginRodape");
  if (el) el.textContent = "Anota Conta v" + APP_VERSAO + " · © " + new Date().getFullYear() + " webdev";
}

function prepararLogin() {
  garantirSenhaPadrao();
  document.getElementById("loginSub").textContent = "Digite sua senha para abrir";
  document.getElementById("loginBtn").textContent = "Entrar";
  document.getElementById("loginErro").textContent = "";
  document.getElementById("loginSenha").value = "";
  resetarOlhos(["loginSenha"]);
}

function bloquearApp() {
  document.body.classList.add("travado");
  atualizarLoginRodape();
  prepararLogin();
  setTimeout(() => { try { document.getElementById("loginSenha").focus(); } catch (_) {} }, 50);
}

function desbloquearApp() {
  document.body.classList.remove("travado");
  ir("mes");
  setTimeout(avisoVersaoNova, 60);
}

/* ---------- Aviso de versão nova (depois do login) ---------- */
function versaoVista() {
  try { return localStorage.getItem(VERSAO_KEY) || ""; } catch (_) { return ""; }
}
function marcarVersaoVista() {
  try { localStorage.setItem(VERSAO_KEY, APP_VERSAO); } catch (_) {}
}
let avisoVersaoAberto = false;
async function avisoVersaoNova() {
  if (avisoVersaoAberto || versaoVista() === APP_VERSAO) return;
  if (document.body.classList.contains("travado")) return;
  if (document.getElementById("dlgConf").open) return;
  avisoVersaoAberto = true;
  const escolha = await perguntar(`Anota Conta atualizado para a v${APP_VERSAO}`,
    "Novidade: no Resumo, toque num ano do Total anual para ver as contas daquele ano (por exemplo 2023). Para voltar, toque em Voltar pro ano atual. " +
    "Recomendamos exportar seu backup (JSON ou Excel). Se seus dados não aparecerem, importe o backup em Mais.", [
      {rotulo: "Exportar backup agora", classe: "main", valor: "json"},
      {rotulo: "Baixar Excel", classe: "ghost", valor: "excel"},
      {rotulo: "Depois", classe: "ghost", valor: null}
    ], true);
  marcarVersaoVista();
  avisoVersaoAberto = false;
  if (escolha === "json") exportarBackup();
  else if (escolha === "excel") exportarExcel();
}

async function sairApp() {
  const ok = await perguntar("Sair?", "Você precisará digitar a senha de novo para abrir o Anota Conta.", [
    {rotulo: "Cancelar", classe: "ghost", valor: null},
    {rotulo: "Sair", classe: "danger", valor: "sair"}
  ]);
  if (ok !== "sair") return;
  fecharSessao();
  if (selecao) { selecao = null; atualizarSelbar(); }
  ["dlg","dlgConf","dlgCat","dlgSenha","dlgAno","dlgInstalar"].forEach(id => {
    const d = document.getElementById(id);
    if (d && d.open) d.close();
  });
  bloquearApp();
}

function abrirTrocaSenha() {
  document.getElementById("fSenhaAtual").value = "";
  document.getElementById("fSenhaNova").value = "";
  document.getElementById("fSenhaNova2").value = "";
  const er = document.getElementById("senhaErro");
  er.textContent = ""; er.hidden = true;
  resetarOlhos(["fSenhaAtual", "fSenhaNova", "fSenhaNova2"]);
  dlgSenha.showModal();
  setTimeout(() => document.getElementById("fSenhaAtual").focus(), 40);
}

async function salvarTrocaSenha(e) {
  e.preventDefault();
  const er = document.getElementById("senhaErro");
  const atual = document.getElementById("fSenhaAtual").value;
  const nova = document.getElementById("fSenhaNova").value;
  const conf = document.getElementById("fSenhaNova2").value;
  er.hidden = true;
  if (!senhaForte(nova)) {
    er.textContent = AUTH_REGRAS_MSG;
    er.hidden = false; return;
  }
  if (nova !== conf) {
    er.textContent = "A confirmação não é igual à nova senha.";
    er.hidden = false; return;
  }
  try {
    const ok = await trocarSenhaLocal(atual, nova);
    if (!ok) {
      er.textContent = "Senha atual incorreta.";
      er.hidden = false;
      document.getElementById("fSenhaAtual").select();
      return;
    }
    abrirSessao();
    dlgSenha.close();
    aviso("Senha alterada.");
  } catch (err) {
    er.textContent = err && err.message === "fraca"
      ? AUTH_REGRAS_MSG
      : "Não foi possível trocar a senha neste navegador.";
    er.hidden = false;
  }
}

document.getElementById("loginForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const erro = document.getElementById("loginErro");
  const btn = document.getElementById("loginBtn");
  erro.textContent = "";
  btn.disabled = true;
  garantirSenhaPadrao();
  try {
    const senha = document.getElementById("loginSenha").value;
    if (await verifyLocal(senha)) {
      abrirSessao();
      document.getElementById("loginSenha").value = "";
      desbloquearApp();
    } else {
      erro.textContent = "Senha incorreta. Tente novamente.";
      document.getElementById("loginSenha").select();
    }
  } catch (e) {
    erro.textContent = "Não foi possível verificar a senha neste navegador (abra pelo link https ou http local).";
  }
  btn.disabled = false;
});

/* ---------- Instalar app (PWA) — v0.5 ---------- */
// Só abre quando a pessoa toca em "Instalar app" (login ou Mais). Nunca abre sozinho.
let deferredInstall = null;   // evento beforeinstallprompt guardado (Chrome/Edge no PC e Android)
let instaladoAgora = false;   // virou true no evento appinstalled

function ehIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
}
function iosForaDoSafari() {
  return ehIOS() && /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent || "");
}
function tipoAparelho() {
  if (ehIOS()) return "ios";
  if (/Android/i.test(navigator.userAgent || "")) return "android";
  return "pc";
}
function appJaInstalado() {
  if (instaladoAgora) return true;
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch (_) {}
  return false;
}
function atualizarLinkInstalar() {
  const wrap = document.getElementById("loginInstalarWrap");
  if (wrap) wrap.hidden = appJaInstalado();
  const card = document.getElementById("maisInstalar");
  if (card && appJaInstalado() && tela === "mais") render();
}
function mostrarTelaInstalar(n) {
  const t1 = document.getElementById("instTela1");
  const t2 = document.getElementById("instTela2");
  if (!t1 || !t2) return;
  t1.hidden = n !== 1;
  t2.hidden = n !== 2;
}
function prepararTextosInstalar() {
  const ios = ehIOS();
  const txt = document.getElementById("instTexto");
  const avisoSafari = document.getElementById("instAvisoSafari");
  const btn = document.getElementById("instInstalar");
  if (ios) {
    txt.textContent = "No iPhone/iPad: abra no Safari, toque em Compartilhar (quadrado com seta para cima) e depois em Adicionar à Tela de Início.";
    btn.textContent = "Entendi";
  } else {
    txt.textContent = "Com um toque o Anota Conta vai para a tela inicial ou para a área de trabalho e funciona mesmo sem internet.";
    btn.textContent = "Instalar";
  }
  const fora = iosForaDoSafari();
  avisoSafari.hidden = !fora;
  avisoSafari.textContent = fora
    ? "Você está em outro navegador. No iPhone/iPad só dá para instalar pelo Safari: copie o link e abra no Safari."
    : "";
  // Passo a passo: aparelho detectado primeiro e destacado
  const box = document.getElementById("instSecoes");
  const atual = tipoAparelho();
  const blocos = Array.from(box.querySelectorAll(".inst-bloco"));
  blocos.forEach(b => b.classList.toggle("atual", b.dataset.aparelho === atual));
  const primeiro = blocos.find(b => b.dataset.aparelho === atual);
  if (primeiro && box.firstElementChild !== primeiro) box.insertBefore(primeiro, box.firstElementChild);
}
function abrirInstalar() {
  if (appJaInstalado()) { atualizarLinkInstalar(); aviso("O Anota Conta já está instalado neste aparelho."); return; }
  prepararTextosInstalar();
  mostrarTelaInstalar(1);
  const d = document.getElementById("dlgInstalar");
  if (d && !d.open) d.showModal();
}
function fecharInstalar() {
  const d = document.getElementById("dlgInstalar");
  if (d && d.open) d.close();
}
async function tocarInstalar() {
  if (ehIOS()) { fecharInstalar(); return; }       // iOS não tem instalação de um toque
  if (!deferredInstall) { mostrarTelaInstalar(2); return; } // sem o evento: mostra o passo a passo
  const ev = deferredInstall;
  deferredInstall = null;                           // o evento só pode ser usado uma vez
  fecharInstalar();
  try {
    ev.prompt();
    await ev.userChoice;
  } catch (_) {}
  atualizarLinkInstalar();
}
window.addEventListener("beforeinstallprompt", ev => {
  ev.preventDefault();      // guarda para usar só quando a pessoa tocar em Instalar
  deferredInstall = ev;
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  instaladoAgora = true;
  fecharInstalar();
  atualizarLinkInstalar();
});
(function ligarInstalarUI() {
  const d = document.getElementById("dlgInstalar");
  document.getElementById("btnInstalarAppLogin").addEventListener("click", abrirInstalar);
  document.getElementById("instInstalar").addEventListener("click", tocarInstalar);
  document.getElementById("instAgoraNao").addEventListener("click", fecharInstalar);
  document.getElementById("instPassoAPasso").addEventListener("click", () => mostrarTelaInstalar(2));
  document.getElementById("instVoltar").addEventListener("click", () => mostrarTelaInstalar(1));
  document.getElementById("instEntendi").addEventListener("click", fecharInstalar);
  d.addEventListener("close", () => mostrarTelaInstalar(1));
  try {
    const mq = window.matchMedia && window.matchMedia("(display-mode: standalone)");
    if (mq && mq.addEventListener) mq.addEventListener("change", atualizarLinkInstalar);
  } catch (_) {}
  atualizarLinkInstalar();
})();

aplicarTema(estado);
atualizarLoginRodape();
if (sessaoAberta()) desbloquearApp();
else bloquearApp();
