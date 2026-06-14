import * as XLSX from 'xlsx'

/**
 * Export data to an Excel .xlsx file.
 * @param {string}   filename   — without extension
 * @param {string[]} headers    — column headers
 * @param {Array[]}  rows       — array of arrays (must match headers order)
 * @param {string}   sheetName  — worksheet name (default 'Sheet1')
 */
export function exportToExcel(filename, headers, rows, sheetName = 'Sheet1') {
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto column widths
  const colWidths = headers.map((h, i) => ({
    wch: Math.max(
      h.length + 2,
      ...rows.map(r => String(r[i] ?? '').length + 2)
    ),
  }))
  ws['!cols'] = colWidths

  // Bold header row
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i })
    if (ws[cell]) {
      ws[cell].s = { font: { bold: true } }
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Export service records to Excel.
 */
export function exportServicesToExcel(records) {
  const headers = [
    'Service #', 'Quotation #', 'Customer', 'Vehicle', 'Plate',
    'Date', 'Mechanic', 'Mileage', 'Labor (S$)', 'Parts (S$)',
    'Total (S$)', 'Status',
  ]
  const rows = records.map(r => [
    `KM-${String(r.service_number || 0).padStart(4, '0')}`,
    r.quotations ? `QUOT-${String(r.quotations.quotation_number || 0).padStart(4, '0')}` : '',
    r.customers?.name || '',
    r.vehicles ? `${r.vehicles.make} ${r.vehicles.model}` : '',
    r.vehicles?.plate_number || '',
    r.service_date ? new Date(r.service_date).toLocaleDateString('en-SG') : '',
    r.technician || '',
    r.mileage || '',
    (r.labor_cost || 0).toFixed(2),
    (r.parts_cost || 0).toFixed(2),
    (r.total_cost || 0).toFixed(2),
    r.status || '',
  ])
  exportToExcel(`KUYAMOTO-Services-${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Services')
}

/**
 * Export inventory items to Excel.
 */
export function exportInventoryToExcel(items) {
  const headers = [
    'Item Name', 'Category', 'SKU', 'Unit',
    'In Stock', 'Min Level', 'Cost Price (S$)', 'Selling Price (S$)', 'Status',
  ]
  const rows = items.map(i => [
    i.item_name || '',
    i.category || '',
    i.sku || '',
    i.unit || '',
    i.quantity_in_stock ?? 0,
    i.minimum_stock_level ?? 0,
    (i.cost_price || 0).toFixed(2),
    (i.selling_price || 0).toFixed(2),
    i.quantity_in_stock <= i.minimum_stock_level ? 'Low Stock'
      : i.quantity_in_stock <= i.minimum_stock_level * 1.5 ? 'Warning'
      : 'In Stock',
  ])
  exportToExcel(`KUYAMOTO-Inventory-${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Inventory')
}

/**
 * Export customers to Excel.
 */
export function exportCustomersToExcel(customers) {
  const headers = ['Cust #', 'Name', 'Contact', 'Email', 'Social Media', 'Source', 'Vehicles', 'Plate Numbers']
  const rows = customers.map(c => [
    `CUST-${String(c.customer_number || 0).padStart(4, '0')}`,
    c.name || '',
    c.contact_number || '',
    c.email || '',
    c.social_media || '',
    c.source || '',
    (c.vehicles?.length ?? 0) + ' vehicle(s)',
    (c.vehicles || []).map(v => v.plate_number).filter(Boolean).join(', '),
  ])
  exportToExcel(`KUYAMOTO-Customers-${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Customers')
}

/**
 * Export quotations to Excel.
 */
export function exportQuotationsToExcel(quotations) {
  const headers = ['Quot #', 'Date', 'Customer', 'Vehicle', 'Plate', 'Labor (S$)', 'Parts (S$)', 'Total (S$)', 'Status']
  const rows = quotations.map(q => [
    `QUOT-${String(q.quotation_number || 0).padStart(4, '0')}`,
    q.created_at ? new Date(q.created_at).toLocaleDateString('en-SG') : '',
    q.customers?.name || '',
    q.vehicles ? `${q.vehicles.make} ${q.vehicles.model}` : '',
    q.vehicles?.plate_number || '',
    (q.estimated_labor_cost || 0).toFixed(2),
    (q.estimated_parts_cost || 0).toFixed(2),
    (q.total_estimated_cost || 0).toFixed(2),
    q.status || '',
  ])
  exportToExcel(`KUYAMOTO-Quotations-${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Quotations')
}

/**
 * Export service catalog to Excel.
 */
export function exportCatalogToExcel(services) {
  const headers = ['Service Name', 'Category', 'Duration', 'Base Price (S$)', 'Description']
  const rows = services.map(s => [
    s.name || s.service_name || '',
    s.category || '',
    s.estimated_duration || '',
    (s.base_price || 0).toFixed(2),
    s.description || '',
  ])
  exportToExcel(`KUYAMOTO-ServiceCatalog-${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Catalog')
}

