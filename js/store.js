const KEY = "anota-conta-v02-preview-2023d";
const KEY_V01 = "anota-conta-v01";
const MESES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const FORMAS = ["Pix","Débito","Crédito","Dinheiro","Outro"];
const CATS_PADRAO = [
  {id:"fixo", nome:"Fixos"},
  {id:"basico", nome:"Básicos"},
  {id:"entretenimento", nome:"Entretenimento"},
  {id:"feira", nome:"Feira"},
  {id:"mercado", nome:"Mercado"},
  {id:"educacao", nome:"Educação"}
];

function mesHoje() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}

function item(nome, valor, status, tipo, data, forma, repete, obs="") {
  return { id: crypto.randomUUID(), nome, valor, status, tipo, data: data || "", forma, obs, repete };
}

function seed() {
  return {
    versao: 2,
    tema: "branca",
    mesAtual: "2023-07",
    categorias: CATS_PADRAO.slice(),
    meses: {
      "2023-07": [
        item("Luz", 100, "pago", "fixo", "", "Débito", true),
        item("Condomínio", 250, "pago", "fixo", "", "Débito", true),
        item("Internet", 109, "pago", "fixo", "", "Débito", true),
        item("Faculdade", 80, "pago", "educacao", "", "Débito", true),
        item("Celular (recarga)", 65, "pago", "fixo", "", "Débito", true)
      ],
      "2023-08": [
        item("Luz", 35, "pago", "fixo", "", "Débito", true),
        item("Condomínio", 250, "pago", "fixo", "", "Débito", true),
        item("Internet", 109, "pago", "fixo", "", "Débito", true),
        item("Faculdade", 80, "pago", "educacao", "", "Débito", true),
        item("Celular (recarga)", 65, "pago", "fixo", "", "Débito", true),
        item("Celular (recarga extra)", 30, "pago", "fixo", "", "Débito", false),
        item("Assinaturas (Disney+ e Netflix)", 150, "pago", "entretenimento", "", "Débito", true)
      ],
      "2023-09": [
        item("Luz", 96, "pago", "fixo", "", "Débito", true),
        item("Condomínio", 250, "pago", "fixo", "", "Débito", true),
        item("Internet", 109, "pago", "fixo", "", "Débito", true),
        item("Faculdade", 80, "pago", "educacao", "", "Débito", true),
        item("Celular (recarga)", 65, "pago", "fixo", "", "Débito", true),
        item("Celular (recarga extra)", 30, "pago", "fixo", "", "Débito", false),
        item("Assinaturas (Disney+ e Netflix)", 150, "pago", "entretenimento", "", "Débito", true),
        item("Cartão Nubank", 100, "pendente", "basico", "", "Débito", true, "Valor fictício"),
        item("Cartão C6", 100, "pendente", "basico", "", "Débito", true, "Valor fictício"),
        item("Feira do mês", 200, "pendente", "feira", "", "Débito", true)
      ]
    }
  };
}

function carregar() {
  const raw2 = localStorage.getItem(KEY);
  if (raw2) {
    const e = JSON.parse(raw2);
    if (!e.categorias) e.categorias = CATS_PADRAO.slice();
    return e;
  }
  const raw1 = localStorage.getItem(KEY_V01);
  if (raw1) {
    const e = JSON.parse(raw1);
    e.versao = 2;
    e.categorias = CATS_PADRAO.slice();
    return e;
  }
  return seed();
}

function persistir(estado, atual) {
  estado.mesAtual = atual;
  localStorage.setItem(KEY, JSON.stringify(estado));
}

function money(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoney(s) {
  if (!s) return 0;
  return Number(String(s).replace(/\./g,"").replace(",",".")) || 0;
}

function tituloMes(k) {
  const [y,m] = k.split("-");
  return MESES[Number(m)-1] + " " + y;
}

function fmtData(iso) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  return d + "/" + m;
}

function esc(s) {
  return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}
