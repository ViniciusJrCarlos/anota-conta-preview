const dlg = document.getElementById("dlg");
let estado = carregar();
let atual = estado.mesAtual || mesHoje();
let tela = "mes";
let filtro = "todas";
let editando = null;
let tipoSel = "basico";
let formaSel = "Pix";

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
  return c ? c.nome : id;
}
function persist() { persistir(estado, atual); }

function ir(t) {
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
  const vis = items.filter(i => filtro === "todas" || i.tipo === filtro);
  const somaTipo = (id) => items.filter(i => i.tipo === id).reduce((a,b)=>a+Number(b.valor||0),0);
  const top3 = cats().slice(0,3);
  const htmlItems = vis.length ? vis.map(it => {
    const real = items.indexOf(it);
    const [lb, cls] = badge(it.status);
    const bits = [catNome(it.tipo), it.forma, it.data ? fmtData(it.data) : "", it.repete ? "repete" : "", it.obs].filter(Boolean);
    return `<article class="item ${it.status==="pago"?"pago":""}">
      <button class="check" onclick="toggle(${real})"></button>
      <div onclick="abrirForm(${real})">
        <div class="name">${esc(it.nome)}</div>
        <div class="meta">${esc(bits.join(" · "))}</div>
        <span class="badge ${cls}">${lb}</span>
      </div>
      <div class="amt">${it.valor ? money(it.valor) : "—"}</div>
    </article>`;
  }).join("") : `<div class="empty">Nada neste filtro.<br>Toque em + para anotar.</div>`;
  return `<p class="frase">Lembre o que vence. Agradeça por poder pagar.</p>
    <div class="month">
      <button class="nav-btn" onclick="shift(-1)">‹</button>
      <h1>${tituloMes(atual)}</h1>
      <button class="nav-btn" onclick="shift(1)">›</button>
    </div>
    <div class="stats">
      ${top3.map(c => `<div class="stat"><b>${money(somaTipo(c.id))}</b><span>${esc(c.nome)}</span><i></i></div>`).join("")}
    </div>
    <div class="chips">
      <button class="chip ${filtro==="todas"?"on":""}" onclick="filtro='todas';render()">Todas</button>
      ${cats().map(c => `<button class="chip ${filtro===c.id?"on":""}" onclick="filtro='${c.id}';render()">${esc(c.nome)}</button>`).join("")}
    </div>
    <div class="list">${htmlItems}</div>`;
}
function viewMeses() {
  const keys = Object.keys(estado.meses).sort().reverse();
  if (!keys.length) return `<div class="empty">Nenhum mês ainda.</div>`;
  return `<h2>Meses</h2>` + keys.map(k => {
    const arr = estado.meses[k] || [];
    const pagas = arr.filter(i => i.status==="pago").length;
    const tot = arr.reduce((a,b)=>a+Number(b.valor||0),0);
    const pct = arr.length ? Math.round(pagas/arr.length*100) : 0;
    return `<button class="card" style="width:100%;text-align:left;cursor:pointer" onclick="atual='${k}';ir('mes')">
      <div class="row"><strong>${tituloMes(k)}</strong><b>${money(tot)}</b></div>
      <div class="meta">${pagas} de ${arr.length} pagas</div>
      <div class="bar ${pct===100?"done":""}"><i style="width:${pct}%"></i></div>
    </button>`;
  }).join("") + `<p class="hint">Salvo só neste aparelho.</p>`;
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
  const top = [...items].sort((a,b)=>Number(b.valor||0)-Number(a.valor||0)).slice(0,5);
  return `<h2>Resumo · ${tituloMes(atual)}</h2>
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
    <div class="card">
      <h3>Maiores pagamentos</h3>
      ${top.filter(i=>i.valor).map(i => `<div class="row" style="margin:6px 0"><span>${esc(i.nome)} · ${esc(i.forma||"—")}</span><b>${money(i.valor)}</b></div>`).join("") || `<p class="hint">Nada ainda.</p>`}
    </div>`;
}
function barra(nome, v, max) {
  const pct = Math.round((v/max)*100);
  return `<div class="gbar"><span>${esc(nome)}</span><div class="track"><i style="width:${pct}%"></i></div><b>${money(v)}</b></div>`;
}
function viewMais() {
  const t = estado.tema;
  const ano = atual.slice(0,4);
  return `<h2>Aparência</h2>
    ${[["branca","Branca padrão"],["preta","Preta noturna"],["luz","Amarelo-luz"]].map(([k,l]) =>
      `<button class="card" style="width:100%;text-align:left;cursor:pointer;border-color:${t===k?"var(--marca)":"var(--line)"}"
        onclick="estado.tema='${k}';persist();render()"><strong>${l}</strong>${t===k?" · em uso":""}</button>`).join("")}
    <h2 style="margin-top:22px">Seus dados</h2>
    <button class="card" style="width:100%;text-align:left" onclick="exportarExcel()">Baixar Excel do ano ${ano}</button>
    <button class="card" style="width:100%;text-align:left" onclick="exportarCopia()">Baixar cópia de segurança</button>
    <button class="card" style="width:100%;text-align:left" onclick="document.getElementById('fileIn').click()">Restaurar cópia</button>
    <button class="card" style="width:100%;text-align:left" onclick="copiarProx()">Copiar mês para o próximo</button>
    <div class="warn">O Excel abre uma aba por mês do ano. A cópia de segurança é o arquivo para guardar no Drive. Tudo continua neste aparelho.</div>
    <p class="hint" style="margin-top:14px">v0.2 candidata · a homologada continua sendo a v0.1 até você aprovar.</p>`;
}
function pintarchips(boxId, opcoes, campo) {
  const box = document.getElementById(boxId);
  box.innerHTML = opcoes.map(o => {
    const id = o.id || o;
    const nome = o.nome || o;
    const on = (campo==="tipo" ? tipoSel : formaSel) === id ? "on" : "";
    return `<div class="tipo ${on}" data-id="${id}" onclick="pick('${campo}','${id}', this)">${esc(nome)}</div>`;
  }).join("");
}
function pick(campo, id, el) {
  if (campo === "tipo") tipoSel = id;
  else formaSel = id;
  el.parentElement.querySelectorAll(".tipo").forEach(t => t.classList.remove("on"));
  el.classList.add("on");
}
function novaCategoria() {
  const nome = prompt("Nome da categoria (ex.: Feira, Farmácia, Pet)");
  if (!nome || !nome.trim()) return;
  const id = nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");
  if (cats().some(c => c.id === id)) { alert("Essa categoria já existe."); return; }
  cats().push({id, nome: nome.trim()});
  tipoSel = id;
  persist();
  pintarchips("catsBox", cats(), "tipo");
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
  pintarchips("formasBox", FORMAS, "forma");
  pintarchips("catsBox", cats(), "tipo");
  btnApagar.hidden = idx==null;
  dlg.showModal();
}
function defaultData() {
  const [y,m] = atual.split("-");
  const d = new Date().getDate();
  return `${y}-${m}-${String(Math.min(d,28)).padStart(2,"0")}`;
}
function salvarItem(e) {
  e.preventDefault();
  const novo = item(fNome.value.trim(), parseMoney(fValor.value), fStatus.value, tipoSel, fData.value, formaSel, fRepete.checked, fObs.value.trim());
  if (editando==null) lista().push(novo);
  else { novo.id = lista()[editando].id; lista()[editando] = novo; }
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
function copiarProx() {
  const dest = proxKey();
  if (!estado.meses[dest]) estado.meses[dest] = [];
  const clones = lista().filter(i => i.repete || i.status!=="pago")
    .map(i => ({...i, id: crypto.randomUUID(), status: "pendente"}));
  estado.meses[dest].push(...clones);
  atual = dest; persist(); ir("mes");
  alert("Copiado para " + tituloMes(dest));
}
function exportarCopia() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(estado,null,2)], {type:"application/json"}));
  a.download = "anota-conta-copia.json"; a.click();
}
function exportarExcel() {
  if (typeof XLSX === "undefined") {
    alert("Para o Excel precisa de internet na primeira vez. Sem rede, use a cópia de segurança.");
    return;
  }
  const ano = atual.slice(0,4);
  const wb = XLSX.utils.book_new();
  const resumo = [["Mês","Pago","Pendente","Total"]];
  for (let m = 1; m <= 12; m++) {
    const k = ano + "-" + String(m).padStart(2,"0");
    const arr = estado.meses[k] || [];
    const rows = [["Nome","Valor","Status","Categoria","Data","Forma","Observação","Repete"]];
    arr.forEach(i => rows.push([
      i.nome, Number(i.valor||0), i.status, catNome(i.tipo), i.data || "", i.forma || "", i.obs || "", i.repete ? "sim" : "não"
    ]));
    const pago = arr.filter(i=>i.status==="pago").reduce((a,b)=>a+Number(b.valor||0),0);
    const pend = arr.filter(i=>i.status!=="pago").reduce((a,b)=>a+Number(b.valor||0),0);
    rows.push([]);
    rows.push(["Total pago", pago]);
    rows.push(["Total pendente", pend]);
    rows.push(["Total", pago+pend]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), MESES[m-1]);
    resumo.push([MESES[m-1] + " " + ano, pago, pend, pago+pend]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Ano");
  XLSX.writeFile(wb, "anota-conta-" + ano + ".xlsx");
}

document.getElementById("fileIn").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  estado = JSON.parse(await f.text());
  if (!estado.categorias) estado.categorias = CATS_PADRAO.slice();
  atual = estado.mesAtual || Object.keys(estado.meses || {})[0] || mesHoje();
  persist(); render(); e.target.value = "";
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

aplicarTema(estado);
ir("mes");
