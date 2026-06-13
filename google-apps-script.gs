const ORDERS_SHEET = "Pedidos";
const PRODUCTS_SHEET = "Productos";
const INVENTORY_SHEET = "Inventario";
const INVENTORY_MOVEMENTS_SHEET = "MovimientosInventario";
const EXPENSES_SHEET = "Gastos";
const SALES_SHEET = "Ventas";
const SIZE_COSTS_SHEET = "CostosTamano";

function setup() {
  getSheet_(ORDERS_SHEET, orderHeaders_());
  getSheet_(PRODUCTS_SHEET, productHeaders_());
  getSheet_(INVENTORY_SHEET, inventoryHeaders_());
  getSheet_(INVENTORY_MOVEMENTS_SHEET, inventoryMovementHeaders_());
  getSheet_(EXPENSES_SHEET, expenseHeaders_());
  getSheet_(SALES_SHEET, saleHeaders_());
  getSheet_(SIZE_COSTS_SHEET, sizeCostHeaders_());
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
    catalog: readCatalog_(),
    inventory: readInventory_(),
    inventoryMovements: readInventoryMovements_(),
    expenses: readExpenses_(),
    sales: readSales_(),
    sizeCosts: readSizeCosts_()
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

  if (payload.resource === "inventory") {
    saveInventory_(payload.inventory || {}, payload.inventoryMovements || []);
    return { ok: true, resource: "inventory" };
  }

  if (payload.resource === "expenses") {
    saveExpenses_(payload.expenses || []);
    return { ok: true, resource: "expenses" };
  }

  if (payload.resource === "sale") {
    saveSale_(payload.sale);
    return { ok: true, resource: "sale" };
  }

  if (payload.resource === "sizeCosts") {
    saveSizeCosts_(payload.sizeCosts || {});
    return { ok: true, resource: "sizeCosts" };
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

function saveInventory_(inventory, movements) {
  const inventorySheet = getSheet_(INVENTORY_SHEET, inventoryHeaders_());
  inventorySheet.clearContents();
  inventorySheet.appendRow(inventoryHeaders_());

  Object.keys(inventory || {}).forEach(key => {
    const item = inventory[key];
    inventorySheet.appendRow([
      key,
      item.productId,
      item.size,
      Number(item.stock || 0),
      Number(item.min || 0),
      JSON.stringify(item)
    ]);
  });

  const movementSheet = getSheet_(INVENTORY_MOVEMENTS_SHEET, inventoryMovementHeaders_());
  movementSheet.clearContents();
  movementSheet.appendRow(inventoryMovementHeaders_());
  (movements || []).forEach(move => {
    movementSheet.appendRow([
      move.id,
      move.date,
      move.type,
      move.productId,
      move.product,
      move.size,
      Number(move.quantity || 0),
      Number(move.before || 0),
      Number(move.after || 0),
      move.orderNumber,
      move.note,
      JSON.stringify(move)
    ]);
  });
}

function saveExpenses_(expenses) {
  const sheet = getSheet_(EXPENSES_SHEET, expenseHeaders_());
  sheet.clearContents();
  sheet.appendRow(expenseHeaders_());

  (expenses || []).forEach(expense => {
    sheet.appendRow([
      expense.id,
      expense.date,
      expense.category,
      expense.description,
      Number(expense.amount || 0),
      JSON.stringify(expense)
    ]);
  });
}

function saveSizeCosts_(sizeCosts) {
  const sheet = getSheet_(SIZE_COSTS_SHEET, sizeCostHeaders_());
  sheet.clearContents();
  sheet.appendRow(sizeCostHeaders_());

  Object.keys(sizeCosts || {}).forEach(size => {
    const item = sizeCosts[size] || {};
    const total = Number(item.production || 0)
      + Number(item.bottle || 0)
      + Number(item.label || 0)
      + Number(item.packaging || 0)
      + Number(item.other || 0);
    sheet.appendRow([
      size,
      Number(item.production || 0),
      Number(item.bottle || 0),
      Number(item.label || 0),
      Number(item.packaging || 0),
      Number(item.other || 0),
      total,
      JSON.stringify(item)
    ]);
  });
}

function saveSale_(sale) {
  if (!sale || !sale.id) return;

  const sheet = getSheet_(SALES_SHEET, saleHeaders_());
  const row = findRowById_(sheet, sale.id);
  const values = [[
    sale.id,
    sale.orderId,
    sale.orderNumber,
    sale.date,
    sale.status,
    sale.customerName,
    Number(sale.total || 0),
    sale.paymentMethod,
    Number(sale.productionCost || 0),
    Number(sale.estimatedProfit || 0),
    JSON.stringify(sale.products || []),
    JSON.stringify(sale)
  ]];

  if (row) {
    sheet.getRange(row, 1, 1, values[0].length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
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

function readInventory_() {
  const sheet = getSheet_(INVENTORY_SHEET, inventoryHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const headers = values[0];
  const jsonIndex = headers.indexOf("JSON");
  const inventory = {};

  values.slice(1).forEach(row => {
    if (jsonIndex >= 0 && row[jsonIndex]) {
      try {
        inventory[row[0]] = JSON.parse(row[jsonIndex]);
        return;
      } catch (error) {}
    }
    inventory[row[0]] = {
      productId: row[1],
      size: row[2],
      stock: Number(row[3] || 0),
      min: Number(row[4] || 0)
    };
  });
  return inventory;
}

function readInventoryMovements_() {
  const sheet = getSheet_(INVENTORY_MOVEMENTS_SHEET, inventoryMovementHeaders_());
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
      date: row[1],
      type: row[2],
      productId: row[3],
      product: row[4],
      size: row[5],
      quantity: Number(row[6] || 0),
      before: Number(row[7] || 0),
      after: Number(row[8] || 0),
      orderNumber: row[9],
      note: row[10]
    };
  }).filter(item => item && item.id);
}

function readExpenses_() {
  const sheet = getSheet_(EXPENSES_SHEET, expenseHeaders_());
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
      date: row[1],
      category: row[2],
      description: row[3],
      amount: Number(row[4] || 0)
    };
  }).filter(item => item && item.id);
}

