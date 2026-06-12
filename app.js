const SIZES = ["5ml", "15ml", "60ml", "120ml"];

// Pega aqui la URL de tu Apps Script desplegado como Web App.
const GOOGLE_SHEETS_WEB_APP_URL = "";

const state = {
  orders: JSON.parse(localStorage.getItem("donPerfumesOrders") || "[]"),
  catalog: JSON.parse(localStorage.getItem("donPerfumesCatalog") || "[]"),
  currentOrder: null
};

const form = document.querySelector("#orderForm");
const productsList = document.querySelector("#productsList");
const addProductBtn = document.querySelector("#addProductBtn");
const newOrderBtn = document.querySelector("#newOrderBtn");
const downloadPdfBtn = document.querySelector("#downloadPdfBtn");
const sendWhatsappBtn = document.querySelector("#sendWhatsappBtn");
const printBtn = document.querySelector("#printBtn");
const searchByName = document.querySelector("#searchByName");
const searchByPhone = document.querySelector("#searchByPhone");
const searchByOrder = document.querySelector("#searchByOrder");
const historyList = document.querySelector("#historyList");
const syncStatus = document.querySelector("#syncStatus");
const catalogForm = document.querySelector("#catalogForm");
const catalogList = document.querySelector("#catalogList");
const cancelCatalogEditBtn = document.querySelector("#cancelCatalogEditBtn");
const importCatalogForm = document.querySelector("#importCatalogForm");
const catalogCsvUrl = document.querySelector("#catalogCsvUrl");
const catalogCsvText = document.querySelector("#catalogCsvText");
const importStatus = document.querySelector("#importStatus");

const money = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 0
});

function formatMoney(value) {
  return money.format(Number(value || 0)).replace("DOP", "RD$").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function appId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextOrderNumber() {
  const usedNumbers = state.orders
    .map(order => /^DP-(\d{5})$/.exec(order.orderNumber || ""))
    .filter(Boolean)
    .map(match => Number(match[1]));
  const next = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  return `DP-${String(next).padStart(5, "0")}`;
}

function isDuplicateOrderNumber(order) {
  return state.orders.some(saved => {
    return saved.orderNumber === order.orderNumber && saved.id !== order.id;
  });
}

function saveOrders() {
  localStorage.setItem("donPerfumesOrders", JSON.stringify(state.orders));
}

function saveCatalog() {
  localStorage.setItem("donPerfumesCatalog", JSON.stringify(state.catalog));
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseMoney(value) {
  const cleaned = String(value ?? "")
    .replace(/rd\$/gi, "")
    .replace(/dop/gi, "")
    .replace(/,/g, "")
    .trim();
  return Number(cleaned || 0);
}

function parseBoolean(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return true;
  return !["no", "false", "falso", "inactivo", "0", "desactivado"].includes(normalized);
}

function activeCatalog() {
  return state.catalog
    .filter(product => product.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findCatalogProduct(id) {
  return state.catalog.find(product => product.id === id);
}

function productDisplayName(item) {
  if (item.product) return item.product;
  return findCatalogProduct(item.productId)?.name || "";
}

function getCatalogFormData() {
  return {
    id: document.querySelector("#catalogProductId").value || appId(),
    name: document.querySelector("#catalogProductName").value.trim(),
    active: true,
    prices: {
      "5ml": Number(document.querySelector("#price5ml").value || 0),
      "15ml": Number(document.querySelector("#price15ml").value || 0),
      "60ml": Number(document.querySelector("#price60ml").value || 0),
      "120ml": Number(document.querySelector("#price120ml").value || 0)
    }
  };
}

function resetCatalogForm() {
  catalogForm.reset();
  document.querySelector("#catalogProductId").value = "";
  document.querySelector("#saveCatalogBtn").textContent = "Guardar producto";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

function getCsvValue(record, possibleKeys) {
  for (const key of possibleKeys) {
    if (record[key] !== undefined) return record[key];
  }
  return "";
}

function productsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeKey);
  return rows.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });

    const name = getCsvValue(record, ["producto", "nombre", "nombreproducto", "product", "name"]).trim();
    if (!name) return null;

    return {
      id: appId(),
      name,
      active: parseBoolean(getCsvValue(record, ["activo", "active", "estado", "status"])),
      prices: {
        "5ml": parseMoney(getCsvValue(record, ["5ml", "precio5ml"])),
        "15ml": parseMoney(getCsvValue(record, ["15ml", "precio15ml"])),
        "60ml": parseMoney(getCsvValue(record, ["60ml", "precio60ml"])),
        "120ml": parseMoney(getCsvValue(record, ["120ml", "precio120ml"]))
      }
    };
  }).filter(Boolean);
}

