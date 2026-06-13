const ORDERS_SHEET = "Pedidos";
const PRODUCTS_SHEET = "Productos";

function setup() {
  getSheet_(ORDERS_SHEET, orderHeaders_());
  getSheet_(PRODUCTS_SHEET, productHeaders_());
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "write") {
    const payload = JSON.parse(e.parameter.payload || "{}");
    const result = handleWrite_(payload);
    return json_(result, e.parameter.callback);
  }

  const data = {
    ok: true,
    orders: readOrders_(),
    catalog: readCatalog_()
  };
  return json_(data, e && e.parameter && e.parameter.callback);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  return json_(handleWrite_(payload));
}

function handleWrite_(payload) {
  if (payload.resource === "catalog") {
    saveCatalog_(payload.catalog || []);
    return { ok: true, resource: "catalog" };
  }

  if (payload.resource === "order") {
    saveOrder_(payload.order);
    return { ok: true, resource: "order" };
  }

  if (payload.orderNumber) {
    saveOrder_(payload);
    return { ok: true, resource: "order" };
  }

  return { ok: false, error: "Recurso no reconocido" };
}

function saveOrder_(order) {
  if (!order || !order.id) return;

  const sheet = getSheet_(ORDERS_SHEET, orderHeaders_());
  const row = findRowById_(sheet, order.id);
  const productsText = (order.products || [])
    .map(item => `${item.quantity} x ${item.product} ${item.size} @ ${item.price}`)
    .join(" | ");
  const values = [[
    order.id,
    order.createdAt || new Date().toISOString(),
    order.status || "Pendiente",
    order.orderNumber,
    order.customerName,
    order.phone,
    order.address,
    order.province,
    order.city,
    order.reference,
    productsText,
    order.total,
    order.paymentMethod,
    order.orderNote,
    order.shippingCompany,
    JSON.stringify(order)
  ]];

  if (row) {
    sheet.getRange(row, 1, 1, values[0].length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function saveCatalog_(catalog) {
  const sheet = getSheet_(PRODUCTS_SHEET, productHeaders_());
  sheet.clearContents();
  sheet.appendRow(productHeaders_());

  (catalog || []).forEach(product => {
    sheet.appendRow([
      product.id,
      product.name,
      product.active === false ? "no" : "si",
      Number(product.prices && product.prices["5ml"] || 0),
      Number(product.prices && product.prices["15ml"] || 0),
      Number(product.prices && product.prices["60ml"] || 0),
      Number(product.prices && product.prices["120ml"] || 0),
      JSON.stringify(product)
    ]);
  });
}

function readOrders_() {
  const sheet = getSheet_(ORDERS_SHEET, orderHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const hasStatusColumn = headers.indexOf("Estado") >= 0;
  const jsonIndex = headers.indexOf("JSON");

  return values.slice(1).map(row => {
    if (jsonIndex >= 0 && row[jsonIndex]) {
      try {
        return JSON.parse(row[jsonIndex]);
      } catch (error) {}
    }
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (String(row[index] || "").trim().charAt(0) === "{") {
        try {
          return JSON.parse(row[index]);
        } catch (error) {}
      }
    }

    if (!hasStatusColumn) {
      return {
        id: row[0],
        createdAt: row[1],
        status: "Pendiente",
        orderNumber: row[2],
        customerName: row[3],
        phone: row[4],
        address: row[5],
        province: row[6],
        city: row[7],
        reference: row[8],
        products: [],
        total: Number(row[10] || 0),
        paymentMethod: row[11],
        orderNote: row[12],
        shippingCompany: row[13]
      };
    }

    return {
      id: row[0],
      createdAt: row[1],
      status: row[2] || "Pendiente",
      orderNumber: row[3],
      customerName: row[4],
      phone: row[5],
      address: row[6],
      province: row[7],
      city: row[8],
      reference: row[9],
      products: [],
      total: Number(row[11] || 0),
      paymentMethod: row[12],
      orderNote: row[13],
      shippingCompany: row[14]
    };
  }).filter(order => order && order.id);
}

function readCatalog_() {
  const sheet = getSheet_(PRODUCTS_SHEET, productHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const jsonIndex = headers.indexOf("JSON");

  return values.slice(1).map(row => {
    if (jsonIndex >= 0 && row[jsonIndex]) {
      try {
        return JSON.parse(row[jsonIndex]);
      } catch (error) {}
    }

    return {
      id: row[0],
      name: row[1],
      active: String(row[2]).toLowerCase() !== "no",
      prices: {
        "5ml": Number(row[3] || 0),
        "15ml": Number(row[4] || 0),
        "60ml": Number(row[5] || 0),
        "120ml": Number(row[6] || 0)
      }
    };
  }).filter(product => product && product.id && product.name);
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const width = Math.max(sheet.getLastColumn(), headers.length);
    const currentHeaders = sheet.getRange(1, 1, 1, width).getValues()[0];
    const needsHeaderUpdate = headers.some((header, index) => currentHeaders[index] !== header);
    if (needsHeaderUpdate) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  return sheet;
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index][0] === id) return index + 2;
  }
  return null;
}


function orderHeaders_() {
  return [
    "ID",
    "Fecha",
    "Estado",
    "Numero de pedido",
    "Cliente",
    "Telefono",
    "Direccion",
    "Provincia",
    "Ciudad / sector",
    "Referencia",
    "Productos",
    "Total",
    "Metodo de pago",
    "Nota",
    "Empresa de envio",
    "JSON"
  ];
}

function productHeaders_() {
  return [
    "ID",
    "Producto",
    "Activo",
    "5ml",
    "15ml",
    "60ml",
    "120ml",
    "JSON"
  ];
}

function json_(data, callback) {
  const output = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${output});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
