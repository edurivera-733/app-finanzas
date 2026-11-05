# 💰 Mis Finanzas

App de finanzas personales pensada para iPhone: anota tus **ingresos y gastos**, controla tus **gastos fijos**, descubre cuánto se te va en **gastos hormiga** y sigue tus **metas de ahorro**, todo desde un dashboard simple. Todo es editable.

Es una *web app instalable* (PWA): se agrega a la pantalla de inicio del iPhone, se abre a pantalla completa como una app normal y **funciona sin internet**. No necesita App Store, cuentas ni servidores: tus datos se guardan solo en tu teléfono.

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Inicio (dashboard)** | Saldo disponible primero, luego tu ahorro (del mes y total a la fecha, con tu meta mensual), ingresos, gastos, cuotas del mes, resumen inteligente, cuotas en curso, distribución fijos / variables / hormiga, presupuestos, gastos por categoría, gráfico de 6 meses, metas y últimos movimientos. |
| **Movimientos** | Lista por día con búsqueda y filtros (ingresos, gastos, ahorro, cuotas, fijos, variables, hormiga, por categoría). Toca cualquiera para editarlo, duplicarlo o eliminarlo (con “Deshacer”). |
| **＋ (agregar)** | Gasto, ingreso o **ahorro**. Monto, tipo de gasto (fijo, variable, hormiga), categoría o meta, fecha y nota. “Repetir cada mes” lo convierte en fijo. Si un gasto fue en cuotas, se registra como compra en cuotas. |
| **Pagos** | **Compras en cuotas** con tarjeta de crédito (con o sin interés, tasa mensual) o préstamo: barra con las cuotas pagadas, cuánto queda y cuándo termina; botón “Pagar cuota”. Además gastos, ingresos y ahorros fijos mensuales con “Pagar / Recibir / Ahorrar”. |
| **Metas** | Total ahorrado a la fecha, ahorro del mes, metas con objetivo y fecha límite, aportes y retiros. |
| **Bloqueo** | Código de 4 o 6 dígitos y, si quieres, Face ID / Touch ID para abrir la app. Se puede pedir al salir o después de 1, 5 o 15 minutos. Se activa en *Ajustes → Bloqueo de la app*. |
| **Ajustes (⚙️)** | Nombre, moneda (CLP, MXN, COP, ARS, PEN, USD, EUR y más), meta de ahorro %, tema claro/oscuro, categorías editables (emoji, nombre, tipo de gasto por defecto y presupuesto mensual), respaldo/importación JSON, exportar a Excel (CSV), datos de ejemplo y borrar todo. |

**Saldo y ahorro:** el saldo disponible es tu saldo inicial + ingresos − gastos − lo que apartas como ahorro. El ahorro no es “lo que sobra”: es lo que tú anotas que ahorraste, y se acumula en el total ahorrado a la fecha. Si ya tenías ahorros, regístralos con “Ya lo tenía ahorrado”.

**Gastos hormiga 🐜:** pequeños gastos diarios (café, snacks, delivery, apps de transporte) que sumados pesan mucho. La app te muestra el total del mes, número de compras, promedio, su proyección anual y tiene botones de registro rápido.

## Cómo instalarla en tu iPhone

1. **Publica la app con GitHub Pages** (una sola vez):
   - En GitHub, entra al repositorio → **Settings** → **Pages**.
   - En *Build and deployment* elige **Source: Deploy from a branch**, selecciona la rama (`main` cuando se haga merge, o `claude/personal-finance-app-cq76pu` para probar ya) y la carpeta **`/ (root)`** → **Save**.
   - En un par de minutos aparecerá la dirección, algo como `https://edurivera-733.github.io/app-finanzas/`.
2. En el iPhone, abre esa dirección en **Safari**.
3. Toca **Compartir** (cuadrado con flecha hacia arriba) → **Agregar a pantalla de inicio** → **Agregar**.
4. Abre **Finanzas** desde tu pantalla de inicio. ¡Listo!

## ¿Dónde se guardan mis datos?

- **En tu iPhone**, dentro de la app instalada. No se envían a GitHub ni a ningún servidor.
- **Copia automática en tu Google Drive (opcional, recomendada):** en *Ajustes → Copia automática en Google Drive → Paso a paso: activar*. La app genera un pequeño script con tu clave secreta; lo pegas en [script.google.com](https://script.google.com), lo implementas como *Aplicación web* y pegas la URL en la app. Desde ese momento cada cambio se guarda solo en la carpeta **“Mis Finanzas (respaldos)”** de tu Drive, con una copia por día de los últimos 60 días. Si cambias de teléfono, conectas con la misma URL y clave y tus datos vuelven. También sirve para usar la app en más de un dispositivo. El código está en [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs).
- **Respaldo en iCloud (manual):** *Ajustes → Exportar respaldo → Guardar en Archivos → iCloud Drive*. La app te recuerda hacerlo cada 7 días (o cada 30 si tienes la copia en Google Drive activa).

> ⚠️ Si borras el ícono de la pantalla de inicio sin tener copia en Google Drive o un respaldo, los datos se pierden.

## Probar en el computador

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Estructura

```
index.html            Estructura de la app y barra de pestañas
css/styles.css        Estilos (modo claro y oscuro, adaptado a iPhone)
js/app.js             Lógica, cálculos, vistas y almacenamiento local
manifest.webmanifest  Datos para instalarla como app
sw.js                 Service worker (uso sin conexión)
icons/                Íconos de la app
google-apps-script/   Script para la copia automática en Google Drive
```

Sin dependencias ni compilación: HTML, CSS y JavaScript puro.