function importCatalogProducts(products) {
  let created = 0;
  let updated = 0;

  products.forEach(imported => {
    const existingIndex = state.catalog.findIndex(product => {
      return normalizeKey(product.name) === normalizeKey(imported.name);
    });

    if (existingIndex >= 0) {
      state.catalog[existingIndex] = {
        ...state.catalog[existingIndex],
        name: imported.name,
        active: imported.active,
        prices: imported.prices
      };
      updated += 1;
    } else {
      state.catalog.push(imported);
      created += 1;
    }
  });

  saveCatalog();
  renderCatalog();
  refreshOrderProductOptions();
  return { created, updated };
}

function renderCatalog() {
  catalogList.innerHTML = state.catalog.length
    ? ""
    : `<p class="empty-history">Agrega productos para usarlos en los pedidos.</p>`;

  state.catalog
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(product => {
      const item = document.createElement("div");
      item.className = `catalog-item ${product.active === false ? "is-inactive" : ""}`;
      item.innerHTML = `
        <div class="catalog-summary">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${product.active === false ? "Inactivo" : "Activo"}</span>
          <p>5ml ${formatMoney(product.prices["5ml"])} · 15ml ${formatMoney(product.prices["15ml"])} · 60ml ${formatMoney(product.prices["60ml"])} · 120ml ${formatMoney(product.prices["120ml"])}</p>
        </div>
        <div class="catalog-actions">
          <button class="secondary-btn edit-catalog" type="button" data-id="${product.id}">Editar</button>
          <button class="secondary-btn toggle-catalog" type="button" data-id="${product.id}">${product.active === false ? "Activar" : "Desactivar"}</button>
          <button class="danger-btn delete-catalog" type="button" data-id="${product.id}">Eliminar</button>
        </div>
      `;
      catalogList.appendChild(item);
    });
}

function catalogOptions(selectedId = "") {
  const active = activeCatalog();
  if (!active.length) {
    return `<option value="">Agrega productos al catalogo</option>`;
  }

  const selectedProduct = selectedId ? findCatalogProduct(selectedId) : null;
  const options = active.map(product => {
    return `<option value="${product.id}" ${product.id === selectedId ? "selected" : ""}>${escapeHtml(product.name)}</option>`;
  });

  if (selectedProduct && selectedProduct.active === false) {
    options.unshift(`<option value="${selectedProduct.id}" selected>${escapeHtml(selectedProduct.name)} (inactivo)</option>`);
  }

  return `<option value="">Seleccionar producto</option>${options.join("")}`;
}

function refreshOrderProductOptions() {
  document.querySelectorAll(".product-row").forEach(row => {
    const select = row.querySelector(".product-select");
    const selected = select.value;
    select.innerHTML = catalogOptions(selected);
    if (selected && findCatalogProduct(selected)) select.value = selected;
    updateRowPrice(row);
  });
  updateTotals();
}

function productRowTemplate(product = {}) {
  const selectedId = product.productId || "";
  const row = document.createElement("div");
  row.className = "product-row";
  row.innerHTML = `
    <label>
      <span>Producto</span>
      <select class="product-select" required>
        ${catalogOptions(selectedId)}
      </select>
    </label>
    <label>
      <span>Tamano</span>
      <select class="product-size">
        ${SIZES.map(size => `<option value="${size}" ${product.size === size ? "selected" : ""}>${size}</option>`).join("")}
      </select>
    </label>
    <label>
      <span>Cantidad</span>
      <input class="product-qty" type="number" min="1" step="1" value="${product.quantity || 1}" required>
    </label>
    <label>
      <span>Precio unitario</span>
      <input class="product-price" type="number" min="0" step="1" value="${product.price || 0}" readonly>
    </label>
    <label>
      <span>Subtotal</span>
      <div class="line-total">RD$0</div>
    </label>
    <button class="remove-btn" type="button" aria-label="Eliminar producto">x</button>
  `;
  productsList.appendChild(row);
  if (selectedId) row.querySelector(".product-select").value = selectedId;
  updateRowPrice(row);
  updateTotals();
}

