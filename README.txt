DON PERFUMES RD - Aplicacion interna de etiquetas

Archivos:
- index.html: abre la aplicacion.
- styles.css: diseno responsive.
- app.js: logica de pedidos, historial, PDF 4x6 e impresion.
- google-apps-script.gs: codigo para conectar con Google Sheets.

Uso:
1. Abre index.html en el navegador. No necesitas servidor ni login para probar.
2. En Catalogo de Productos, agrega los productos y sus precios por tamano.
3. Llena el pedido seleccionando productos desde el catalogo.
4. Agrega varios productos si hace falta.
5. Pulsa Generar etiqueta para guardar el pedido y descargar el PDF 4x6.
6. Pulsa Imprimir para imprimir la etiqueta visible.

Catalogo:
- Puedes agregar, editar, desactivar o eliminar productos.
- Cada producto tiene precios separados para 5ml, 15ml, 60ml y 120ml.
- Los productos desactivados no aparecen para pedidos nuevos.
- El catalogo se guarda localmente en el navegador.

Importacion masiva desde Google Sheets:
1. En Google Sheets usa estas columnas: producto, 5ml, 15ml, 60ml, 120ml, activo.
2. En activo puedes usar si/no, activo/inactivo, true/false o 1/0.
3. Publica la hoja o descarga/exporta como CSV.
4. Pega la URL CSV en la app y pulsa Importar productos.
5. Si el navegador bloquea la URL, copia el contenido CSV y pegalo en el campo "O pega el contenido CSV".
6. Si un producto importado tiene el mismo nombre que uno existente, se actualiza.

Archivo de ejemplo:
- plantilla-productos.csv

Google Sheets:
1. Crea una hoja nueva en Google Sheets.
2. Ve a Extensiones > Apps Script.
3. Pega el contenido de google-apps-script.gs.
4. En el selector de funciones, elige setup y pulsa Ejecutar.
5. Acepta los permisos de Google. Esto crea/autoriza las hojas Pedidos y Productos.
6. Despliega como Web App.
7. En "Ejecutar como", elige tu usuario.
8. En "Quien tiene acceso", elige cualquiera con el enlace.
9. Copia la URL del despliegue que termina en /exec.
10. Abre la app y pega esa URL en "Conexion Google Sheets".
11. Pulsa Guardar URL y luego Sincronizar.

Si ves "No se pudo leer Sheets; usando datos locales":
- Confirma que pegaste la URL terminada en /exec, no /dev.
- Confirma que el Web App tiene acceso para cualquiera con el enlace.
- Confirma que ejecutaste setup una vez y aceptaste permisos.
- Si editaste el Apps Script, crea una nueva implementacion/version y pega la URL nueva.

Cuando Google Sheets este conectado:
- Los pedidos se guardan automaticamente en la hoja Pedidos.
- El catalogo de productos se guarda automaticamente en la hoja Productos.
- El historial y el catalogo se cargan desde Google Sheets al abrir la app.
- Si no hay conexion o no se ha pegado URL, la app sigue usando almacenamiento local.
- Al sincronizar con una hoja vacia, la app conserva los datos locales y los sube a Sheets para evitar perdidas.
- En uso con varios equipos, Apps Script bloquea escrituras simultaneas y valida codigos de pedido repetidos.

Version estable:
- Antes de operar desde varios equipos, abre la app y pulsa Sincronizar.
- Para cambios masivos de productos, usa Importar productos y luego verifica la hoja Productos.
- El boton Subir catalogo reemplaza el catalogo remoto por el catalogo visible en la app; usalo solo cuando quieras forzar esa copia.
- El Web App de Apps Script funciona sin login propio. La URL debe tratarse como privada porque permite guardar datos en la hoja.

Notas:
- Aunque no conectes Google Sheets, el historial funciona localmente en el navegador.
- El PDF se genera en tamano 4x6 pulgadas.
- Esta primera version funciona localmente sin depender de internet.

Historial de pedidos:
- Puedes buscar pedidos por nombre, telefono o codigo de pedido.
- El boton Ver pedido carga un pedido anterior en el formulario y en la vista de etiqueta.
- El boton Reimprimir etiqueta carga el pedido y abre la impresion de la etiqueta 4x6.

Etiqueta 4x6:
- Incluye logo textual de Don Perfumes RD, codigo de pedido, cliente, telefono, direccion, productos, total, metodo de pago y QR con el codigo del pedido.
