/* Anota Conta — Baixar Excel (v0.6): aba Resumo com comparativo e gráficos + uma aba por ano.
   Tema claro do app (sem fundos pretos). Usa js/xlsx.js (offline). */
const EXCEL = (() => {
  const INK = "111111", MARCA = "F5C518", LINE = "E8E8E8", MUTED = "5C5C5C";
  const OK = "1B7A4A", OK_BG = "E7F6EE", WAIT = "8A6D00", WAIT_BG = "FFF4C2", NOK = "B42318", NOK_BG = "FDECEA";
  const ZEBRA = "FAFAFA", SOFT = "FFF9E0", BAND = "FCE9A0", HEAD = "F3F3F3", TOTAL = "FFF1B8", WARN = "FFF6E8";
  const SLATE = "4A5D7A", CINZA = "BDBDBD";
  const PIZZA = [MARCA, SLATE, OK, "D9822B", "7FA7D9", NOK, "8E6FBF", "2E8B87", "9E9E9E", "C9A227", "5B8C5A", "E07A9B"];
  const BRL = '"R$" #,##0.00', BRL0 = '"R$" #,##0', DATA = "dd/mm/yyyy", PCT = '+0.0%;-0.0%;0.0%';
  const MES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const MES_LONGO = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const STATUS = {pago: "Pago", pendente: "Pendente", nok: "Não pago (NOK)"};
  const FONTE = "Segoe UI";
  const fino = ["thin", LINE], amarelo = ["medium", MARCA], grosso = ["thick", MARCA];
  const BOX = {l: fino, r: fino, t: fino, b: fino};
  const CAB = {l: fino, r: fino, t: fino, b: amarelo};
  const TOT = {l: fino, r: fino, t: amarelo, b: fino};

  const soma = (arr, f = () => true) => Math.round(arr.filter(f).reduce((a, i) => a + Number(i.valor || 0), 0) * 100) / 100;
  const pago = i => i.status === "pago";
  const brl = v => Number(v || 0).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
  const varPct = (a, b) => (a == null || b == null || !a) ? null : Math.round((b / a - 1) * 10000) / 10000;
  const corVar = v => v == null || v === 0 ? MUTED : v > 0 ? NOK : OK;
  // Cor de cada ano nos gráficos: o mais recente em amarelo, o anterior em azul-acinzentado, os outros em cinza.
  function coresAnos(n) { return Array.from({length: n}, (_, i) => i === n - 1 ? MARCA : i === n - 2 ? SLATE : CINZA); }
  function passoBonito(max) {
    const bruto = max / 5, pot = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const m = bruto / pot;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pot;
  }

  function dados(estado) {
    const porAno = {};
    Object.keys(estado.meses || {}).forEach(k => {
      if (!/^\d{4}-\d{2}$/.test(k)) return;
      const arr = (estado.meses[k] || []).filter(Boolean);
      if (!arr.length) return;
      const [y, m] = k.split("-").map(Number);
      if (m < 1 || m > 12) return;
      (porAno[y] = porAno[y] || Array.from({length: 12}, () => []))[m - 1] = arr;
    });
    const anos = Object.keys(porAno).map(Number).sort((a, b) => a - b);
    return {porAno, anos};
  }

  function titulo(aba, txt, sub, ult, subCor) {
    aba.mesclar(1, 2, 1, ult);
    aba.set(1, 2, txt, {b: true, sz: 15, cor: INK, indent: 1, borda: {b: grosso}});
    aba.estilo(1, 3, ult, {borda: {b: grosso}});
    aba.altura(1, 30);
    aba.mesclar(2, 2, 2, ult);
    const st = {i: !subCor, b: !!subCor, cor: subCor || MUTED, fundo: subCor ? NOK_BG : SOFT, indent: 1};
    aba.set(2, 2, sub, st);
    aba.estilo(2, 3, ult, {fundo: st.fundo});
    aba.altura(2, 20);
    aba.congelar = 2; aba.titulos = [1, 2];
    aba.rodape = "&C&8Anota Conta · &A · página &P de &N";
  }
  function faixa(aba, r, txt, ult, vazia = false) {
    aba.mesclar(r, 2, r, ult);
    const st = {b: true, sz: 11, cor: vazia ? MUTED : INK, fundo: vazia ? "F5F5F5" : BAND, indent: 1};
    aba.set(r, 2, txt, st);
    aba.estilo(r, 3, ult, {fundo: st.fundo});
    aba.altura(r, 22);
  }
  function cabecalho(aba, r, textos, c0 = 2, alinhar = {}) {
    textos.forEach((t, i) => aba.set(r, c0 + i, t, {b: true, cor: INK, fundo: HEAD, borda: CAB, h: alinhar[i] || "center", wrap: true, indent: alinhar[i] === "left" ? 1 : 0}));
    aba.altura(r, 30);
  }

  /* ---------- aba de um ano ---------- */
  const COLS = [["Conta", 26], ["Categoria", 16], ["Valor (R$)", 13], ["Data", 12], ["Status", 15],
                ["Forma de pagamento", 21], ["Repete", 8], ["Observação", 44]];
  function abaAno(livro, ano, meses, catNome) {
    const aba = livro.aba(String(ano));
    aba.cor = MARCA;
    aba.largura(1, 2);
    COLS.forEach(([, w], i) => aba.largura(2 + i, w));
    const ult = 1 + COLS.length;
    const todos = meses.flat();
    const tot = soma(todos), pg = soma(todos, pago);
    titulo(aba, `ANOTA CONTA · ${ano}`,
      `Total do ano ${brl(tot)} · Pago ${brl(pg)} · Pendente / NOK ${brl(tot - pg)} · ${todos.length} ${todos.length === 1 ? "conta" : "contas"}`, ult);
    // Quebra de página antes de um mês que não cabe no resto da página (A4 em pé, ajustado à largura).
    const larguraPt = (2 + COLS.reduce((a, c) => a + c[1], 0)) * 5.6;
    const capacidade = 760 / Math.min(1, 540 / larguraPt) - 60;
    const altLinha = it => 16 * Math.max(1, Math.ceil(String(it.obs || "").length / 48));
    let usado = 70;
    let r = 4;
    for (let m = 0; m < 12; m++) {
      const arr = meses[m];
      const altBloco = arr.length ? 22 + 30 + arr.reduce((a, it) => a + altLinha(it), 0) + 3 * 16 + 15 : 22 + 30;
      if (usado + altBloco > capacidade && usado > 100) { aba.quebras.push(r); usado = 0; }
      usado += altBloco;
      faixa(aba, r, `${MES_LONGO[m]} ${ano}`, ult, !arr.length);
      r++;
      if (!arr.length) {
        aba.mesclar(r, 2, r, ult);
        aba.set(r, 2, "Sem lançamentos", {i: true, cor: MUTED, indent: 1});
        r += 2;
        continue;
      }
      cabecalho(aba, r, COLS.map(c => c[0]), 2, {0: "left", 1: "left", 5: "left", 7: "left"});
      r++;
      arr.forEach((it, n) => {
        const z = n % 2 ? ZEBRA : null;
        const base = extra => Object.assign({borda: BOX}, z ? {fundo: z} : {}, extra);
        const valor = Number(it.valor || 0);
        const obs = it.obs || "";
        aba.set(r, 2, it.nome || "", base({indent: 1}));
        aba.set(r, 3, catNome(it.tipo), base({indent: 1}));
        aba.set(r, 4, valor, base({num: BRL, h: "right", cor: valor ? INK : MUTED}));
        const serial = XLSXA.serialData(it.data);
        aba.set(r, 5, serial, base({num: DATA, h: "center"}));
        const st = STATUS[it.status] ? it.status : "pendente";
        aba.set(r, 6, STATUS[st], {borda: BOX, h: "center", b: true,
          fundo: {pago: OK_BG, pendente: WAIT_BG, nok: NOK_BG}[st], cor: {pago: OK, pendente: WAIT, nok: NOK}[st]});
        aba.set(r, 7, it.forma || "", base({indent: 1}));
        aba.set(r, 8, it.repete ? "sim" : "não", base({h: "center"}));
        aba.set(r, 9, obs, base({indent: 1, wrap: true, cor: /falta o valor/i.test(obs) ? NOK : INK}));
        r++;
      });
      const t = soma(arr), p = soma(arr, pago);
      [["Total pago", p, OK_BG, OK, false], ["Total pendente / NOK", Math.round((t - p) * 100) / 100, WARN, WAIT, false],
       ["Total do mês", t, TOTAL, INK, true]].forEach(([rot, v, fundo, cor, forte]) => {
        aba.mesclar(r, 2, r, 3);
        const borda = forte ? TOT : BOX;
        aba.set(r, 2, rot, {b: true, cor, fundo, borda, h: "right", indent: 1});
        aba.set(r, 3, null, {fundo, borda});
        aba.set(r, 4, v, {b: true, cor, fundo, borda, num: BRL, h: "right", sz: forte ? 11 : 10});
        r++;
      });
      r++;
    }
    aba.ajustarAltura = 0;
  }

  /* ---------- Resumo ---------- */
  function abaResumo(livro, porAno, anos, catNome, ordemCats) {
    const aba = livro.aba("Resumo");
    aba.cor = MARCA;
    const nY = anos.length;
    const todosPorAno = {};
    anos.forEach(y => { todosPorAno[y] = porAno[y].flat(); });
    // categorias usadas (ordem do cadastro, depois as outras)
    const usadas = new Set();
    anos.forEach(y => todosPorAno[y].forEach(i => usadas.add(i.tipo || "")));
    const cats = ordemCats.filter(id => usadas.has(id)).concat([...usadas].filter(id => !ordemCats.includes(id)));
    const t1 = 1 + nY + Math.max(0, nY - 1), t2 = 1 + cats.length + 5;
    const W = Math.max(t1, t2, 7), ult = 1 + W;
    aba.largura(1, 2); aba.largura(2, 16);
    for (let c = 3; c <= ult; c++) aba.largura(c, 15);
    const contas = anos.reduce((a, y) => a + todosPorAno[y].length, 0);
    const hoje = new Date();
    titulo(aba, "ANOTA CONTA · RESUMO POR ANO",
      `Exportado em ${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()} · ` +
      `${contas} ${contas === 1 ? "conta" : "contas"} · ${nY === 1 ? "ano" : "anos"} ${anos.join(", ")}`, ult);

    // Tabela 1: mês x ano
    aba.mesclar(4, 2, 4, ult);
    aba.set(4, 2, "Total por mês (R$)", {b: true, sz: 11, fundo: BAND, indent: 1}); aba.estilo(4, 3, ult, {fundo: BAND}); aba.altura(4, 20);
    const H = 5;
    const cabs = ["Mês"].concat(anos.map(String));
    for (let i = 1; i < nY; i++) cabs.push(`${anos[i]} vs ${anos[i - 1]}`);
    cabecalho(aba, H, cabs);
    const totMes = {};
    anos.forEach(y => { totMes[y] = porAno[y].map(arr => arr.length ? soma(arr) : null); });
    for (let m = 0; m < 12; m++) {
      const r = H + 1 + m, z = m % 2 ? {fundo: ZEBRA} : {};
      aba.set(r, 2, MES[m], {b: true, h: "center", borda: BOX, ...z});
      anos.forEach((y, j) => aba.set(r, 3 + j, totMes[y][m], {num: BRL, h: "right", borda: BOX, ...z}));
      for (let i = 1; i < nY; i++) {
        const v = varPct(totMes[anos[i - 1]][m], totMes[anos[i]][m]);
        aba.set(r, 2 + nY + i, v == null ? "—" : v, {num: PCT, h: v == null ? "center" : "right", b: v != null, cor: corVar(v), borda: BOX, ...z});
      }
    }
    const rTot = H + 13, rMes = H + 14;
    const anual = {}, nMeses = {};
    anos.forEach(y => { anual[y] = soma(todosPorAno[y]); nMeses[y] = porAno[y].filter(a => a.length).length; });
    aba.set(rTot, 2, "Total anual", {b: true, sz: 11, fundo: TOTAL, borda: TOT, h: "center"});
    aba.set(rMes, 2, "Meses com contas", {b: true, fundo: SOFT, borda: BOX, h: "center", wrap: true});
    aba.altura(rMes, 28); aba.altura(rMes + 1, 15); aba.altura(rMes + 2, 15);
    anos.forEach((y, j) => {
      aba.set(rTot, 3 + j, anual[y], {b: true, sz: 11, fundo: TOTAL, borda: TOT, num: BRL, h: "right"});
      aba.set(rMes, 3 + j, nMeses[y], {fundo: SOFT, borda: BOX, h: "center"});
    });
    for (let i = 1; i < nY; i++) {
      const v = varPct(anual[anos[i - 1]], anual[anos[i]]);
      aba.set(rTot, 2 + nY + i, v == null ? "—" : v, {b: true, sz: 11, fundo: TOTAL, borda: TOT, num: PCT, h: "right", cor: corVar(v)});
      aba.set(rMes, 2 + nY + i, null, {fundo: SOFT, borda: BOX});
    }
    aba.mesclar(rMes + 1, 2, rMes + 2, ult);
    aba.set(rMes + 1, 2, (nY > 1 ? "Variação %: vermelho = gastou mais que no ano anterior; verde = gastou menos. " : "") +
      "Meses sem contas ficam em branco. O total de cada mês soma todas as contas, de todas as categorias.",
      {i: true, sz: 9, cor: MUTED, wrap: true, v: "top", indent: 1});

    // Tabela 2: por ano
    let r = rMes + 4;
    aba.mesclar(r, 2, r, ult);
    aba.set(r, 2, "Por ano: categorias e pagamentos", {b: true, sz: 11, fundo: BAND, indent: 1}); aba.estilo(r, 3, ult, {fundo: BAND}); aba.altura(r, 20);
    const rCab2 = r + 1;
    cabecalho(aba, rCab2, ["Ano"].concat(cats.map(id => catNome(id)), ["Pago", "Pendente / NOK", "Total", "Contas", "Média mensal"]));
    anos.forEach((y, j) => {
      const rr = rCab2 + 1 + j, z = j % 2 ? {fundo: ZEBRA} : {};
      const todos = todosPorAno[y];
      aba.set(rr, 2, String(y), {b: true, h: "center", borda: BOX, ...z});
      cats.forEach((id, k) => aba.set(rr, 3 + k, soma(todos, i => (i.tipo || "") === id), {num: BRL, h: "right", borda: BOX, ...z}));
      const c0 = 3 + cats.length, pg = soma(todos, pago);
      aba.set(rr, c0, pg, {num: BRL, h: "right", borda: BOX, b: true, cor: OK, ...z});
      aba.set(rr, c0 + 1, Math.round((anual[y] - pg) * 100) / 100, {num: BRL, h: "right", borda: BOX, b: true, cor: WAIT, ...z});
      aba.set(rr, c0 + 2, anual[y], {num: BRL, h: "right", borda: BOX, b: true, ...z});
      aba.set(rr, c0 + 3, todos.length, {h: "center", borda: BOX, ...z});
      aba.set(rr, c0 + 4, nMeses[y] ? Math.round(anual[y] / nMeses[y] * 100) / 100 : 0, {num: BRL, h: "right", borda: BOX, ...z});
    });
    const rFim2 = rCab2 + nY;
    aba.set(rFim2 + 1, 2, "Média mensal = total do ano ÷ meses com contas.", {i: true, sz: 9, cor: MUTED});
    const colTotal = 3 + cats.length + 2;

    // Tabela 3: categorias do ano mais recente (base da pizza)
    const yUlt = anos[nY - 1];
    const porCat = cats.map(id => ({id, v: soma(todosPorAno[yUlt], i => (i.tipo || "") === id)})).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    r = rFim2 + 3;
    aba.mesclar(r, 2, r, ult);
    aba.set(r, 2, `Categorias em ${yUlt}`, {b: true, sz: 11, fundo: BAND, indent: 1}); aba.estilo(r, 3, ult, {fundo: BAND}); aba.altura(r, 20);
    const rCab3 = r + 1;
    cabecalho(aba, rCab3, ["Categoria", "Total", "% do ano"]);
    const totCat = porCat.reduce((a, x) => a + x.v, 0);
    porCat.forEach((x, j) => {
      const z = j % 2 ? {fundo: ZEBRA} : {};
      aba.set(rCab3 + 1 + j, 2, catNome(x.id), {b: true, borda: BOX, indent: 1, ...z});
      aba.set(rCab3 + 1 + j, 3, x.v, {num: BRL, h: "right", borda: BOX, ...z});
      aba.set(rCab3 + 1 + j, 4, totCat ? Math.round(x.v / totCat * 10000) / 10000 : 0, {num: "0.0%", h: "right", borda: BOX, ...z});
    });
    if (!porCat.length) aba.set(rCab3 + 1, 2, "Sem valores neste ano.", {i: true, cor: MUTED});
    const rFim3 = rCab3 + Math.max(1, porCat.length);

    // Gráficos
    r = rFim3 + 2;
    aba.quebras.push(r); // gráficos começam numa página nova
    aba.mesclar(r, 2, r, ult);
    aba.set(r, 2, "Gráficos", {b: true, sz: 11, fundo: BAND, indent: 1}); aba.estilo(r, 3, ult, {fundo: BAND}); aba.altura(r, 20);
    let larg = 0;
    for (let c = 2; c <= ult; c++) larg += (c === 2 ? 16 : 15) * 0.19;
    larg = Math.max(16, Math.min(26, larg));
    const NOME = "Resumo", abs = XLSXA.abs;
    const ultimos = anos.slice(-3), cores3 = coresAnos(ultimos.length);
    const catsMes = {f: abs(NOME, H + 1, 2, H + 12, 2), vals: MES};
    const seriesMes = ultimos.map((y, k) => {
      const c = 3 + anos.indexOf(y);
      return {nome: {f: abs(NOME, H, c), v: String(y)}, f: abs(NOME, H + 1, c, H + 12, c), vals: totMes[y], cor: cores3[k]};
    });
    let linha = r + 2;
    const rows = cm => Math.ceil(cm / 0.53) + 1;
    const add = (g, alt) => { aba.grafico({...g, col: 2, linha, largura: larg, altura: alt}); linha += rows(alt); };
    add({tipo: "col", titulo: ultimos.length > 1 ? `Total por mês: ${ultimos.join(" x ")}` : `Total por mês em ${ultimos[0]}`,
         cats: catsMes, series: seriesMes, legenda: "b", fmtEixo: BRL0}, 9.5);
    add({tipo: "line", titulo: "Evolução mês a mês", cats: catsMes, series: seriesMes, legenda: "b", fmtEixo: BRL0}, 8.5);
    const maxAnual = Math.max(...anos.map(y => anual[y]), 1), passo = passoBonito(maxAnual * 1.3);
    add({tipo: "bar", titulo: "Total anual",
         cats: {f: abs(NOME, rCab2 + 1, 2, rFim2, 2), vals: anos.map(String)},
         series: [{nome: {f: abs(NOME, rCab2, colTotal), v: "Total"}, f: abs(NOME, rCab2 + 1, colTotal, rFim2, colTotal),
                   vals: anos.map(y => anual[y]), cor: MARCA, cores: coresAnos(nY)}],
         legenda: null, fmtEixo: BRL0, fmtRotulo: BRL0, rotulos: true, max: Math.ceil(maxAnual * 1.3 / passo) * passo, passo}, Math.max(4.5, 2.2 + nY * 1.1));
    if (porCat.length) {
      add({tipo: "pie", titulo: `Por categoria em ${yUlt}`,
           cats: {f: abs(NOME, rCab3 + 1, 2, rFim3, 2), vals: porCat.map(x => catNome(x.id))},
           series: [{nome: {f: abs(NOME, rCab3, 3), v: "Total"}, f: abs(NOME, rCab3 + 1, 3, rFim3, 3), vals: porCat.map(x => x.v),
                     cores: porCat.map((_, k) => PIZZA[k % PIZZA.length])}],
           legenda: "r"}, 8.5);
    }
    aba.ajustarAltura = 0;
  }

  // Monta o arquivo. Devolve null se não houver contas.
  function gerar(estado, catNome) {
    const {porAno, anos} = dados(estado);
    if (!anos.length) return null;
    const livro = new XLSXA.Livro(FONTE);
    const ordemCats = (estado.categorias || []).map(c => c.id);
    abaResumo(livro, porAno, anos, catNome, ordemCats);
    anos.forEach(y => abaAno(livro, y, porAno[y], catNome));
    return livro.gerar();
  }
  return {gerar, dados};
})();