function getProducts() {
  return [...document.querySelectorAll(".product-row")].map(row => {
    const productId = row.querySelector(".product-select").value;
    const catalogProduct = findCatalogProduct(productId);
    const quantity = Number(row.querySelector(".product-qty").value || 0);
    const price = Number(row.querySelector(".product-price").value || 0);
    const size = row.querySelector(".product-size").value;

    return {
      productId,
      product: catalogProduct?.name || "",
      size,
      quantity,
      price,
      subtotal: quantity * price
    };
  });
}

function updateRowPrice(row) {
  const productId = row.querySelector(".product-select").value;
  const size = row.querySelector(".product-size").value;
  const price = findCatalogProduct(productId)?.prices?.[size] || 0;
  const qty = Number(row.querySelector(".product-qty").value || 0);

  row.querySelector(".product-price").value = price;
  row.querySelector(".line-total").textContent = formatMoney(qty * price);
}

function calculateTotal() {
  return getProducts().reduce((sum, item) => sum + item.subtotal, 0);
}

function updateTotals() {
  const total = calculateTotal();
  document.querySelector("#orderTotal").textContent = formatMoney(total);
  updatePreview();
}

function readFormOrder() {
  const orderNumber = document.querySelector("#orderNumber").value.trim() || nextOrderNumber();
  const products = getProducts();
  return {
    id: state.currentOrder?.id || appId(),
    createdAt: state.currentOrder?.createdAt || new Date().toISOString(),
    orderNumber,
    customerName: document.querySelector("#customerName").value.trim(),
    phone: document.querySelector("#phone").value.trim(),
    address: document.querySelector("#address").value.trim(),
    province: document.querySelector("#province").value.trim(),
    city: document.querySelector("#city").value.trim(),
    reference: document.querySelector("#reference").value.trim(),
    paymentMethod: document.querySelector("#paymentMethod").value,
    orderNote: document.querySelector("#orderNote").value.trim(),
    shippingCompany: document.querySelector("#shippingCompany").value.trim(),
    products,
    total: products.reduce((sum, item) => sum + item.subtotal, 0)
  };
}

function gfTables() {
  const exp = new Array(512);
  const log = new Array(256);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let index = 255; index < 512; index += 1) {
    exp[index] = exp[index - 255];
  }

  return { exp, log };
}

const QR_GF = gfTables();

function gfMul(a, b) {
  if (!a || !b) return 0;
  return QR_GF.exp[QR_GF.log[a] + QR_GF.log[b]];
}

function qrGeneratorPolynomial(degree) {
  let poly = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((coefficient, position) => {
      next[position] ^= coefficient;
      next[position + 1] ^= gfMul(coefficient, QR_GF.exp[index]);
    });
    poly = next;
  }
  return poly;
}

function qrErrorCorrection(data, count) {
  const generator = qrGeneratorPolynomial(count);
  const result = new Array(count).fill(0);

  data.forEach(codeword => {
    const factor = codeword ^ result[0];
    result.shift();
    result.push(0);

    for (let index = 0; index < count; index += 1) {
      result[index] ^= gfMul(generator[index + 1], factor);
    }
  });

  return result;
}

function bitsFromNumber(value, length) {
  return Array.from({ length }, (_, index) => (value >> (length - index - 1)) & 1);
}

function qrDataCodewords(text) {
  const bytes = [...String(text)].map(character => character.charCodeAt(0) & 0xff);
  const bits = [
    ...bitsFromNumber(4, 4),
    ...bitsFromNumber(bytes.length, 8),
    ...bytes.flatMap(byte => bitsFromNumber(byte, 8))
  ];

  while (bits.length < 152 && bits.length % 8 !== 0) bits.push(0);
  while (bits.length < 152) bits.push(0);

  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }

  let padIndex = 0;
  while (data.length < 19) {
    data.push(padIndex % 2 === 0 ? 0xec : 0x11);
    padIndex += 1;
  }

  return data.slice(0, 19);
}

