# Examen a distancia

## Ficheros

| Fichero | Para qué sirve | Dónde va |
|---|---|---|
| `index.html` (+ `index.txt`) | Página del examen que usa el alumnado | Repositorio de GitHub (GitHub Pages) |
| `banco-practica.json` | Preguntas genéricas de práctica (con soluciones, es público) | El mismo repositorio |
| `corrector.html` (+ `corrector.txt`) | Página de corrección; funciona sin conexión en tu ordenador | Tu ordenador (o el repositorio) |
| `Code.gs` | Servidor que guarda los JSON en tu Drive y sirve el banco real | Google Apps Script (cuenta Educaand) |

> No pegues el examen en Google Sites: el iframe de Sites no da permiso de cámara ni de pantalla completa. Hay que abrir directamente la dirección de GitHub Pages.

## Tres modos de uso

1. **Práctica (solo GitHub):** `https://jruecab750.github.io/examen-a-distancia/` usa `banco-practica.json`. Si `SCRIPT_URL` está vacía, el JSON solo se descarga.
2. **Simulacro en Drive:** `https://jruecab750.github.io/examen-a-distancia/?modo=examen` y clave `CLAVE_PRUEBA`. Sirve el banco de prueba que tengas en Drive y guarda los JSON en la carpeta.
3. **Examen real:** la misma dirección `?modo=examen`, con la clave `CLAVE_REAL`. Solo funciona después de ejecutar `abrirExamenReal()`.

## Instalación del servidor (una sola vez, unos 10 minutos)

1. En Drive, crea una carpeta, por ejemplo `EXAMENES-A-DISTANCIA`. Su ID es lo que va detrás de `/folders/` en la dirección.
2. Sube a esa carpeta (o a otra privada) el **banco de prueba** en JSON y copia su ID (aparece en la dirección `/file/d/ID/view`).
3. *(Opcional, recomendado)* Crea una hoja de cálculo con una pestaña `ALUMNADO` y los correos de Educaand en cualquier columna. Copia su ID. El script crea solo las pestañas `EN_DIRECTO` (una fila por alumno que se actualiza cada minuto) y `ENTREGAS`.
4. Ve a script.google.com → Nuevo proyecto, pega `Code.gs` y rellena `CONF`: el ID de la carpeta, los ID de los bancos, las dos claves y el ID de la lista.
5. Ejecuta `comprobarConfiguracion` y acepta los permisos (Drive y Hojas de cálculo).
6. Pulsa **Implementar → Nueva implementación → Aplicación web**, con «Ejecutar como: **Yo**» y «Quién tiene acceso: **Cualquier usuario**». Copia la URL que termina en `/exec`.
7. En `index.html`, pega esa URL en `CONFIG.SCRIPT_URL`, vuelve a subir el fichero a GitHub y renueva el gemelo `.txt`.
8. **Prueba de fuego:** haz el simulacro con una cuenta de alumno de Educaand, desde un ordenador de un centro. Si Educaand no permite «Cualquier usuario», el envío falla y solo queda la descarga. En ese caso, avísame y lo cambiamos.

> Cada vez que cambies `Code.gs` hay que hacer **Implementar → Gestionar implementaciones → Editar → Nueva versión**. Así la URL no cambia.

## El día del examen

1. Un rato antes, sube el **banco real** a Drive, pon su ID en `CONF.BANCO_REAL_ID` y guarda el script. Si cambias `CONF`, no hace falta implementar de nuevo.
2. A la hora de empezar, ejecuta `abrirExamenReal()`. Da la clave real a los 8 centros.
3. Unos 10 minutos después de la hora de inicio, ejecuta `cerrarExamenReal()`. Quien ya está dentro termina con normalidad; nadie nuevo puede empezar.
4. Sigue el examen en directo en la pestaña `EN_DIRECTO`.
5. Los JSON quedan en `carpeta / EXAMEN-ID / Provincia /`. Los progresos parciales quedan en la subcarpeta `_progreso`, por si alguien no llega a entregar.

## Formato del banco (JSON)

```json
{
  "examId": "EXAMEN-ORD-2026",
  "titulo": "Examen presencial · Convocatoria ordinaria",
  "duracionMin": 90,
  "aleatorio": true,
  "preguntas": [
    {"id": "Q001", "tipo": "test", "enun": "Texto…", "op": ["A", "B", "C", "D"], "ok": 2},
    {"id": "Q099", "tipo": "test", "enun": "…", "op": ["…", "…", "…", "Todas las anteriores"], "ok": 3, "fijo": true},
    {"id": "R01", "tipo": "corta", "enun": "Explica…", "max": 2, "solucion": "Orientación para quien corrige"}
  ]
}
```

- `ok` es la posición de la opción correcta, empezando en 0. **Nunca llega al navegador del alumnado**, porque el script la quita.
- `fijo: true` mantiene el orden de las opciones (útil para «Todas las anteriores»).
- Las preguntas de test se barajan por alumno y las cortas van al final. El orden es estable: si el alumno recarga la página, ve el mismo examen.
- Cambia `examId` en cada convocatoria. Así no se mezclan exámenes ni se confunden las reanudaciones.

## Corrección

Abre `corrector.html` y carga el banco **con soluciones** y todos los JSON de la carpeta (puedes seleccionarlos a la vez). En la pantalla obtienes:

- La nota (test automático; las cortas las puntúas pinchando en cada alumno) y la penalización por error que tú elijas.
- Una alerta por alumno (OK, REVISAR o ALTO), las capturas y la línea de tiempo de incidencias, minuto a minuto.
- La columna **Integridad**: si alguien edita el JSON descargado, aparece como MODIFICADO. De todos modos, la copia de referencia es la que llega a Drive.
- **Exportar CSV**, que se abre directamente en Excel.

## Límites (para explicarlos con honestidad)

- Una web **no puede impedir** usar otro dispositivo (móvil, otro ordenador) ni ver otras ventanas sin que la página pierda el foco. Solo **registra** lo que puede detectar. La disuasión real es la vigilancia presencial del centro más el registro.
- El detector de cara se descarga de internet (MediaPipe). Si no carga, el registro lo indica («detector NO disponible») y el examen continúa con la cámara encendida.
- Usa Chrome o Edge en un ordenador. En móviles no hay pantalla completa fiable.