function readSizeCosts_() {
  const sheet = getSheet_(SIZE_COSTS_SHEET, sizeCostHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const headers = values[0];
  const jsonIndex = headers.indexOf("JSON");
  const result = {};

  values.slice(1).forEach(row => {
    const size = row[0];
    if (!size) return;
    if (jsonIndex >= 0 && row[jsonIndex]) {
      try {
        result[size] = JSON.parse(row[jsonIndex]);
        return;
      } catch (error) {}
    }
    result[size] = {
      size: size,
      production: Number(row[1] || 0),
      bottle: Number(row[2] || 0),
      label: Number(row[3] || 0),
      packaging: Number(row[4] || 0),
      other: Number(row[5] || 0)
    };
  });

  return result;
}

function readSales_() {
  const sheet = getSheet_(SALES_SHEET, saleHeaders_());
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
      orderId: row[1],
      orderNumber: row[2],
      date: row[3],
      status: row[4],
      customerName: row[5],
      total: Number(row[6] || 0),
      paymentMethod: row[7],
      productionCost: Number(row[8] || 0),
      estimatedProfit: Number(row[9] || 0),
      products: []
    };
  }).filter(item => item && item.id);
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

function inventoryHeaders_() {
  return [
    "ID",
    "Producto ID",
    "Tamano",
    "Stock actual",
    "Stock minimo",
    "JSON"
  ];
}

function inventoryMovementHeaders_() {
  return [
    "ID",
    "Fecha",
    "Tipo",
    "Producto ID",
    "Producto",
    "Tamano",
    "Cantidad",
    "Stock antes",
    "Stock despues",
    "Codigo pedido",
    "Nota",
    "JSON"
  ];
}

function expenseHeaders_() {
  return [
    "ID",
    "Fecha",
    "Categoria",
    "Descripcion",
    "Monto",
    "JSON"
  ];
}

function saleHeaders_() {
  return [
    "ID",
    "Pedido ID",
    "Numero de pedido",
    "Fecha",
    "Estado pedido",
    "Cliente",
    "Total",
    "Metodo de pago",
    "Costo produccion",
    "Ganancia estimada",
    "Productos JSON",
    "JSON"
  ];
}

function sizeCostHeaders_() {
  return [
    "Tamano",
    "Costo produccion",
    "Costo envase",
    "Costo etiqueta",
    "Costo empaque",
    "Otros costos",
    "Costo total",
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