function qrFormatBits() {
  let data = 0b01000;
  let value = data << 10;
  const generator = 0b10100110111;

  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((value >> bit) & 1) value ^= generator << (bit - 10);
  }

  return ((data << 10) | value) ^ 0b101010000010010;
}

function makeQrMatrix(text) {
  const size = 21;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (row, col, value, isReserved = true) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    matrix[row][col] = Boolean(value);
    if (isReserved) reserved[row][col] = true;
  };

  const finder = (row, col) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const currentRow = row + y;
        const currentCol = col + x;
        if (currentRow < 0 || currentCol < 0 || currentRow >= size || currentCol >= size) continue;
        const isFinder = y >= 0 && y <= 6 && x >= 0 && x <= 6;
        const isBlack = isFinder && (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4));
        set(currentRow, currentCol, isBlack);
      }
    }
  };

  finder(0, 0);
  finder(0, 14);
  finder(14, 0);

  for (let index = 8; index <= 12; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }
  set(13, 8, true);

  const formatA = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const formatB = [[20,8],[19,8],[18,8],[17,8],[16,8],[15,8],[14,8],[8,13],[8,14],[8,15],[8,16],[8,17],[8,18],[8,19],[8,20]];
  [...formatA, ...formatB].forEach(([row, col]) => set(row, col, false));

  const data = qrDataCodewords(text);
  const codewords = [...data, ...qrErrorCorrection(data, 7)];
  const bits = codewords.flatMap(byte => bitsFromNumber(byte, 8));
  let bitIndex = 0;
  let upward = true;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let offset = 0; offset < size; offset += 1) {
      const row = upward ? size - 1 - offset : offset;
      for (let currentCol = col; currentCol >= col - 1; currentCol -= 1) {
        if (reserved[row][currentCol]) continue;
        const raw = bits[bitIndex] || 0;
        const masked = raw ^ ((row + currentCol) % 2 === 0 ? 1 : 0);
        set(row, currentCol, masked, false);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  const format = qrFormatBits();
  formatA.forEach(([row, col], index) => set(row, col, (format >> index) & 1));
  formatB.forEach(([row, col], index) => set(row, col, (format >> index) & 1));

  return matrix;
}

function drawQrToCanvas(text) {
  const canvas = document.querySelector("#previewQr");
  if (!canvas) return;

  const matrix = makeQrMatrix(text);
  const scale = Math.floor(canvas.width / 29);
  const quiet = 4;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";

  matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) ctx.fillRect((colIndex + quiet) * scale, (rowIndex + quiet) * scale, scale, scale);
    });
  });
}

function updatePreview() {
  const order = readFormOrder();
  document.querySelector("#previewOrder").textContent = order.orderNumber || "DP-00001";
  document.querySelector("#previewName").textContent = order.customerName || "Nombre";
  document.querySelector("#previewPhone").textContent = order.phone || "Telefono";
  document.querySelector("#previewAddress").textContent = order.address || "Direccion completa";
  document.querySelector("#previewCity").textContent = [order.city, order.province].filter(Boolean).join(" / ") || "Ciudad / provincia";
  document.querySelector("#previewReference").textContent = order.reference || "Referencia";
  document.querySelector("#previewTotal").textContent = formatMoney(order.total);
  document.querySelector("#previewPayment").textContent = order.paymentMethod || "Pago contra entrega";
  document.querySelector("#previewNote").textContent = order.orderNote || "Sin observacion";

  const items = order.products.filter(item => item.product);
  document.querySelector("#previewItems").innerHTML = items.length
    ? items.map(item => `<p class="label-item">${escapeHtml(item.quantity)} x ${escapeHtml(item.product)} ${escapeHtml(item.size)} - ${formatMoney(item.subtotal)}</p>`).join("")
    : `<p class="label-item">Cantidad + producto + tamano</p>`;
  drawQrToCanvas(order.orderNumber || "DP-00001");
}

