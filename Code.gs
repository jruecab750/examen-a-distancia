/**
 * EXAMEN A DISTANCIA · Servidor en Google Apps Script
 * ----------------------------------------------------------------
 * Qué hace:
 *  1) GUARDA en tu carpeta de Drive el JSON de cada alumno (progreso cada minuto y entrega final).
 *  2) SIRVE el banco de preguntas de Drive SIN las respuestas correctas, solo con la clave
 *     y solo cuando tú abres el examen.
 *  3) (Opcional) Comprueba que el correo está en la lista de alumnado y apunta cada entrega
 *     en la hoja «ENTREGAS» para seguir el examen en directo.
 *
 * Cómo se instala: mira las instrucciones en LEEME.md.
 */

// ======================= CONFIGURACIÓN =======================
const CONF = {
  CARPETA_ID: "PEGA_AQUI_EL_ID_DE_LA_CARPETA",   // carpeta de Drive donde se guardan los exámenes
  BANCO_PRUEBA_ID: "",   // ID del fichero JSON del examen de prueba (simulacro) en Drive
  BANCO_REAL_ID: "",     // ID del fichero JSON del examen real (súbelo poco antes)
  CLAVE_PRUEBA: "PRUEBA2026",
  CLAVE_REAL: "CAMBIAME",
  LISTA_ID: "",          // ID de la hoja de cálculo con la lista de alumnado (vacío = no se comprueba)
  LISTA_HOJA: "ALUMNADO" // pestaña con los correos (cualquier columna; se buscan celdas con @)
};
// =============================================================

/** Ejecuta esta función desde el editor para ABRIR el examen real. */
function abrirExamenReal() { PropertiesService.getScriptProperties().setProperty("REAL_ABIERTO", "si"); CacheService.getScriptCache().remove("banco_real"); Logger.log("Examen REAL abierto"); }
/** Ejecuta esta función para CERRAR el examen real (nadie más podrá empezarlo). */
function cerrarExamenReal() { PropertiesService.getScriptProperties().setProperty("REAL_ABIERTO", "no"); Logger.log("Examen REAL cerrado"); }
/** Prueba rápida: comprueba que la carpeta y los bancos se pueden leer. */
function comprobarConfiguracion() {
  Logger.log("Carpeta: " + DriveApp.getFolderById(CONF.CARPETA_ID).getName());
  if (CONF.BANCO_PRUEBA_ID) Logger.log("Banco prueba: " + JSON.parse(DriveApp.getFileById(CONF.BANCO_PRUEBA_ID).getBlob().getDataAsString()).preguntas.length + " preguntas");
  if (CONF.BANCO_REAL_ID) Logger.log("Banco real: " + JSON.parse(DriveApp.getFileById(CONF.BANCO_REAL_ID).getBlob().getDataAsString()).preguntas.length + " preguntas");
  if (CONF.LISTA_ID) Logger.log("Alumnado en lista: " + listaCorreos_().length);
  Logger.log("Examen real abierto: " + (PropertiesService.getScriptProperties().getProperty("REAL_ABIERTO") || "no"));
}

// ---------- Entrada GET: entregar el banco ----------
function doGet(e) {
  const p = e.parameter || {};
  try {
    if (p.accion === "ping") return json_({ ok: true, hora: new Date().toISOString() });
    if (p.accion !== "banco") return json_({ ok: false, error: "Acción no válida" });

    const clave = String(p.clave || "").trim();
    const correo = String(p.correo || "").trim().toLowerCase();
    let tipo;
    if (clave === CONF.CLAVE_PRUEBA && CONF.BANCO_PRUEBA_ID) tipo = "prueba";
    else if (clave === CONF.CLAVE_REAL && CONF.BANCO_REAL_ID) tipo = "real";
    else return json_({ ok: false, error: "Clave incorrecta." });

    if (tipo === "real" && PropertiesService.getScriptProperties().getProperty("REAL_ABIERTO") !== "si")
      return json_({ ok: false, error: "El examen todavía no está abierto o ya se ha cerrado. Espera la indicación del profesorado." });
    if (!correoPermitido_(correo))
      return json_({ ok: false, error: "Tu correo no figura en la lista del examen. Avisa al profesorado." });

    return json_({ ok: true, banco: bancoSinSoluciones_(tipo) });
  } catch (err) {
    return json_({ ok: false, error: "Error del servidor: " + err.message });
  }
}

