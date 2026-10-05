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
    return `<article class="item ${it.status==="pago"?"pago":""}">
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
    <button class="card" style="width:100%;text-align:left" onclick="exportarBackup()"><strong>Exportar backup</strong><div class="meta">Baixa um arquivo .json com todos os meses, contas e categorias</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="document.getElementById('fileIn').click()"><strong>Importar backup</strong><div class="meta">Carrega um arquivo .json exportado pelo Anota Conta</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="copiarProx()">Copiar mês para o próximo</button>
    <div class="warn">O Excel abre uma aba por mês do ano. O backup é o arquivo para guardar no Drive, no e-mail ou no WhatsApp e passar os dados para outro aparelho. Tudo continua neste aparelho.</div>
    <h2 style="margin-top:22px">Acesso</h2>
    <button class="card" style="width:100%;text-align:left" onclick="abrirTrocaSenha()"><strong>Trocar senha</strong><div class="meta">Altera a senha salva neste aparelho</div></button>
    <button class="card" style="width:100%;text-align:left" onclick="sairApp()"><strong>Sair</strong><div class="meta">Bloqueia o app até digitar a senha de novo</div></button>
    <p class="hint" style="margin-top:18px;text-align:center;line-height:1.5"><strong>Anota Conta</strong><br>Versão 0.3<br>© ${new Date().getFullYear()} webdev. Todos os direitos reservados.</p>`;
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
function exportarExcel() {
  if (typeof XLSX === "undefined") {
    aviso("Para o Excel precisa de internet na primeira vez. Sem rede, use o Exportar backup.", "nok");
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
  if (el) el.textContent = "Anota Conta v0.3 · © " + new Date().getFullYear() + " webdev";
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
}

async function sairApp() {
  const ok = await perguntar("Sair?", "Você precisará digitar a senha de novo para abrir o Anota Conta.", [
    {rotulo: "Cancelar", classe: "ghost", valor: null},
    {rotulo: "Sair", classe: "danger", valor: "sair"}
  ]);
  if (ok !== "sair") return;
  fecharSessao();
  if (selecao) { selecao = null; atualizarSelbar(); }
  ["dlg","dlgConf","dlgCat","dlgSenha"].forEach(id => {
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

aplicarTema(estado);
atualizarLoginRodape();
if (sessaoAberta()) desbloquearApp();
else bloquearApp();