function renderHistory() {
  const nameQuery = searchByName.value.trim().toLowerCase();
  const phoneQuery = searchByPhone.value.trim().toLowerCase();
  const orderQuery = searchByOrder.value.trim().toLowerCase();
  const filtered = state.orders.filter(order => {
    const matchesName = !nameQuery || String(order.customerName || "").toLowerCase().includes(nameQuery);
    const matchesPhone = !phoneQuery || String(order.phone || "").toLowerCase().includes(phoneQuery);
    const matchesOrder = !orderQuery || String(order.orderNumber || "").toLowerCase().includes(orderQuery);
    return matchesName && matchesPhone && matchesOrder;
  });

  historyList.innerHTML = filtered.length ? "" : `<p class="empty-history">Sin pedidos guardados.</p>`;
  filtered.slice().reverse().forEach(order => {
    const item = document.createElement("div");
    item.className = "history-item";
    const products = (order.products || [])
      .filter(product => product.product)
      .map(product => `${product.quantity} x ${product.product} ${product.size}`)
      .join(", ");

    item.innerHTML = `
      <div class="history-main">
        <strong>${escapeHtml(order.orderNumber)} · ${escapeHtml(order.customerName || "Sin nombre")}</strong>
        <span>${escapeHtml(order.phone || "Sin telefono")} · ${formatMoney(order.total)}</span>
        <span>${escapeHtml(products || "Sin productos")}</span>
        <span>${new Date(order.createdAt).toLocaleString("es-DO")}</span>
      </div>
      <div class="history-actions">
        <button class="secondary-btn history-view" type="button" data-id="${order.id}">Ver pedido</button>
        <button class="primary-btn history-print" type="button" data-id="${order.id}">Reimprimir etiqueta</button>
      </div>
    `;
    historyList.appendChild(item);
  });
}

async function syncToGoogleSheets(order) {
  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    syncStatus.textContent = "Guardado localmente";
    return;
  }

  syncStatus.textContent = "Enviando a Google Sheets...";
  try {
    await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(order)
    });
    syncStatus.textContent = "Guardado en Sheets";
  } catch (error) {
    syncStatus.textContent = "Guardado local, Sheets pendiente";
  }
}

function upsertOrder(order) {
  if (isDuplicateOrderNumber(order)) {
    order.orderNumber = nextOrderNumber();
    document.querySelector("#orderNumber").value = order.orderNumber;
  }

  const existingIndex = state.orders.findIndex(saved => saved.id === order.id);
  if (existingIndex >= 0) {
    state.orders[existingIndex] = order;
  } else {
    state.orders.push(order);
  }
  state.currentOrder = order;
  saveOrders();
  renderHistory();
}

function loadOrder(order) {
  state.currentOrder = order;
  document.querySelector("#customerName").value = order.customerName || "";
  document.querySelector("#phone").value = order.phone || "";
  document.querySelector("#address").value = order.address || "";
  document.querySelector("#province").value = order.province || "";
  document.querySelector("#city").value = order.city || "";
  document.querySelector("#reference").value = order.reference || "";
  document.querySelector("#paymentMethod").value = order.paymentMethod || "Pago contra entrega";
  document.querySelector("#orderNote").value = order.orderNote || "";
  document.querySelector("#shippingCompany").value = order.shippingCompany || "";
  document.querySelector("#orderNumber").value = order.orderNumber || nextOrderNumber();
  productsList.innerHTML = "";
  (order.products || []).forEach(productRowTemplate);
  if (!order.products?.length) productRowTemplate();
  updateTotals();
}

function resetForm() {
  state.currentOrder = null;
  form.reset();
  document.querySelector("#orderNumber").value = nextOrderNumber();
  productsList.innerHTML = "";
  productRowTemplate();
  updateTotals();
  syncStatus.textContent = GOOGLE_SHEETS_WEB_APP_URL ? "Sheets configurado" : "Historial local activo";
}