// ---------- Entrada POST: guardar el JSON ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.accion !== "guardar" || !d.registro || !d.registro.alumno) return json_({ ok: false, error: "Datos incompletos" });
    const reg = d.registro, al = reg.alumno;
    const correo = String(al.correo || "").toLowerCase();
    if (d.modo === "examen" && !correoPermitido_(correo)) return json_({ ok: false, error: "Correo no autorizado" });

    lock.waitLock(20000);
    const raiz = DriveApp.getFolderById(CONF.CARPETA_ID);
    const base = subcarpeta_(raiz, d.modo === "examen" ? reg.examId : "PRACTICAS");
    const prov = subcarpeta_(base, limpio_(al.provincia || "SIN-PROVINCIA"));
    const contenido = JSON.stringify(reg);

    let nombre;
    if (d.estado === "final") {
      nombre = limpio_(d.archivo || ("examen_" + al.usuario + ".json"));
      if (!/\.json$/.test(nombre)) nombre += ".json";
      escribir_(prov, nombre, contenido);
    } else {
      nombre = "PROGRESO_" + limpio_(al.usuario) + ".json";
      escribir_(subcarpeta_(prov, "_progreso"), nombre, contenido);
    }
    anotar_(d, reg, nombre);
    return json_({ ok: true, archivo: nombre, recibido: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---------- Auxiliares ----------
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function limpio_(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 150); }
function subcarpeta_(padre, nombre) { const it = padre.getFoldersByName(nombre); return it.hasNext() ? it.next() : padre.createFolder(nombre); }
function escribir_(carpeta, nombre, contenido) {
  const it = carpeta.getFilesByName(nombre);
  if (it.hasNext()) it.next().setContent(contenido);
  else carpeta.createFile(nombre, contenido, MimeType.PLAIN_TEXT);
}

function bancoSinSoluciones_(tipo) {
  const cache = CacheService.getScriptCache(), k = "banco_" + tipo;
  const c = cache.get(k);
  if (c) return JSON.parse(c);
  const id = tipo === "real" ? CONF.BANCO_REAL_ID : CONF.BANCO_PRUEBA_ID;
  const b = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
  b.preguntas = b.preguntas.map(function (p) { const q = Object.assign({}, p); delete q.ok; delete q.solucion; return q; });
  try { cache.put(k, JSON.stringify(b), 600); } catch (x) { /* banco > 100 KB: sin caché */ }
  return b;
}

function listaCorreos_() {
  const cache = CacheService.getScriptCache(), c = cache.get("lista");
  if (c) return JSON.parse(c);
  const vals = SpreadsheetApp.openById(CONF.LISTA_ID).getSheetByName(CONF.LISTA_HOJA).getDataRange().getValues();
  const lista = [];
  vals.forEach(function (fila) { fila.forEach(function (v) { const s = String(v).trim().toLowerCase(); if (s.indexOf("@") > 0) lista.push(s); }); });
  cache.put("lista", JSON.stringify(lista), 600);
  return lista;
}
function correoPermitido_(correo) { return !CONF.LISTA_ID || listaCorreos_().indexOf(correo) >= 0; }

function anotar_(d, reg, nombre) {
  if (!CONF.LISTA_ID) return;
  // Una fila por alumno y modo en «EN_DIRECTO» (se actualiza con cada envío) y una fila por entrega final en «ENTREGAS».
  const ss = SpreadsheetApp.openById(CONF.LISTA_ID);
  const cab = ["Recibido", "Estado", "Modo", "Provincia", "Apellidos", "Nombre", "Correo", "Respondidas", "Cambios pestaña", "Sin foco", "Salidas pantalla completa", "Episodios sin cara", "Varias caras", "Copiar/pegar", "Reanudaciones", "Archivo"];
  const r = reg.resumen || {};
  const fila = [new Date(), d.estado, d.modo, reg.alumno.provincia, reg.alumno.apellidos, reg.alumno.nombre, reg.alumno.correo,
    (r.respondidas || 0) + "/" + (r.total || 0), r.cambiosPestana || 0, r.ventanaSinFoco || 0, r.salidasPantallaCompleta || 0,
    r.episodiosSinCara || 0, r.episodiosVariasCaras || 0, r.intentosCopiarPegar || 0, r.reanudaciones || 0, nombre];
  const hoja = function (n) { const h = ss.getSheetByName(n) || ss.insertSheet(n); if (h.getLastRow() === 0) h.appendRow(cab); return h; };

  const dir = hoja("EN_DIRECTO");
  const clave = reg.alumno.correo + "|" + d.modo;
  const props = PropertiesService.getScriptProperties();
  const filaGuardada = Number(props.getProperty("fila_" + clave) || 0);
  if (filaGuardada > 1) dir.getRange(filaGuardada, 1, 1, fila.length).setValues([fila]);
  else { dir.appendRow(fila); props.setProperty("fila_" + clave, String(dir.getLastRow())); }

  if (d.estado === "final") hoja("ENTREGAS").appendRow(fila);
}
