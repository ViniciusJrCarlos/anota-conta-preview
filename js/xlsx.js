/* Anota Conta — leitor e gerador de .xlsx próprios (sem biblioteca externa, funciona offline).
   Gera planilhas com estilos e gráficos nativos (coluna, barra, linha e pizza) e lê .xlsx comuns
   (Excel, Google Planilhas, LibreOffice e o formato antigo do app). */
const XLSXA = (() => {
  /* ---------- ZIP ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const enc = new TextEncoder();
  // ZIP sem compressão (método 0): simples e aceito por Excel, LibreOffice, Google e Numbers.
  function zip(arquivos) {
    const partes = [], central = [];
    let off = 0;
    const d = new Date();
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    arquivos.forEach(([nome, txt]) => {
      const dados = typeof txt === "string" ? enc.encode(txt) : txt;
      const nb = enc.encode(nome), crc = crc32(dados);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, hora, true); lh.setUint16(12, dia, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, dados.length, true); lh.setUint32(22, dados.length, true);
      lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
      partes.push(new Uint8Array(lh.buffer), nb, dados);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, hora, true); ch.setUint16(14, dia, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, dados.length, true); ch.setUint32(24, dados.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + dados.length;
    });
    const tamCentral = central.reduce((a, p) => a + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, off, true);
    const tudo = partes.concat(central, [new Uint8Array(fim.buffer)]);
    const out = new Uint8Array(tudo.reduce((a, p) => a + p.length, 0));
    let p = 0;
    tudo.forEach(x => { out.set(x, p); p += x.length; });
    return out;
  }
  async function inflar(dados) {
    if (typeof DecompressionStream === "undefined") throw new Error("sem-descompressao");
    const ds = new DecompressionStream("deflate-raw");
    const buf = await new Response(new Blob([dados]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function unzip(buffer) {
    const u8 = new Uint8Array(buffer), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("zip");
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const arquivos = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
      const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
      const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
      const lo = dv.getUint32(p + 42, true);
      const nome = dec.decode(u8.subarray(p + 46, p + 46 + ln));
      arquivos[nome.replace(/^\/+/, "")] = {metodo, comp, lo};
      p += 46 + ln + le + lc;
    }
    async function ler(nome) {
      const a = arquivos[nome];
      if (!a) return null;
      const ini = a.lo + 30 + dv.getUint16(a.lo + 26, true) + dv.getUint16(a.lo + 28, true);
      const bruto = u8.subarray(ini, ini + a.comp);
      const dados = a.metodo === 0 ? bruto : a.metodo === 8 ? await inflar(bruto) : null;
      if (!dados) throw new Error("metodo");
      return dec.decode(dados);
    }
    return {nomes: Object.keys(arquivos), ler};
  }

  /* ---------- Leitura ---------- */
  function xml(txt) { return new DOMParser().parseFromString(txt, "application/xml"); }
  function tags(el, nome) { return Array.from(el.getElementsByTagNameNS("*", nome)); }
  function filhos(el, nome) { return Array.from(el.children).filter(x => x.localName === nome); }
  function textoRico(el) { // junta os <t> de um <si>/<is>, sem os textos fonéticos (<rPh>)
    let s = "";
    tags(el, "t").forEach(t => { if (!t.closest || !t.parentElement || t.parentElement.localName !== "rPh") s += t.textContent; });
    return s;
  }
  function colNum(ref) {
    const m = /^([A-Z]+)/.exec(ref || "");
    if (!m) return 0;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }
  function caminho(base, alvo) {
    if (alvo.startsWith("/")) return alvo.slice(1);
    const partes = base.split("/"); partes.pop();
    alvo.split("/").forEach(x => { if (x === "..") partes.pop(); else if (x !== ".") partes.push(x); });
    return partes.join("/");
  }
  // Devolve {nomes: [abas na ordem], abas: {nome: linhas[][]}} com valores crus (número, texto ou booleano).
  async function ler(buffer) {
    const z = await unzip(buffer);
    const wbTxt = await z.ler("xl/workbook.xml");
    if (!wbTxt) throw new Error("xlsx");
    const wb = xml(wbTxt);
    const relsTxt = await z.ler("xl/_rels/workbook.xml.rels");
    const rels = {};
    if (relsTxt) tags(xml(relsTxt), "Relationship").forEach(r => { rels[r.getAttribute("Id")] = caminho("xl/workbook.xml", r.getAttribute("Target")); });
    const sstTxt = await z.ler("xl/sharedStrings.xml");
    const sst = sstTxt ? tags(xml(sstTxt), "si").map(textoRico) : [];
    const out = {nomes: [], abas: {}};
    const folhas = tags(wb, "sheet");
    for (let i = 0; i < folhas.length; i++) {
      const sh = folhas[i];
      const nome = sh.getAttribute("name");
      const rid = sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sh.getAttribute("r:id");
      const alvo = rels[rid] || `xl/worksheets/sheet${i + 1}.xml`;
      const txt = await z.ler(alvo);
      if (!txt) continue;
      const doc = xml(txt);
      const linhas = [];
      let rAuto = 0;
      tags(doc, "row").forEach(row => {
        const r = Number(row.getAttribute("r")) || rAuto + 1;
        rAuto = r;
        const linha = linhas[r - 1] = linhas[r - 1] || [];
        let cAuto = 0;
        filhos(row, "c").forEach(c => {
          const col = colNum(c.getAttribute("r")) || cAuto + 1;
          cAuto = col;
          const t = c.getAttribute("t") || "n";
          const vEl = filhos(c, "v")[0];
          const v = vEl ? vEl.textContent : "";
          let val = "";
          if (t === "s") val = sst[Number(v)] ?? "";
          else if (t === "inlineStr") { const is = filhos(c, "is")[0]; val = is ? textoRico(is) : ""; }
          else if (t === "str" || t === "d") val = v;
          else if (t === "b") val = v === "1";
          else if (t === "e") val = "";
          else val = v === "" ? "" : Number(v);
          linha[col - 1] = val;
        });
      });
      for (let r = 0; r < linhas.length; r++) {
        const l = linhas[r] = linhas[r] || [];
        for (let c = 0; c < l.length; c++) if (l[c] === undefined) l[c] = "";
      }
      out.nomes.push(nome);
      out.abas[nome] = linhas;
    }
    return out;
  }

  /* ---------- Escrita ---------- */
  const X = s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function col(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function ref(r, c) { return col(c) + r; }
  function abs(aba, r1, c1, r2, c2) {
    const q = "'" + String(aba).replace(/'/g, "''") + "'!";
    const a = "$" + col(c1) + "$" + r1;
    return q + (r2 == null ? a : a + ":$" + col(c2) + "$" + r2);
  }
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

  class Estilos {
    constructor(fonte) {
      this.fonte = fonte || "Calibri";
      this.fonts = [`<font><sz val="10"/><color rgb="FF111111"/><name val="${X(this.fonte)}"/><family val="2"/></font>`];
      this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
      this.borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
      this.numFmts = [];
      this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
      this.cache = new Map();
    }
    idx(lista, x) { let i = lista.indexOf(x); if (i < 0) { lista.push(x); i = lista.length - 1; } return i; }
    // spec: {b, i, sz, cor, fundo, borda: {l,r,t,b: [estilo, cor]} ou "box", num, h, v, wrap, indent}
    id(spec) {
      if (!spec) return 0;
      const chave = JSON.stringify(spec);
      if (this.cache.has(chave)) return this.cache.get(chave);
      const f = `<font>${spec.b ? "<b/>" : ""}${spec.i ? "<i/>" : ""}<sz val="${spec.sz || 10}"/><color rgb="FF${spec.cor || "111111"}"/><name val="${X(this.fonte)}"/><family val="2"/></font>`;
      const fontId = this.idx(this.fonts, f);
      const fillId = spec.fundo ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${spec.fundo}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      let borderId = 0;
      if (spec.borda) {
        const b = spec.borda === "box" ? {l: ["thin", "E8E8E8"], r: ["thin", "E8E8E8"], t: ["thin", "E8E8E8"], b: ["thin", "E8E8E8"]} : spec.borda;
        const lado = (tag, v) => v ? `<${tag} style="${v[0]}"><color rgb="FF${v[1]}"/></${tag}>` : `<${tag}/>`;
        borderId = this.idx(this.borders, `<border>${lado("left", b.l)}${lado("right", b.r)}${lado("top", b.t)}${lado("bottom", b.b)}<diagonal/></border>`);
      }
      let numFmtId = 0;
      if (spec.num) {
        let i = this.numFmts.indexOf(spec.num);
        if (i < 0) { this.numFmts.push(spec.num); i = this.numFmts.length - 1; }
        numFmtId = 164 + i;
      }
      const al = (spec.h || spec.v || spec.wrap || spec.indent)
        ? `<alignment${spec.h ? ` horizontal="${spec.h}"` : ""} vertical="${spec.v || "center"}"${spec.wrap ? ' wrapText="1"' : ""}${spec.indent ? ` indent="${spec.indent}"` : ""}/>`
        : '<alignment vertical="center"/>';
      const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
      const id = this.idx(this.xfs, xf);
      this.cache.set(chave, id);
      return id;
    }
    xml() {
      return HEAD + `<styleSheet xmlns="${NS_MAIN}">` +
        (this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${X(f)}"/>`).join("")}</numFmts>` : "") +
        `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
        `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
        `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>";
    }
  }

  class Aba {
    constructor(livro, nome) {
      this.livro = livro; this.nome = nome;
      this.linhas = new Map(); this.alturas = {}; this.larguras = {}; this.merges = [];
      this.graficos = []; this.cor = null; this.congelar = 0; this.retrato = true;
      this.titulos = null; this.rodape = ""; this.ajustarAltura = 0;
      this.quebras = []; // quebra de página antes destas linhas
    }
    set(r, c, v, spec) {
      if (!this.linhas.has(r)) this.linhas.set(r, new Map());
      this.linhas.get(r).set(c, {v, s: this.livro.estilos.id(spec)});
      return this;
    }
    estilo(r, c1, c2, spec) { // pinta células vazias (faixas mescladas)
      for (let c = c1; c <= c2; c++) {
        const l = this.linhas.get(r);
        if (l && l.has(c)) { l.get(c).s = this.livro.estilos.id(spec); continue; }
        this.set(r, c, null, spec);
      }
    }
    mesclar(r1, c1, r2, c2) { this.merges.push(ref(r1, c1) + ":" + ref(r2, c2)); }
    largura(c, w) { this.larguras[c] = w; }
    altura(r, h) { this.alturas[r] = h; }
    grafico(g) { this.graficos.push(g); }
    xml(sst) {
      let maxR = 1, maxC = 1;
      Object.keys(this.alturas).forEach(r => { if (!this.linhas.has(Number(r))) this.linhas.set(Number(r), new Map()); });
      const rows = [...this.linhas.keys()].sort((a, b) => a - b);
      let dados = "";
      rows.forEach(r => {
        maxR = Math.max(maxR, r);
        const cs = [...this.linhas.get(r).entries()].sort((a, b) => a[0] - b[0]);
        const ht = this.alturas[r] ? ` ht="${this.alturas[r]}" customHeight="1"` : "";
        dados += `<row r="${r}"${ht}>`;
        cs.forEach(([c, cel]) => {
          maxC = Math.max(maxC, c);
          const a = ref(r, c), s = cel.s ? ` s="${cel.s}"` : "";
          const v = cel.v;
          if (v === null || v === undefined || v === "") dados += `<c r="${a}"${s}/>`;
          else if (typeof v === "number") dados += isFinite(v) ? `<c r="${a}"${s}><v>${v}</v></c>` : `<c r="${a}"${s}/>`;
          else if (typeof v === "boolean") dados += `<c r="${a}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
          else dados += `<c r="${a}"${s} t="s"><v>${sst(String(v))}</v></c>`;
        });
        dados += "</row>";
      });
      const cols = Object.keys(this.larguras).map(Number).sort((a, b) => a - b)
        .map(c => `<col min="${c}" max="${c}" width="${this.larguras[c]}" customWidth="1"/>`).join("");
      const pane = this.congelar
        ? `<pane ySplit="${this.congelar}" topLeftCell="A${this.congelar + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${this.congelar + 1}" sqref="A${this.congelar + 1}"/>`
        : "";
      const sel = this.livro.abas[0] === this ? ' tabSelected="1"' : "";
      return HEAD + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
        `<sheetPr>${this.cor ? `<tabColor rgb="FF${this.cor}"/>` : ""}<pageSetUpPr fitToPage="1"/></sheetPr>` +
        `<dimension ref="A1:${ref(maxR, maxC)}"/>` +
        `<sheetViews><sheetView workbookViewId="0" showGridLines="0"${sel}>${pane}</sheetView></sheetViews>` +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        (cols ? `<cols>${cols}</cols>` : "") +
        `<sheetData>${dados}</sheetData>` +
        (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
        '<printOptions horizontalCentered="1"/>' +
        '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
        `<pageSetup paperSize="9" orientation="${this.retrato ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="${this.ajustarAltura}"/>` +
        (this.rodape ? `<headerFooter><oddFooter>${X(this.rodape)}</oddFooter></headerFooter>` : "") +
        (this.quebras.length ? `<rowBreaks count="${this.quebras.length}" manualBreakCount="${this.quebras.length}">${this.quebras.map(r => `<brk id="${r - 1}" max="16383" man="1"/>`).join("")}</rowBreaks>` : "") +
        (this.graficos.length ? '<drawing r:id="rId1"/>' : "") +
        "</worksheet>";
    }
  }

  /* ---------- Gráficos (DrawingML) ---------- */
  const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
  const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const fill = c => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
  const rich = (txt, sz, b) => `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="${sz}" b="${b ? 1 : 0}"/><a:t>${X(txt)}</a:t></a:r></a:p></c:rich></c:tx>`;
  function strRef(f, vals) {
    return `<c:strRef><c:f>${X(f)}</c:f><c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef>`;
  }
  function numRef(f, vals, fmt) {
    return `<c:numRef><c:f>${X(f)}</c:f><c:numCache><c:formatCode>${X(fmt || "General")}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => v == null || !isFinite(v) ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numCache></c:numRef>`;
  }
  function dLbls({val = false, pct = false, cat = false, fmt = null, pos = null, sz = 800} = {}) {
    return `<c:dLbls>${fmt ? `<c:numFmt formatCode="${X(fmt)}" sourceLinked="0"/>` : ""}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="1"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>` +
      (pos ? `<c:dLblPos val="${pos}"/>` : "") +
      `<c:showLegendKey val="0"/><c:showVal val="${val ? 1 : 0}"/><c:showCatName val="${cat ? 1 : 0}"/><c:showSerName val="0"/><c:showPercent val="${pct ? 1 : 0}"/><c:showBubbleSize val="0"/>${cat && pct ? "<c:separator>\n</c:separator>" : ""}</c:dLbls>`;
  }
  function eixos(g, id1, id2) {
    const barraH = g.tipo === "bar";
    const txt = '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>';
    return `<c:catAx><c:axId val="${id1}"/><c:scaling><c:orientation val="${barraH ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/>` +
      `<c:axPos val="${barraH ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
      `<c:spPr><a:ln w="9525">${fill("BFBFBF")}</a:ln></c:spPr>${txt}<c:crossAx val="${id2}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="${id2}"/><c:scaling><c:orientation val="minMax"/>${g.max ? `<c:max val="${g.max}"/>` : ""}<c:min val="0"/></c:scaling><c:delete val="0"/>` +
      `<c:axPos val="${barraH ? "t" : "l"}"/>${barraH ? "" : `<c:majorGridlines><c:spPr><a:ln w="6350">${fill("E8E8E8")}</a:ln></c:spPr></c:majorGridlines>`}` +
      `<c:numFmt formatCode="${X(g.fmtEixo || "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
      `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txt}<c:crossAx val="${id1}"/><c:crosses val="${barraH ? "autoZero" : "autoZero"}"/><c:crossBetween val="between"/>${g.passo ? `<c:majorUnit val="${g.passo}"/>` : ""}</c:valAx>`;
  }
  // g: {tipo: "col"|"bar"|"line"|"pie", titulo, cats: {f, vals}, series: [{nome: {f, v}, f, vals, cor, cores?}], legenda, fmtEixo, rotulos}
  function graficoXml(g) {
    let corpo = "";
    const ser = (s, i) => {
      const tx = `<c:tx>${strRef(s.nome.f, [s.nome.v])}</c:tx>`;
      const cat = `<c:cat>${strRef(g.cats.f, g.cats.vals)}</c:cat>`;
      const val = `<c:val>${numRef(s.f, s.vals, g.fmtNum)}</c:val>`;
      const pts = (s.cores || []).map((c, k) => g.tipo === "pie"
        ? `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}<a:ln w="12700">${fill("FFFFFF")}</a:ln></c:spPr></c:dPt>`
        : `<c:dPt><c:idx val="${k}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(c)}</c:spPr></c:dPt>`).join("");
      if (g.tipo === "line") {
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr><a:ln w="28575" cap="rnd">${fill(s.cor)}<a:round/></a:ln></c:spPr>` +
          `<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(s.cor)}<a:ln w="9525">${fill(s.cor)}</a:ln></c:spPr></c:marker>${cat}${val}<c:smooth val="0"/></c:ser>`;
      }
      if (g.tipo === "pie") {
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${pts}${dLbls({pct: true, pos: "outEnd", sz: 900})}${cat}${val}</c:ser>`;
      }
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr>${fill(s.cor)}</c:spPr><c:invertIfNegative val="0"/>${pts}` +
        `${g.rotulos ? dLbls({val: true, fmt: g.fmtRotulo, pos: "outEnd"}) : ""}${cat}${val}</c:ser>`;
    };
    if (g.tipo === "pie") {
      corpo = `<c:pieChart><c:varyColors val="1"/>${g.series.map(ser).join("")}<c:firstSliceAng val="0"/></c:pieChart>`;
    } else if (g.tipo === "line") {
      corpo = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${g.series.map(ser).join("")}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>` + eixos(g, 5001, 5002);
    } else {
      corpo = `<c:barChart><c:barDir val="${g.tipo === "bar" ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${g.series.map(ser).join("")}` +
        `<c:gapWidth val="${g.tipo === "bar" ? 45 : 55}"/>${g.tipo === "col" ? '<c:overlap val="-8"/>' : ""}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>` + eixos(g, 5001, 5002);
    }
    const legenda = g.legenda ? `<c:legend><c:legendPos val="${g.legenda}"/><c:overlay val="0"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr></c:legend>` : "";
    return HEAD + `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>` +
      `<c:title>${rich(g.titulo, 1200, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` +
      `<c:plotArea><c:layout/>${corpo}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legenda}` +
      `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
      `<c:spPr>${fill("FFFFFF")}<a:ln w="9525">${fill("E8E8E8")}</a:ln></c:spPr>` +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${fill("333333")}<a:latin typeface="${X(g.fonte || "Calibri")}"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>` +
      "</c:chartSpace>";
  }
  function desenhoXml(graficos, base) {
    const EMU = 360000; // por cm
    return HEAD + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">` +
      graficos.map((g, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${g.col - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.linha - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${Math.round(g.largura * EMU)}" cy="${Math.round(g.altura * EMU)}"/>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}">` +
        `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`).join("") +
      "</xdr:wsDr>";
  }

  class Livro {
    constructor(fonte) { this.estilos = new Estilos(fonte); this.abas = []; this.fonte = fonte || "Calibri"; }
    aba(nome) { const a = new Aba(this, nome); this.abas.push(a); return a; }
    gerar() {
      const sstLista = [], sstMapa = new Map();
      let sstUsos = 0;
      const sst = s => { sstUsos++; if (!sstMapa.has(s)) { sstMapa.set(s, sstLista.length); sstLista.push(s); } return sstMapa.get(s); };
      const arquivos = [];
      const tipos = [
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      ];
      let nChart = 0, nDesenho = 0;
      const folhas = [], relsWb = [], nomes = [];
      this.abas.forEach((a, i) => {
        const n = i + 1;
        arquivos.push([`xl/worksheets/sheet${n}.xml`, a.xml(sst)]);
        tipos.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
        folhas.push(`<sheet name="${X(a.nome)}" sheetId="${n}" r:id="rId${n}"/>`);
        relsWb.push(`<Relationship Id="rId${n}" Type="${NS_R}/worksheet" Target="worksheets/sheet${n}.xml"/>`);
        if (a.titulos) nomes.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${X("'" + a.nome.replace(/'/g, "''") + "'!$" + a.titulos[0] + ":$" + a.titulos[1])}</definedName>`);
        if (a.graficos.length) {
          const d = ++nDesenho;
          arquivos.push([`xl/worksheets/_rels/sheet${n}.xml.rels`, HEAD + `<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`]);
          arquivos.push([`xl/drawings/drawing${d}.xml`, desenhoXml(a.graficos)]);
          tipos.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
          const rels = [];
          a.graficos.forEach((g, k) => {
            const c = ++nChart;
            arquivos.push([`xl/charts/chart${c}.xml`, graficoXml({...g, fonte: this.fonte})]);
            tipos.push(`<Override PartName="/xl/charts/chart${c}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
            rels.push(`<Relationship Id="rId${k + 1}" Type="${NS_R}/chart" Target="../charts/chart${c}.xml"/>`);
          });
          arquivos.push([`xl/drawings/_rels/drawing${d}.xml.rels`, HEAD + `<Relationships xmlns="${NS_PKG}">${rels.join("")}</Relationships>`]);
        }
      });
      const k = this.abas.length;
      relsWb.push(`<Relationship Id="rId${k + 1}" Type="${NS_R}/styles" Target="styles.xml"/>`);
      relsWb.push(`<Relationship Id="rId${k + 2}" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/>`);
      const agora = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      arquivos.unshift(
        ["[Content_Types].xml", HEAD + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${tipos.join("")}</Types>`],
        ["_rels/.rels", HEAD + `<Relationships xmlns="${NS_PKG}">` +
          `<Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
          `<Relationship Id="rId3" Type="${NS_R}/extended-properties" Target="docProps/app.xml"/></Relationships>`],
        ["docProps/core.xml", HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          `<dc:title>Anota Conta</dc:title><dc:creator>Anota Conta</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified></cp:coreProperties>`],
        ["docProps/app.xml", HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Anota Conta</Application></Properties>'],
        ["xl/workbook.xml", HEAD + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${folhas.join("")}</sheets>` +
          (nomes.length ? `<definedNames>${nomes.join("")}</definedNames>` : "") + '<calcPr calcId="191029"/></workbook>'],
        ["xl/_rels/workbook.xml.rels", HEAD + `<Relationships xmlns="${NS_PKG}">${relsWb.join("")}</Relationships>`],
        ["xl/styles.xml", this.estilos.xml()]
      );
      arquivos.push(["xl/sharedStrings.xml", HEAD + `<sst xmlns="${NS_MAIN}" count="${sstUsos}" uniqueCount="${sstLista.length}">` +
        sstLista.map(s => `<si><t xml:space="preserve">${X(s)}</t></si>`).join("") + "</sst>"]);
      return zip(arquivos);
    }
  }
  function serialData(iso) { // "AAAA-MM-DD" -> número de série do Excel
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return null;
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  return {Livro, ler, abs, col, serialData, zip, unzip};
})();
