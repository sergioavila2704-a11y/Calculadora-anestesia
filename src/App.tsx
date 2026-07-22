// @ts-nocheck
import React, { useState, useMemo } from "react";

// ---------- Fórmulas y datos clínicos ----------

function pesoIdealDevine(alturaCm, sexo) {
  if (!alturaCm || alturaCm <= 0) return null;
  const pulgadas = alturaCm / 2.54;
  const base = sexo === "M" ? 50 : 45.5;
  const peso = base + 2.3 * (pulgadas - 60);
  return Math.round(peso * 10) / 10;
}

function pesoCorregido(pesoRealKg, pesoIdealKg, factor = 0.4) {
  const real = parseFloat(pesoRealKg);
  if (isNaN(real) || real <= 0 || pesoIdealKg == null) return null;
  return Math.round((pesoIdealKg + factor * (real - pesoIdealKg)) * 10) / 10;
}

function tuboETT(edadAnios) {
  if (edadAnios === "" || edadAnios === null) return null;
  const edad = parseFloat(edadAnios);
  if (isNaN(edad) || edad < 0) return null;
  if (edad < 1) {
    return { diametro: "3.0 – 3.5", profundidad: "9 – 10", nota: "Neonato/lactante: usar tabla por peso al nacer si <1 mes." };
  }
  if (edad <= 12) {
    const diamNC = (edad / 4 + 4).toFixed(1);
    const diamC = (edad / 4 + 3.5).toFixed(1);
    const prof = (edad / 2 + 12).toFixed(1);
    return { diametro: `${diamC} (con globo) / ${diamNC} (sin globo)`, profundidad: prof, nota: "Fórmula pediátrica (Cole / Motoyama)." };
  }
  return { diametro: "7.0 – 7.5 (♀) / 7.5 – 8.0 (♂)", profundidad: "21 (♀) / 23 (♂)", nota: "Adulto: valores estándar, ajustar por talla." };
}

function aminasMcgKgMinToMlHr(dosis, peso, mgEnBolsa, volMl) {
  const d = parseFloat(dosis), p = parseFloat(peso), mg = parseFloat(mgEnBolsa), v = parseFloat(volMl);
  if ([d, p, mg, v].some((x) => isNaN(x) || x <= 0)) return null;
  const concMcgMl = (mg * 1000) / v;
  return Math.round(((d * p * 60) / concMcgMl) * 100) / 100;
}

function aminasMlHrToMcgKgMin(mlHr, peso, mgEnBolsa, volMl) {
  const r = parseFloat(mlHr), p = parseFloat(peso), mg = parseFloat(mgEnBolsa), v = parseFloat(volMl);
  if ([r, p, mg, v].some((x) => isNaN(x) || x <= 0)) return null;
  const concMcgMl = (mg * 1000) / v;
  return Math.round(((r * concMcgMl) / (p * 60)) * 1000) / 1000;
}

const INDUCCION_DRUGS = [
  { nombre: "Propofol", low: 1.5, high: 2.5, unidad: "mg" },
  { nombre: "Etomidato", low: 0.2, high: 0.3, unidad: "mg" },
  { nombre: "Ketamina", low: 1, high: 2, unidad: "mg" },
  { nombre: "Midazolam", low: 0.1, high: 0.3, unidad: "mg" },
  { nombre: "Fentanilo", low: 1, high: 3, unidad: "mcg" },
  { nombre: "Lidocaína (adyuvante)", low: 1, high: 1.5, unidad: "mg" },
  { nombre: "Rocuronio", low: 0.6, high: 1.2, unidad: "mg" },
  { nombre: "Vecuronio", low: 0.08, high: 0.1, unidad: "mg" },
  { nombre: "Succinilcolina", low: 1, high: 1.5, unidad: "mg" },
];

const SEDACION_DRUGS = [
  { nombre: "Midazolam (sedación)", low: 0.02, high: 0.05, unidad: "mg" },
  { nombre: "Ketamina (sedación)", low: 0.2, high: 0.5, unidad: "mg" },
  { nombre: "Propofol (bolo sedación)", low: 0.5, high: 1, unidad: "mg" },
  { nombre: "Rocuronio (mantenimiento)", low: 0.1, high: 0.2, unidad: "mg" },
  { nombre: "Vecuronio (mantenimiento)", low: 0.01, high: 0.015, unidad: "mg" },
];

function dosisPorPeso(pesoKg, lista) {
  const p = parseFloat(pesoKg);
  if (isNaN(p) || p <= 0) return null;
  return lista.map((f) => ({ ...f, lowVal: Math.round(f.low * p * 100) / 100, highVal: Math.round(f.high * p * 100) / 100 }));
}

function hollidaySegar(pesoKg) {
  const p = parseFloat(pesoKg);
  if (isNaN(p) || p <= 0) return null;
  let ml = 0;
  if (p <= 10) ml = p * 4;
  else if (p <= 20) ml = 40 + (p - 10) * 2;
  else ml = 60 + (p - 20) * 1;
  return { ratoHr: Math.round(ml * 10) / 10, total24h: Math.round(ml * 24 * 10) / 10 };
}

function balanceIO(ivAdmin, hemoderivados, otrosIn, diuresis, sangrado, insensibles, otrosOut) {
  const vals = [ivAdmin, hemoderivados, otrosIn, diuresis, sangrado, insensibles, otrosOut].map((v) => parseFloat(v) || 0);
  const [iv, hemo, oin, diu, sang, ins, oout] = vals;
  const ingresos = iv + hemo + oin;
  const egresos = diu + sang + ins + oout;
  return { ingresos, egresos, balance: Math.round((ingresos - egresos) * 10) / 10 };
}