function pdfEscape(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfText(text, maxChars = 43) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function safeFilePart(value) {
  return String(value || "pedido").replace(/[^a-z0-9-]/gi, "");
}

function generatePdf() {
  const order = readFormOrder();
  const commands = [];
  let y = 405;
  const qrMatrix = makeQrMatrix(order.orderNumber || "DP-00001");

  const text = (value, x, size = 10, font = "F1") => {
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
  };

  const centered = (value, size = 14, font = "F2") => {
    const estimatedWidth = String(value).length * size * 0.27;
    text(value, Math.max(18, 144 - estimatedWidth), size, font);
  };

  const line = yPosition => {
    commands.push(`0.8 w 18 ${yPosition} m 270 ${yPosition} l S`);
  };

  const qr = (matrix, x, bottom, width) => {
    const moduleSize = width / 29;
    commands.push(`1 1 1 rg ${x} ${bottom} ${width} ${width} re f`);
    commands.push(`0 0 0 rg`);
    matrix.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) return;
        const px = x + (colIndex + 4) * moduleSize;
        const py = bottom + width - (rowIndex + 5) * moduleSize;
        commands.push(`${px.toFixed(2)} ${py.toFixed(2)} ${moduleSize.toFixed(2)} ${moduleSize.toFixed(2)} re f`);
      });
    });
    commands.push(`0 0 0 RG 0.8 w ${x} ${bottom} ${width} ${width} re S`);
  };

  const block = (title, lines) => {
    y -= 20;
    text(title, 22, 10, "F2");
    y -= 14;
    lines.filter(Boolean).forEach(item => {
      wrapPdfText(item).forEach(wrapped => {
        text(wrapped, 22, 10, "F1");
        y -= 13;
      });
    });
    line(y + 4);
  };

  commands.push("1 1 1 rg 0 0 288 432 re f");
  commands.push("0 0 0 RG 0 0 0 rg 2 w 10 10 268 412 re S");
  commands.push("2 w 22 374 42 42 re S");
  commands.push("BT /F2 18 Tf 31 391 Td (DP) Tj ET");
  commands.push("BT /F2 16 Tf 76 399 Td (DON PERFUMES RD) Tj ET");
  commands.push(`BT /F2 12 Tf 76 379 Td (PEDIDO ${pdfEscape(order.orderNumber)}) Tj ET`);
  y = 364;
  line(y);

  block("Cliente:", [order.customerName, order.phone]);
  block("Direccion:", [order.address, [order.city, order.province].filter(Boolean).join(" / "), order.reference]);
  block("Pedido:", order.products.map(item => `${item.quantity} x ${item.product} ${item.size} - ${formatMoney(item.subtotal)}`));

  y -= 12;
  commands.push(`2 w 28 ${y - 42} 232 48 re S`);
  y -= 18;
  centered("Total a cobrar:", 11, "F2");
  y -= 20;
  centered(formatMoney(order.total), 18, "F2");
  y -= 20;

  y -= 12;
  text("Metodo de pago:", 22, 10, "F2");
  y -= 14;
  text(order.paymentMethod || "Pago contra entrega", 22, 10, "F1");
  y -= 18;
  text("Nota:", 22, 10, "F2");
  y -= 14;
  wrapPdfText(order.orderNote || "Sin observacion", 26).forEach(lineText => {
    text(lineText, 22, 9, "F1");
    y -= 12;
  });
  qr(qrMatrix, 190, 24, 74);
  commands.push(`BT /F2 7 Tf 207 15 Td (QR PEDIDO) Tj ET`);

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 288 432] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Don-Perfumes-RD-${safeFilePart(order.orderNumber)}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function buildWhatsappMessage(order) {
  const products = order.products
    .filter(item => item.product)
    .map(item => `- ${item.quantity} x ${item.product} ${item.size} (${formatMoney(item.subtotal)})`)
    .join("\n");

  return [
    "Pedido Don Perfumes RD",
    "",
    `Cliente: ${order.customerName || "Sin nombre"}`,
    `Telefono: ${order.phone || "Sin telefono"}`,
    `Direccion: ${order.address || "Sin direccion"}`,
    `Ciudad/Provincia: ${[order.city, order.province].filter(Boolean).join(" / ") || "Sin ciudad/provincia"}`,
    order.reference ? `Referencia: ${order.reference}` : "",
    "",
    "Productos:",
    products || "- Sin productos",
    "",
    `Total: ${formatMoney(order.total)}`
  ].filter(line => line !== "").join("\n");
}

