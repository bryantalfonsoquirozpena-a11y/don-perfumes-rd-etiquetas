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
4. Despliega como Web App.
5. Copia la URL del despliegue.
6. Pega esa URL en app.js, en la constante GOOGLE_SHEETS_WEB_APP_URL.

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