const TERCER_ESPACIO = { menor: 2, moderado: 4, severo: 6 };

function reposicionPerioperatoria(pesoKg, horasAyuno, severidad) {
  const p = parseFloat(pesoKg), h = parseFloat(horasAyuno);
  if (isNaN(p) || p <= 0 || isNaN(h) || h < 0) return null;
  const mant = hollidaySegar(p);
  if (!mant) return null;
  const mantHr = mant.ratoHr;
  const deficit = Math.round(mantHr * h * 10) / 10;
  const factor = TERCER_ESPACIO[severidad] ?? 2;
  const tercerEsp = Math.round(factor * p * 10) / 10;
  const hora1 = Math.round((deficit / 2 + mantHr + tercerEsp) * 10) / 10;
  const hora2 = Math.round((deficit / 4 + mantHr + tercerEsp) * 10) / 10;
  const hora3 = Math.round((deficit / 4 + mantHr + tercerEsp) * 10) / 10;
  return { mantHr, deficit, tercerEsp, hora1, hora2, hora3 };
}

const AL_MAX = [
  { nombre: "Lidocaína", sinEpi: 4.5, conEpi: 7, maxAbsSinEpi: 300, maxAbsConEpi: 500 },
  { nombre: "Bupivacaína", sinEpi: 2.5, conEpi: 3, maxAbsSinEpi: 175, maxAbsConEpi: 225 },
  { nombre: "Ropivacaína", sinEpi: 3, conEpi: 3, maxAbsSinEpi: 200, maxAbsConEpi: 250 },
];

function dosisMaxAL(pesoKg, conEpi) {
  const p = parseFloat(pesoKg);
  if (isNaN(p) || p <= 0) return null;
  return AL_MAX.map((f) => {
    const factor = conEpi ? f.conEpi : f.sinEpi;
    const maxAbs = conEpi ? f.maxAbsConEpi : f.maxAbsSinEpi;
    const mg = Math.min(factor * p, maxAbs);
    return { nombre: f.nombre, mg: Math.round(mg * 10) / 10, tope: maxAbs };
  });
}

function interpretarGasometria(phStr, pco2Str, hco3Str, pao2Str) {
  const pH = parseFloat(phStr), pco2 = parseFloat(pco2Str), hco3 = parseFloat(hco3Str);
  if ([pH, pco2, hco3].some((x) => isNaN(x))) return null;

  let estado = pH < 7.35 ? "Acidemia" : pH > 7.45 ? "Alcalemia" : "pH normal";
  let primario = "";
  let compensacion = "";
  let esperado = null;

  if (pH < 7.35) {
    if (hco3 < 22) {
      primario = "Acidosis metabólica";
      esperado = Math.round((1.5 * hco3 + 8) * 10) / 10;
      const diff = pco2 - esperado;
      if (Math.abs(diff) <= 2) compensacion = `Compensación respiratoria adecuada (Winter: PCO2 esperado ${esperado} ± 2)`;
      else if (diff > 2) compensacion = `PCO2 más alto de lo esperado (${esperado}) → acidosis respiratoria agregada`;
      else compensacion = `PCO2 más bajo de lo esperado (${esperado}) → alcalosis respiratoria agregada`;
    } else if (pco2 > 45) {
      primario = "Acidosis respiratoria";
      compensacion = "Aguda: HCO3 sube ~1 por cada 10 mmHg de PCO2. Crónica: HCO3 sube ~3.5–4 por cada 10 mmHg.";
    } else {
      primario = "Acidemia con componentes mixtos — valorar en contexto clínico";
    }
  } else if (pH > 7.45) {
    if (hco3 > 26) {
      primario = "Alcalosis metabólica";
      esperado = Math.round((0.7 * (hco3 - 24) + 40) * 10) / 10;
      const diff = pco2 - esperado;
      if (Math.abs(diff) <= 5) compensacion = `Compensación respiratoria adecuada (PCO2 esperado ≈ ${esperado})`;
      else compensacion = `PCO2 fuera de lo esperado (${esperado}) → trastorno respiratorio agregado`;
    } else if (pco2 < 35) {
      primario = "Alcalosis respiratoria";
      compensacion = "Aguda: HCO3 baja ~2 por cada 10 mmHg de PCO2. Crónica: HCO3 baja ~5 por cada 10 mmHg.";
    } else {
      primario = "Alcalemia con componentes mixtos — valorar en contexto clínico";
    }
  } else {
    primario = "pH normal — puede ser normalidad o un trastorno mixto compensado";
  }

  let oxigenacion = null;
  const pao2 = parseFloat(pao2Str);
  if (!isNaN(pao2)) {
    if (pao2 >= 80) oxigenacion = "Oxigenación normal";
    else if (pao2 >= 60) oxigenacion = "Hipoxemia leve";
    else oxigenacion = "Hipoxemia moderada-severa";
  }

  return { estado, primario, compensacion, oxigenacion };
}

const APFEL_ITEMS = [
  { id: "mujer", label: "Sexo femenino" },
  { id: "nofumador", label: "No fumador(a)" },
  { id: "antecedente", label: "Antecedente de NVPO o cinetosis" },
  { id: "opioides", label: "Uso de opioides postoperatorios" },
];
const APFEL_RIESGO = { 0: "~10%", 1: "~20%", 2: "~40%", 3: "~60%", 4: "~80%" };

