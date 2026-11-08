# SCASSO Costos — Guía de uso e instalación

## 1. Poner la app en tu teléfono (una sola vez)
La app es una PWA: tiene que estar publicada en una dirección **https** para poder instalarse y funcionar sin conexión. Opciones gratuitas, de la más simple a la más prolija:

1. **Netlify Drop** (la más simple): entrá a app.netlify.com/drop desde una computadora, arrastrá la carpeta `scasso` (descomprimida) y te da un link https.
2. **Cloudflare Pages** o **GitHub Pages**: subí la carpeta a un repositorio y activá el hosting estático. Gratis.

Después, en el teléfono Android: abrí el link en **Chrome → menú ⋮ → Instalar aplicación**. Queda el icono de SCASSO en la pantalla de inicio y funciona sin internet.

> Importante: los datos viven en el teléfono donde la usás (IndexedDB). Si abrís el link en otro teléfono o computadora, empieza vacío. Para pasar datos: Configuración → Compartir copia → Importar copia en el otro equipo.

## 2. Orden recomendado de carga
1. **Materias primas**: nombre, presentación (cantidad + unidad) y precio total. La app calcula sola el costo por g/kg, ml/l, unidad. Ej.: romero 250 g a $ 5.000 → $ 20/g y $ 20.000/kg.
2. **Costos indirectos** (Materias → pestaña Costos indirectos): gas, mano de obra por hora, film, etc.
3. **Recetas**: ingredientes, producción final prevista, subproductos y costos indirectos.
4. **Tandas** (Recetas → Registrar tanda): lo que realmente usaste y pesó. Quedan congeladas.
5. **Productos**: componentes (materias, recetas o subproductos), packaging, precio de venta, variantes.

## 3. Cómo calcula (reglas)
- Aritmética decimal exacta; no se redondea nada intermedio, solo se redondea al mostrar.
- Unidades: solo se convierte dentro de la misma magnitud (g↔kg, ml↔l, un↔docena). Cargar gramos sobre un insumo comprado en litros da error, nunca una conversión inventada.
- **Costo por kg terminado = costo de producción ÷ kg finales aprovechables** (no sobre el peso inicial). Merma = (inicial − final) ÷ inicial.
- El peso inicial se suma solo si todos los ingredientes se miden en peso; si hay líquidos o unidades mezclados, la app no inventa un rendimiento (podés cargar el peso inicial a mano).
- Si la receta tiene tandas registradas, usa el **rendimiento real histórico ponderado** (Σ final ÷ Σ inicial); si no, el estimado, y lo indica con una etiqueta.
- **Subproductos**: el costo asignado se *resta* de la receta principal y se *transfiere* a donde se use (ej. grasa → papas cuña). Nunca se vuelve a cobrar como compra. Métodos: por peso, por valor relativo de venta, manual (%), o aprovechamiento interno sin asignación. Descarte = sin costo asignado.
- **Margen** = ganancia ÷ precio de venta. **Markup** = ganancia ÷ costo. Precio sugerido = costo ÷ (1 − margen). Ej.: costo $ 5.000, margen 60 % → $ 12.500.
- Contribución = ganancia bruta − comisiones, impuestos y costos de venta (se muestra aparte del margen bruto).
- Costos históricos de tandas **no cambian** cuando suben los precios. Las recetas muestran siempre costo estimado con precios actuales.

## 4. Simulador de escenarios
Inicio → **Simulador de escenarios** (o "Ver impacto en productos" en una alerta de precio).
- Elegí una materia prima y escribí el precio nuevo (ej. carne de $ 7.500 a $ 9.000 por kg). También hay cambio porcentual por categoría y costos indirectos.
- Ves al instante, por producto: costo hoy → simulado, diferencia, margen hoy → simulado, **precio que mantiene tu margen actual** y precio para el margen objetivo. También recetas afectadas.
- **No modifica tus datos**: trabaja sobre una copia en memoria. Podés guardar escenarios para comparar y exportarlos a PDF/Excel/CSV.
- Solo si tocás "Aplicar a precios reales…" y confirmás, se actualizan los precios guardados (con historial).

## 5. Informes
Costos por receta / kg / porción / producto, márgenes comerciales, historial de precios, evolución de costos y rendimiento de producciones. Cada uno se exporta a **PDF, Excel o CSV** y se comparte desde el teléfono (WhatsApp, correo, Drive).

## 6. Seguridad de datos
- Se guarda automáticamente en el teléfono (IndexedDB). No se pierde al cerrar el navegador.
- **Hacé una copia de seguridad periódica** (Configuración → Compartir copia). Si se borran los datos del navegador o se pierde el teléfono, es lo que permite recuperar todo. La app avisa si pasaron más de 30 días.
- Todo borrado pide confirmación; no se puede borrar una materia prima, receta o indirecto que esté en uso.

## 7. Datos de ejemplo
La primera vez podés tocar "Probar con datos de ejemplo" para ver todo funcionando (precios inventados). Se borran con Configuración → Borrar todos los datos.

## 8. Para desarrolladores
- Sin dependencias ni compilación: JavaScript puro (ES2020) + CSS. `index.html` carga `js/*.js` en orden.
- `js/decimal.js` (BigInt, 30 decimales) · `js/units.js` · `js/engine.js` (motor puro, usado también por el simulador) · `js/store.js` (adaptador de persistencia) · `js/ui-*.js` (pantallas).
- **Pruebas matemáticas**: `node tests/run.js` (105 pruebas: porchetta 15 kg, salsa, panificado, SCASSO Signature, grasa recuperada, simulador, planificador, margen/markup).
- **Nube y multiusuario**: todo registro tiene `id` (uuid), `createdAt`, `updatedAt` y `ownerId` (hoy `null`). Para Supabase alcanza con escribir otro adaptador con la interfaz `{ name, load(), save(state) }` y asignarlo a `SC.store.adapter`; luego sumar autenticación y reglas por `ownerId`.
- Por qué JS puro y no React/Tailwind: el entorno de desarrollo no tenía acceso a internet para instalar paquetes, y para una app de uso individual sin build es más liviana, estable y no depende de actualizaciones de librerías. El código está separado por módulos y puede migrarse a React/TypeScript más adelante porque el motor de cálculo es independiente de la interfaz.