function sendToWhatsapp() {
  const order = readFormOrder();
  const message = buildWhatsappMessage(order);
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

catalogForm.addEventListener("submit", event => {
  event.preventDefault();
  const nextProduct = getCatalogFormData();
  const existingIndex = state.catalog.findIndex(product => product.id === nextProduct.id);

  if (existingIndex >= 0) {
    nextProduct.active = state.catalog[existingIndex].active !== false;
    state.catalog[existingIndex] = nextProduct;
  } else {
    state.catalog.push(nextProduct);
  }

  saveCatalog();
  resetCatalogForm();
  renderCatalog();
  refreshOrderProductOptions();
});

importCatalogForm.addEventListener("submit", async event => {
  event.preventDefault();
  const url = catalogCsvUrl.value.trim();
  let csv = catalogCsvText.value.trim();

  importStatus.textContent = "Importando productos...";

  try {
    if (!csv && url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error("No se pudo leer la hoja.");
      csv = await response.text();
    }

    if (!csv) {
      importStatus.textContent = "Pega una URL CSV o el contenido CSV para importar.";
      return;
    }

    const products = productsFromCsv(csv);
    if (!products.length) {
      importStatus.textContent = "No se encontraron productos validos. Revisa los encabezados.";
      return;
    }

    const result = importCatalogProducts(products);
    importStatus.textContent = `Importacion lista: ${result.created} nuevos, ${result.updated} actualizados.`;
    catalogCsvText.value = "";
  } catch (error) {
    importStatus.textContent = "No se pudo importar desde la URL. Prueba pegando el CSV en el campo de texto.";
  }
});

catalogList.addEventListener("click", event => {
  const id = event.target.dataset.id;
  if (!id) return;

  const product = findCatalogProduct(id);
  if (!product) return;

  if (event.target.classList.contains("edit-catalog")) {
    document.querySelector("#catalogProductId").value = product.id;
    document.querySelector("#catalogProductName").value = product.name;
    document.querySelector("#price5ml").value = product.prices["5ml"];
    document.querySelector("#price15ml").value = product.prices["15ml"];
    document.querySelector("#price60ml").value = product.prices["60ml"];
    document.querySelector("#price120ml").value = product.prices["120ml"];
    document.querySelector("#saveCatalogBtn").textContent = "Actualizar producto";
  }

  if (event.target.classList.contains("toggle-catalog")) {
    product.active = product.active === false;
    saveCatalog();
    renderCatalog();
    refreshOrderProductOptions();
  }

  if (event.target.classList.contains("delete-catalog")) {
    state.catalog = state.catalog.filter(item => item.id !== id);
    saveCatalog();
    renderCatalog();
    refreshOrderProductOptions();
  }
});

productsList.addEventListener("input", event => {
  const row = event.target.closest(".product-row");
  if (!row) return;
  updateRowPrice(row);
  updateTotals();
});

productsList.addEventListener("change", event => {
  const row = event.target.closest(".product-row");
  if (!row) return;
  updateRowPrice(row);
  updateTotals();
});

productsList.addEventListener("click", event => {
  if (!event.target.classList.contains("remove-btn")) return;
  if (document.querySelectorAll(".product-row").length === 1) return;
  event.target.closest(".product-row").remove();
  updateTotals();
});

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);

form.addEventListener("submit", async event => {
  event.preventDefault();
  const order = readFormOrder();
  upsertOrder(order);
  updatePreview();
  await syncToGoogleSheets(order);
  generatePdf();
});

addProductBtn.addEventListener("click", () => productRowTemplate());
newOrderBtn.addEventListener("click", resetForm);
downloadPdfBtn.addEventListener("click", generatePdf);
sendWhatsappBtn.addEventListener("click", sendToWhatsapp);
printBtn.addEventListener("click", () => window.print());
[searchByName, searchByPhone, searchByOrder].forEach(input => {
  input.addEventListener("input", renderHistory);
});
cancelCatalogEditBtn.addEventListener("click", resetCatalogForm);

historyList.addEventListener("click", event => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  const order = state.orders.find(saved => saved.id === button.dataset.id);
  if (!order) return;

  loadOrder(order);

  if (button.classList.contains("history-print")) {
    setTimeout(() => window.print(), 50);
  }
});

renderCatalog();
resetForm();
renderHistory();