const MALLAMPATI = [
  { clase: "I", desc: "Paladar blando, úvula y pilares amigdalinos visibles por completo." },
  { clase: "II", desc: "Paladar blando y úvula visibles, pilares parcialmente ocultos." },
  { clase: "III", desc: "Solo paladar blando y base de la úvula visibles." },
  { clase: "IV", desc: "Solo paladar duro visible." },
];

const ASA_CLASES = [
  { clase: "I", desc: "Paciente sano." },
  { clase: "II", desc: "Enfermedad sistémica leve, sin limitación funcional." },
  { clase: "III", desc: "Enfermedad sistémica grave, con limitación funcional." },
  { clase: "IV", desc: "Enfermedad sistémica grave con amenaza constante a la vida." },
  { clase: "V", desc: "Paciente moribundo, no se espera sobreviva sin la cirugía." },
  { clase: "VI", desc: "Muerte cerebral, donador de órganos." },
];

const REF_ROWS = [
  { grupo: "Presión arterial sistémica", filas: [["Sistólica", "90 – 140 mmHg"], ["Diastólica", "60 – 90 mmHg"], ["Media (PAM)", "70 – 105 mmHg"]] },
  { grupo: "Presión arterial pulmonar", filas: [["Sistólica", "15 – 30 mmHg"], ["Diastólica", "4 – 12 mmHg"], ["Media (mPAP)", "9 – 18 mmHg (>20 = HTP)"], ["Presión capilar pulmonar (PCP/wedge)", "4 – 12 mmHg"]] },
  { grupo: "Otros parámetros hemodinámicos", filas: [["Presión venosa central (PVC)", "2 – 8 mmHg"], ["Gasto cardíaco (GC)", "4 – 8 L/min"], ["Índice cardíaco (IC)", "2.5 – 4 L/min/m²"], ["Resistencia vascular sistémica (RVS)", "800 – 1200 dyn·s/cm⁵"], ["Resistencia vascular pulmonar (RVP)", "< 250 dyn·s/cm⁵"]] },
  { grupo: "Variables dinámicas de respuesta a volumen", filas: [["VPP – Variación de presión de pulso", "Normal < 13% · fórmula: (PPmax−PPmin)/PPmedia ×100"], ["VPS – Variación de presión sistólica", "Normal < 10%"]] },
];

const VENT_REF = [
  { grupo: "Frecuencia respiratoria", filas: [["Adulto", "12 – 20 rpm"], ["Niño", "20 – 30 rpm"], ["Lactante", "30 – 40 rpm"]] },
  { grupo: "Presiones", filas: [["Presión pico (Ppico)", "< 35 – 40 cmH2O"], ["Presión meseta (Pplat) — protección pulmonar", "< 30 cmH2O"], ["PEEP inicial habitual", "5 cmH2O (ajustar 5 – 15 según necesidad)"]] },
  { grupo: "Otros", filas: [["Relación I:E habitual", "1:2"], ["Volumen tidal protector", "6 – 8 ml/kg de peso predicho (PBW)"]] },
];

function volumenTidal(pesoPredicho, mlPorKg) {
  const p = parseFloat(pesoPredicho), f = parseFloat(mlPorKg);
  if (isNaN(p) || p <= 0 || isNaN(f) || f <= 0) return null;
  return Math.round(p * f);
}

function volumenMinuto(vtMl, frRpm) {
  const vt = parseFloat(vtMl), fr = parseFloat(frRpm);
  if (isNaN(vt) || vt <= 0 || isNaN(fr) || fr <= 0) return null;
  return Math.round(((vt * fr) / 1000) * 100) / 100;
}

function distensibilidadEstatica(vtMl, pplat, peep) {
  const vt = parseFloat(vtMl), pp = parseFloat(pplat), pe = parseFloat(peep);
  if (isNaN(vt) || isNaN(pp) || isNaN(pe) || pp - pe <= 0) return null;
  return Math.round((vt / (pp - pe)) * 10) / 10;
}

// ---------- UI ----------

const MODULES = [
  { id: "peso", eyebrow: "01", label: "Peso ideal / predicho / corregido", grupo: "Cálculos" },
  { id: "ett", eyebrow: "02", label: "Tubo endotraqueal", grupo: "Cálculos" },
  { id: "aminas", eyebrow: "03", label: "Conversión de aminas", grupo: "Cálculos" },
  { id: "induccion", eyebrow: "04", label: "Inducción y sedación", grupo: "Cálculos" },
  { id: "ventmec", eyebrow: "05", label: "Ventilación mecánica", grupo: "Cálculos" },
  { id: "balance", eyebrow: "06", label: "Balance de líquidos", grupo: "Cálculos" },
  { id: "gasometria", eyebrow: "07", label: "Interpretación de gasometría", grupo: "Cálculos" },
  { id: "anestlocales", eyebrow: "08", label: "Dosis máx. anestésicos locales", grupo: "Cálculos" },
  { id: "apfel", eyebrow: "09", label: "Score de Apfel (NVPO)", grupo: "Cálculos" },
  { id: "viaaerea", eyebrow: "R1", label: "Vía aérea difícil", grupo: "Referencia" },
  { id: "scores", eyebrow: "R2", label: "ASA y Caprini", grupo: "Referencia" },
  { id: "referencia", eyebrow: "R3", label: "Hemodinámica", grupo: "Referencia" },
];

