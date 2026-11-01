/**
 * Mis Finanzas — copia automática en Google Drive
 *
 * Este script se instala en TU cuenta de Google (script.google.com) y guarda
 * tus datos en la carpeta "Mis Finanzas (respaldos)" de tu Google Drive.
 * Solo responde a quien conozca la URL de la aplicación web y la CLAVE.
 *
 * La app reemplaza CLAVE automáticamente al copiar el código desde
 * Ajustes → Copia automática en Google Drive.
 */
const CLAVE = 'PEGA-AQUI-TU-CLAVE';
const CARPETA = 'Mis Finanzas (respaldos)';
const ARCHIVO = 'mis-finanzas.json';
const DIAS_DE_HISTORIAL = 60;

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, error: 'Solicitud inválida' });
  }
  if (!req || req.key !== CLAVE) return responder({ ok: false, error: 'Clave incorrecta' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const carpeta = obtenerCarpeta();

    if (req.action === 'load') {
      const f = buscarArchivo(carpeta, ARCHIVO);
      if (!f) return responder({ ok: true, data: null, updatedAt: null });
      const contenido = JSON.parse(f.getBlob().getDataAsString());
      return responder({ ok: true, data: contenido.data, updatedAt: contenido.updatedAt });
    }

    if (req.action === 'save') {
      if (!req.data || !Array.isArray(req.data.transactions)) return responder({ ok: false, error: 'Datos inválidos' });
      const updatedAt = req.updatedAt || new Date().toISOString();
      const texto = JSON.stringify({ updatedAt: updatedAt, data: req.data });
      escribir(carpeta, ARCHIVO, texto);
      // Una copia por día, para poder volver atrás si algo sale mal
      const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      escribir(carpeta, 'historial-' + hoy + '.json', texto);
      limpiarHistorial(carpeta);
      return responder({ ok: true, updatedAt: updatedAt });
    }

    return responder({ ok: false, error: 'Acción desconocida' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'Mis Finanzas: la conexión con Google Drive está lista.' });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function obtenerCarpeta() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}

function buscarArchivo(carpeta, nombre) {
  const it = carpeta.getFilesByName(nombre);
  return it.hasNext() ? it.next() : null;
}

function escribir(carpeta, nombre, texto) {
  const f = buscarArchivo(carpeta, nombre);
  if (f) f.setContent(texto);
  else carpeta.createFile(nombre, texto, MimeType.PLAIN_TEXT);
}

function limpiarHistorial(carpeta) {
  const copias = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf('historial-') === 0) copias.push(f);
  }
  copias.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  copias.slice(DIAS_DE_HISTORIAL).forEach(function (f) { f.setTrashed(true); });
}