function Readout({ value, unit, size = "text-5xl" }) {
  return (
    <div className={`font-mono ${size} tabular-nums text-emerald-300`} style={{ textShadow: "0 0 18px rgba(62,213,152,0.55), 0 0 2px rgba(62,213,152,0.8)" }}>
      {value ?? "—"}
      {unit && <span className="text-lg text-emerald-500/70 ml-2">{unit}</span>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-400 focus:outline-none rounded-md px-3 py-2 text-slate-100 font-mono tabular-nums";

function DrugTable({ title, lista, peso }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-2">{title}</div>
      <div className="space-y-2">
        {(peso ?? lista).map((f) => (
          <div key={f.nombre} className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-sm text-slate-300">{f.nombre}</span>
            <span className="font-mono text-emerald-300 tabular-nums text-sm">
              {peso ? `${f.lowVal} – ${f.highVal} ${f.unidad}` : `${f.low} – ${f.high} ${f.unidad}/kg`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefTable({ rows }) {
  return (
    <div className="space-y-6">
      {rows.map((grupo) => (
        <div key={grupo.grupo}>
          <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80 mb-2">{grupo.grupo}</div>
          <div className="border border-slate-800 rounded-md overflow-hidden">
            {grupo.filas.map(([nombre, valor], i) => (
              <div key={nombre} className={`flex items-center justify-between px-4 py-2.5 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                <span className="text-sm text-slate-300">{nombre}</span>
                <span className="font-mono text-sm text-emerald-300 tabular-nums text-right">{valor}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("peso");

  const [altura, setAltura] = useState("");
  const [sexo, setSexo] = useState("F");
  const [pesoReal, setPesoReal] = useState("");
  const ibw = useMemo(() => pesoIdealDevine(parseFloat(altura), sexo), [altura, sexo]);
  const abw = useMemo(() => pesoCorregido(pesoReal, ibw), [pesoReal, ibw]);

  const [edad, setEdad] = useState("");
  const ett = useMemo(() => tuboETT(edad), [edad]);

  const [modo, setModo] = useState("mcg2ml");
  const [dosis, setDosis] = useState("");
  const [mlHr, setMlHr] = useState("");
  const [pesoPac, setPesoPac] = useState("");
  const [mgBolsa, setMgBolsa] = useState("");
  const [volBolsa, setVolBolsa] = useState("");
  const resultadoAminas = useMemo(() => {
    if (modo === "mcg2ml") return aminasMcgKgMinToMlHr(dosis, pesoPac, mgBolsa, volBolsa);
    return aminasMlHrToMcgKgMin(mlHr, pesoPac, mgBolsa, volBolsa);
  }, [modo, dosis, mlHr, pesoPac, mgBolsa, volBolsa]);

  const [pesoAL, setPesoAL] = useState("");
  const [conEpi, setConEpi] = useState(false);
  const dosisAL = useMemo(() => dosisMaxAL(pesoAL, conEpi), [pesoAL, conEpi]);

  const [gasoPh, setGasoPh] = useState("");
  const [gasoPco2, setGasoPco2] = useState("");
  const [gasoHco3, setGasoHco3] = useState("");
  const [gasoPao2, setGasoPao2] = useState("");
  const gaso = useMemo(() => interpretarGasometria(gasoPh, gasoPco2, gasoHco3, gasoPao2), [gasoPh, gasoPco2, gasoHco3, gasoPao2]);

  const [apfelSel, setApfelSel] = useState({});
  const apfelScore = Object.values(apfelSel).filter(Boolean).length;

  const [pesoVent, setPesoVent] = useState("");
  const [mlKg, setMlKg] = useState("6");
  const vt = useMemo(() => volumenTidal(pesoVent, mlKg), [pesoVent, mlKg]);
  const [vtVm, setVtVm] = useState("");
  const [frVm, setFrVm] = useState("");
  const vm = useMemo(() => volumenMinuto(vtVm, frVm), [vtVm, frVm]);
  const [vtCst, setVtCst] = useState("");
  const [pplatCst, setPplatCst] = useState("");
  const [peepCst, setPeepCst] = useState("");
  const cst = useMemo(() => distensibilidadEstatica(vtCst, pplatCst, peepCst), [vtCst, pplatCst, peepCst]);

  // Balance de líquidos
  const [ivAdmin, setIvAdmin] = useState("");
  const [hemoderivados, setHemoderivados] = useState("");
  const [otrosIn, setOtrosIn] = useState("");
  const [diuresis, setDiuresis] = useState("");
  const [sangrado, setSangrado] = useState("");
  const [insensibles, setInsensibles] = useState("");
  const [otrosOut, setOtrosOut] = useState("");
  const io = useMemo(
    () => balanceIO(ivAdmin, hemoderivados, otrosIn, diuresis, sangrado, insensibles, otrosOut),
    [ivAdmin, hemoderivados, otrosIn, diuresis, sangrado, insensibles, otrosOut]
  );

  const [pesoRepo, setPesoRepo] = useState("");
  const [horasAyuno, setHorasAyuno] = useState("");
  const [severidad, setSeveridad] = useState("menor");
  const repo = useMemo(() => reposicionPerioperatoria(pesoRepo, horasAyuno, severidad), [pesoRepo, horasAyuno, severidad]);

  const [showIntro, setShowIntro] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const gruposNav = ["Cálculos", "Referencia"];
  const currentModule = MODULES.find((m) => m.id === active);

  return (
    <div className="min-h-screen bg-[#0A0E0D] text-slate-100 flex flex-col">
      <style>{`@keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }`}</style>

      {showIntro && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#0D1210] border border-slate-800 rounded-lg p-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-1">Bienvenido</div>
            <h2 className="text-lg font-semibold mb-4">Cómo usar esta app</h2>
            <ul className="space-y-3 text-sm text-slate-300 mb-6">
              <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0 w-4">1.</span><span>Toca la barra de arriba (celular) o el menú lateral (compu) para elegir un módulo.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0 w-4">2.</span><span>Llena los campos — el resultado se calcula solo, sin botón de "calcular".</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0 w-4">3.</span><span>La sección <span className="text-cyan-400">Referencia</span> son datos consultables, no calculadoras.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0 w-4">4.</span><span>Toca el <span className="font-mono">?</span> de arriba cuando quieras volver a ver esto.</span></li>
            </ul>
            <div className="text-[11px] text-amber-500/80 mb-5 leading-relaxed">Herramienta de apoyo educativo. No sustituye el criterio clínico ni protocolos institucionales.</div>
            <button
              onClick={() => setShowIntro(false)}
              className="w-full py-2.5 rounded-md bg-emerald-400/10 border border-emerald-400/60 text-emerald-300 font-mono text-sm hover:bg-emerald-400/20"
            >
              Entendido, empezar
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-400/80">Panel clínico</div>
          <div className="text-lg font-semibold tracking-tight">Calculadoras de Anestesia</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> ACTIVO
          </div>
          <button
            onClick={() => setShowIntro(true)}
            className="w-7 h-7 rounded-full border border-slate-700 text-slate-400 text-xs font-mono flex items-center justify-center hover:border-emerald-400 hover:text-emerald-300"
            aria-label="Ayuda"
          >
            ?
          </button>
        </div>
      </header>

      <div className="md:hidden border-b border-slate-800 relative z-20">
        <button
          onClick={() => setMobileNavOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/40"
        >
          <div className="text-left">
            <div className={`text-[10px] tracking-[0.15em] font-mono ${currentModule?.grupo === "Referencia" ? "text-cyan-500" : "text-slate-500"}`}>{currentModule?.eyebrow}</div>
            <div className="text-sm text-emerald-300">{currentModule?.label}</div>
          </div>
          <span className={`flex items-center justify-center w-9 h-9 rounded-full bg-emerald-400/15 border border-emerald-400/50 text-emerald-300 text-3xl font-bold leading-none transition-transform ${mobileNavOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {mobileNavOpen && (
          <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
            {gruposNav.map((g) => (
              <div key={g} className="mb-3">
                <div className="px-1 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">{g}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODULES.filter((m) => m.grupo === g).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setActive(m.id); setMobileNavOpen(false); }}
                      className={`text-left px-3 py-2.5 rounded-md border transition-colors ${
                        active === m.id ? "bg-emerald-400/10 border-emerald-400/60" : "border-slate-800 hover:bg-slate-900/40"
                      }`}
                    >
                      <div className={`text-[10px] tracking-[0.15em] font-mono ${g === "Referencia" ? "text-cyan-500" : "text-slate-500"}`}>{m.eyebrow}</div>
                      <div className={`text-xs leading-tight ${active === m.id ? "text-emerald-300" : "text-slate-300"}`}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="hidden md:block md:w-60 border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto">
          {gruposNav.map((g) => (
            <div key={g} className="p-3 md:p-0 border-b border-slate-800/60 md:border-b-0 last:border-b-0">
              <div className="px-1 md:px-4 pt-1 md:pt-3 pb-2 md:pb-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">{g}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-2 md:gap-0">
                {MODULES.filter((m) => m.grupo === g).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className={`text-left px-3 py-2.5 rounded-md md:rounded-none border md:border-0 md:border-b border-slate-800 md:border-slate-800/60 transition-colors ${
                      active === m.id
                        ? "bg-emerald-400/10 border-emerald-400/60 md:bg-slate-900/80 md:border-l-2 md:border-l-emerald-400"
                        : "hover:bg-slate-900/40"
                    }`}
                  >
                    <div className={`text-[10px] tracking-[0.15em] font-mono ${g === "Referencia" ? "text-cyan-500" : "text-slate-500"}`}>{m.eyebrow}</div>
                    <div className={`text-xs md:text-sm leading-tight ${active === m.id ? "text-emerald-300" : "text-slate-300"}`}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-5 md:p-8 relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 right-0 h-24 opacity-[0.04] bg-gradient-to-b from-transparent via-emerald-300 to-transparent" style={{ animation: "scan 6s linear infinite" }} />

          {active === "peso" && (
            <section className="max-w-md">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Peso ideal, predicho y corregido</h2>
              <Field label="Sexo">
                <div className="flex gap-2">
                  {["F", "M"].map((s) => (
                    <button key={s} onClick={() => setSexo(s)} className={`flex-1 py-2 rounded-md border font-mono ${sexo === s ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>
                      {s === "F" ? "♀ Femenino" : "♂ Masculino"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Estatura (cm)">
                <input className={inputCls} type="number" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="165" />
              </Field>
              <Field label="Peso real (kg) — solo para peso corregido">
                <input className={inputCls} type="number" value={pesoReal} onChange={(e) => setPesoReal(e.target.value)} placeholder="95" />
              </Field>
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Peso ideal (Devine) — dosificación</div>
                  <Readout value={ibw ?? "—"} unit="kg" size="text-3xl" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Peso predicho (PBW) — mismo cálculo, usado para volumen tidal en ventilación</div>
                  <Readout value={ibw ?? "—"} unit="kg" size="text-3xl" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Peso corregido/ajustado (IBW + 0.4 × [real − IBW]) — pacientes con obesidad</div>
                  <Readout value={abw ?? "—"} unit="kg" size="text-3xl" />
                </div>
              </div>
            </section>
          )}

          {active === "ett" && (
            <section className="max-w-md">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Tubo endotraqueal</h2>
              <Field label="Edad (años)">
                <input className={inputCls} type="number" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="5" />
              </Field>
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Diámetro interno (mm)</div>
                  <Readout value={ett?.diametro ?? "—"} size="text-2xl" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Profundidad de inserción (cm, comisura labial)</div>
                  <Readout value={ett?.profundidad ?? "—"} unit="cm" size="text-3xl" />
                </div>
                {ett?.nota && <p className="text-xs text-slate-500 pt-2">{ett.nota}</p>}
              </div>
            </section>
          )}

          {active === "aminas" && (
            <section className="max-w-md">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Conversión de aminas</h2>
              <div className="flex gap-2 mb-5">
                <button onClick={() => setModo("mcg2ml")} className={`flex-1 py-2 rounded-md border text-xs font-mono ${modo === "mcg2ml" ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>mcg/kg/min → ml/hr</button>
                <button onClick={() => setModo("ml2mcg")} className={`flex-1 py-2 rounded-md border text-xs font-mono ${modo === "ml2mcg" ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>ml/hr → mcg/kg/min</button>
              </div>
              {modo === "mcg2ml" ? (
                <Field label="Dosis (mcg/kg/min)"><input className={inputCls} type="number" value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="0.1" /></Field>
              ) : (
                <Field label="Velocidad de infusión (ml/hr)"><input className={inputCls} type="number" value={mlHr} onChange={(e) => setMlHr(e.target.value)} placeholder="5" /></Field>
              )}
              <Field label="Peso del paciente (kg)"><input className={inputCls} type="number" value={pesoPac} onChange={(e) => setPesoPac(e.target.value)} placeholder="70" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mg en la bolsa"><input className={inputCls} type="number" value={mgBolsa} onChange={(e) => setMgBolsa(e.target.value)} placeholder="4" /></Field>
                <Field label="Volumen (ml)"><input className={inputCls} type="number" value={volBolsa} onChange={(e) => setVolBolsa(e.target.value)} placeholder="250" /></Field>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-800"><Readout value={resultadoAminas ?? "—"} unit={modo === "mcg2ml" ? "ml/hr" : "mcg/kg/min"} /></div>
            </section>
          )}

          {active === "induccion" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Dosis de inducción y sedación</h2>
              <Field label="Peso del paciente (kg)"><input className={inputCls} type="number" value={pesoInduccion} onChange={(e) => setPesoInduccion(e.target.value)} placeholder="70" /></Field>
              <div className="mt-4 pt-4 border-t border-slate-800">
                <DrugTable title="Inducción" lista={INDUCCION_DRUGS} peso={induccion} />
                <DrugTable title="Sedación / mantenimiento" lista={SEDACION_DRUGS} peso={sedacion} />
              </div>
            </section>
          )}

          {active === "ventmec" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Ventilación mecánica</h2>

              <div className="mb-8 p-4 rounded-md border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Volumen tidal protector</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Field label="Peso predicho (kg)"><input className={inputCls} type="number" value={pesoVent} onChange={(e) => setPesoVent(e.target.value)} placeholder="60" /></Field>
                  <Field label="ml/kg objetivo">
                    <select className={inputCls} value={mlKg} onChange={(e) => setMlKg(e.target.value)}>
                      {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} ml/kg</option>)}
                    </select>
                  </Field>
                </div>
                <Readout value={vt ?? "—"} unit="ml" size="text-3xl" />
              </div>

              <div className="mb-8 p-4 rounded-md border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Volumen minuto</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Field label="Volumen tidal (ml)"><input className={inputCls} type="number" value={vtVm} onChange={(e) => setVtVm(e.target.value)} placeholder="420" /></Field>
                  <Field label="Frecuencia (rpm)"><input className={inputCls} type="number" value={frVm} onChange={(e) => setFrVm(e.target.value)} placeholder="14" /></Field>
                </div>
                <Readout value={vm ?? "—"} unit="L/min" size="text-3xl" />
              </div>

              <div className="mb-8 p-4 rounded-md border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Distensibilidad estática</div>
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <Field label="Vt (ml)"><input className={inputCls} type="number" value={vtCst} onChange={(e) => setVtCst(e.target.value)} placeholder="420" /></Field>
                  <Field label="Pplat (cmH2O)"><input className={inputCls} type="number" value={pplatCst} onChange={(e) => setPplatCst(e.target.value)} placeholder="22" /></Field>
                  <Field label="PEEP (cmH2O)"><input className={inputCls} type="number" value={peepCst} onChange={(e) => setPeepCst(e.target.value)} placeholder="5" /></Field>
                </div>
                <Readout value={cst ?? "—"} unit="ml/cmH2O" size="text-3xl" />
              </div>

              <RefTable rows={VENT_REF} />
            </section>
          )}

          {active === "balance" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Balance de líquidos</h2>

              <div className="mb-8 p-4 rounded-md border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Ingresos y egresos</div>
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <Field label="Líquidos IV (ml)"><input className={inputCls} type="number" value={ivAdmin} onChange={(e) => setIvAdmin(e.target.value)} placeholder="1500" /></Field>
                  <Field label="Hemoderivados (ml)"><input className={inputCls} type="number" value={hemoderivados} onChange={(e) => setHemoderivados(e.target.value)} placeholder="0" /></Field>
                </div>
                <Field label="Otros ingresos (ml)"><input className={inputCls} type="number" value={otrosIn} onChange={(e) => setOtrosIn(e.target.value)} placeholder="0" /></Field>
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <Field label="Diuresis (ml)"><input className={inputCls} type="number" value={diuresis} onChange={(e) => setDiuresis(e.target.value)} placeholder="300" /></Field>
                  <Field label="Sangrado estimado (ml)"><input className={inputCls} type="number" value={sangrado} onChange={(e) => setSangrado(e.target.value)} placeholder="200" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pérdidas insensibles (ml)"><input className={inputCls} type="number" value={insensibles} onChange={(e) => setInsensibles(e.target.value)} placeholder="150" /></Field>
                  <Field label="Otros egresos (ml)"><input className={inputCls} type="number" value={otrosOut} onChange={(e) => setOtrosOut(e.target.value)} placeholder="0" /></Field>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Ingresos / Egresos</div>
                    <div className="font-mono text-sm text-slate-300">{io.ingresos} ml / {io.egresos} ml</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Balance neto</div>
                    <Readout value={io.balance} unit="ml" size="text-2xl" />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-md border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Reposición perioperatoria (déficit + mantenimiento + tercer espacio)</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Field label="Peso (kg)"><input className={inputCls} type="number" value={pesoRepo} onChange={(e) => setPesoRepo(e.target.value)} placeholder="70" /></Field>
                  <Field label="Horas de ayuno"><input className={inputCls} type="number" value={horasAyuno} onChange={(e) => setHorasAyuno(e.target.value)} placeholder="8" /></Field>
                </div>
                <Field label="Trauma quirúrgico (tercer espacio)">
                  <div className="flex gap-2">
                    {[["menor", "Menor"], ["moderado", "Moderado"], ["severo", "Severo"]].map(([id, label]) => (
                      <button key={id} onClick={() => setSeveridad(id)} className={`flex-1 py-2 rounded-md border text-xs font-mono ${severidad === id ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>{label}</button>
                    ))}
                  </div>
                </Field>
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Déficit total por ayuno</span>
                    <span className="font-mono text-emerald-300 text-sm">{repo?.deficit ?? "—"} ml</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Mantenimiento horario</span>
                    <span className="font-mono text-emerald-300 text-sm">{repo?.mantHr ?? "—"} ml/hr</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Tercer espacio (por hora)</span>
                    <span className="font-mono text-emerald-300 text-sm">{repo?.tercerEsp ?? "—"} ml/hr</span>
                  </div>
                  <div className="pt-3 border-t border-slate-900 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Hora 1</div>
                      <div className="font-mono text-emerald-300">{repo?.hora1 ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Hora 2</div>
                      <div className="font-mono text-emerald-300">{repo?.hora2 ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Hora 3</div>
                      <div className="font-mono text-emerald-300">{repo?.hora3 ?? "—"}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 text-center">ml a infundir por hora (regla 50% / 25% / 25% del déficit)</div>
                </div>
              </div>
            </section>
          )}

          {active === "anestlocales" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Dosis máxima — anestésicos locales</h2>
              <Field label="Peso del paciente (kg)"><input className={inputCls} type="number" value={pesoAL} onChange={(e) => setPesoAL(e.target.value)} placeholder="70" /></Field>
              <div className="flex gap-2 mb-5">
                <button onClick={() => setConEpi(false)} className={`flex-1 py-2 rounded-md border text-xs font-mono ${!conEpi ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>Sin epinefrina</button>
                <button onClick={() => setConEpi(true)} className={`flex-1 py-2 rounded-md border text-xs font-mono ${conEpi ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-slate-700 text-slate-400"}`}>Con epinefrina</button>
              </div>
              <div className="space-y-3">
                {(dosisAL ?? AL_MAX.map((f) => ({ nombre: f.nombre, mg: conEpi ? f.conEpi : f.sinEpi, tope: conEpi ? f.maxAbsConEpi : f.maxAbsSinEpi }))).map((f) => (
                  <div key={f.nombre} className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-sm text-slate-300">{f.nombre}</span>
                    <span className="font-mono text-emerald-300 tabular-nums text-sm">{dosisAL ? `${f.mg} mg` : `${f.mg} mg/kg`} <span className="text-slate-600">· tope {f.tope} mg</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {active === "gasometria" && (
            <section className="max-w-md">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Interpretación de gasometría arterial</h2>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <Field label="pH"><input className={inputCls} type="number" step="0.01" value={gasoPh} onChange={(e) => setGasoPh(e.target.value)} placeholder="7.30" /></Field>
                <Field label="PaCO2 (mmHg)"><input className={inputCls} type="number" value={gasoPco2} onChange={(e) => setGasoPco2(e.target.value)} placeholder="30" /></Field>
                <Field label="HCO3 (mEq/L)"><input className={inputCls} type="number" value={gasoHco3} onChange={(e) => setGasoHco3(e.target.value)} placeholder="15" /></Field>
              </div>
              <Field label="PaO2 (mmHg) — opcional"><input className={inputCls} type="number" value={gasoPao2} onChange={(e) => setGasoPao2(e.target.value)} placeholder="90" /></Field>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Estado ácido-base</div>
                  <Readout value={gaso?.estado ?? "—"} size="text-2xl" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Trastorno primario</div>
                  <div className="font-mono text-emerald-300 text-lg">{gaso?.primario ?? "—"}</div>
                </div>
                {gaso?.compensacion && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Compensación</div>
                    <div className="text-sm text-slate-300 leading-relaxed">{gaso.compensacion}</div>
                  </div>
                )}
                {gaso?.oxigenacion && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Oxigenación</div>
                    <div className="font-mono text-cyan-300 text-sm">{gaso.oxigenacion}</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {active === "apfel" && (
            <section className="max-w-md">
              <h2 className="text-sm uppercase tracking-[0.15em] text-slate-400 mb-6">Score de Apfel — riesgo de NVPO</h2>
              <div className="space-y-2 mb-6">
                {APFEL_ITEMS.map((it) => (
                  <label key={it.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-slate-800 cursor-pointer hover:bg-slate-900/40">
                    <input type="checkbox" checked={!!apfelSel[it.id]} onChange={(e) => setApfelSel((s) => ({ ...s, [it.id]: e.target.checked }))} className="accent-emerald-400 w-4 h-4" />
                    <span className="text-sm text-slate-300">{it.label}</span>
                  </label>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-800">
                <div className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1">Factores presentes: {apfelScore} de 4</div>
                <Readout value={APFEL_RIESGO[apfelScore]} size="text-4xl" />
                <div className="text-xs text-slate-500 mt-1">Riesgo estimado de náusea/vómito postoperatorio</div>
              </div>
            </section>
          )}

          {active === "viaaerea" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-cyan-400 mb-6">Predictores de vía aérea difícil</h2>
              <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80 mb-2">Escala de Mallampati</div>
              <div className="border border-slate-800 rounded-md overflow-hidden mb-6">
                {MALLAMPATI.map((m, i) => (
                  <div key={m.clase} className={`flex gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                    <span className="font-mono text-emerald-300 w-10">{m.clase}</span>
                    <span className="text-sm text-slate-300">{m.desc}</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80 mb-2">Otros predictores</div>
              <div className="border border-slate-800 rounded-md overflow-hidden">
                {[
                  ["Distancia tiromentoniana", "< 6 cm sugiere vía aérea difícil"],
                  ["Apertura oral", "< 3 cm (≈2 traveses de dedo) sugiere dificultad"],
                  ["Cormack-Lehane (laringoscopia)", "Grados III–IV = visión glótica difícil"],
                  ["Test de mordida (upper lip bite)", "Clase III sugiere dificultad"],
                ].map(([nombre, valor], i) => (
                  <div key={nombre} className={`flex items-center justify-between px-4 py-2.5 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                    <span className="text-sm text-slate-300">{nombre}</span>
                    <span className="text-xs text-emerald-300 text-right max-w-[50%]">{valor}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {active === "scores" && (
            <section className="max-w-lg">
              <h2 className="text-sm uppercase tracking-[0.15em] text-cyan-400 mb-6">Clasificación ASA y riesgo tromboembólico (Caprini)</h2>
              <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80 mb-2">ASA — Estado físico</div>
              <div className="border border-slate-800 rounded-md overflow-hidden mb-6">
                {ASA_CLASES.map((a, i) => (
                  <div key={a.clase} className={`flex gap-4 px-4 py-2.5 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}>
                    <span className="font-mono text-emerald-300 w-10">{a.clase}</span>
                    <span className="text-sm text-slate-300">{a.desc}</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80 mb-2">Caprini — riesgo de TVP</div>
              <div className="border border-slate-800 rounded-md p-4 text-sm text-slate-300 leading-relaxed">
                Escala de puntos ponderados que suma factores como edad, tipo de cirugía, movilidad, antecedentes de TVP/TEP, trombofilias y comorbilidades. Estratificación aproximada por puntaje total:
                <div className="mt-3 space-y-1 font-mono text-xs text-emerald-300">
                  <div>0 pts → riesgo muy bajo</div>
                  <div>1–2 pts → riesgo bajo</div>
                  <div>3–4 pts → riesgo moderado</div>
                  <div>≥5 pts → riesgo alto</div>
                </div>
                <div className="mt-3 text-xs text-amber-500/80">Dado el número de ítems ponderados, usar la escala completa validada para el puntaje definitivo de un paciente real.</div>
              </div>
            </section>
          )}

          {active === "referencia" && (
            <section className="max-w-2xl">
              <h2 className="text-sm uppercase tracking-[0.15em] text-cyan-400 mb-2">Datos de referencia — Hemodinámica</h2>
              <p className="text-xs text-slate-500 mb-6">Valores normales de referencia en el adulto. Interpretar en contexto clínico.</p>
              <RefTable rows={REF_ROWS} />
            </section>
          )}

          <div className="mt-10 pt-4 border-t border-slate-900 text-[11px] text-amber-500/80 leading-relaxed max-w-md">
            Herramienta de apoyo educativo. No sustituye el criterio clínico ni protocolos institucionales. Verificar siempre antes de aplicar en un paciente.
          </div>
        </main>
      </div>
    </div>
  );
}