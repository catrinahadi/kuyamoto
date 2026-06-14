import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY = 'KUYAMOTO Management System'
const fmtDate = () => new Date().toLocaleDateString('en-SG')

/**
 * Export any table to PDF using jspdf-autotable.
 * @param {string}   title    — page title (e.g. 'Service Records')
 * @param {string[]} headers  — column headers
 * @param {Array[]}  rows     — array of arrays matching headers
 * @param {string}   filename — without extension
 */
export function exportTableToPdf(title, headers, rows, filename) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: headers.length > 7 ? 'landscape' : 'portrait' })
  const W = doc.internal.pageSize.getWidth()

  // Header bar
  doc.setFillColor(30, 58, 138)
  doc.rect(0, 0, W, 40, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(COMPANY, 36, 25)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Exported: ${fmtDate()}`, W - 36, 25, { align: 'right' })

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 138)
  doc.text(title, 36, 65)

  doc.setDrawColor(30, 58, 138)
  doc.setLineWidth(0.5)
  doc.line(36, 70, W - 36, 70)

  autoTable(doc, {
    startY: 80,
    head: [headers],
    body: rows,
    margin: { left: 36, right: 36 },
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    didDrawPage: (data) => {
      // Footer on every page
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150, 150, 150)
      doc.text(
        `KUYAMOTO — ${title} — Page ${doc.internal.getNumberOfPages()}`,
        W / 2,
        pageH - 12,
        { align: 'center' }
      )
    },
  })

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Per-page helpers ──────────────────────────────────────────────

export function exportCustomersToPdf(customers) {
  const headers = ['Cust #', 'Name', 'Contact', 'Email', 'Social Media', 'Source', 'Vehicles', 'Plate Numbers']
  const rows = customers.map(c => [
    `CUST-${String(c.customer_number || 0).padStart(4, '0')}`,
    c.name || '',
    c.contact_number || '',
    c.email || '',
    c.social_media || '',
    c.source || '',
    (c.vehicles?.length ?? c['vehicles_count'] ?? 0) + ' vehicle(s)',
    (c.vehicles || []).map(v => v.plate_number).filter(Boolean).join(', '),
  ])
  exportTableToPdf('Customers', headers, rows, 'KUYAMOTO-Customers')
}

export function exportQuotationsToPdf(quotations) {
  const headers = ['Quot #', 'Date', 'Customer', 'Vehicle', 'Labor (S$)', 'Parts (S$)', 'Total (S$)', 'Status']
  const rows = quotations.map(q => [
    `QUOT-${String(q.quotation_number || 0).padStart(4, '0')}`,
    q.created_at ? new Date(q.created_at).toLocaleDateString('en-SG') : '',
    q.customers?.name || '',
    q.vehicles ? `${q.vehicles.make} ${q.vehicles.model} (${q.vehicles.plate_number})` : '',
    (q.estimated_labor_cost || 0).toFixed(2),
    (q.estimated_parts_cost || 0).toFixed(2),
    (q.total_estimated_cost || 0).toFixed(2),
    q.status || '',
  ])
  exportTableToPdf('Quotations', headers, rows, 'KUYAMOTO-Quotations')
}

export function exportInventoryToPdf(items) {
  const headers = ['Item Name', 'Category', 'Unit', 'In Stock', 'Min Level', 'Cost (S$)', 'Selling (S$)', 'Status']
  const rows = items.map(i => [
    i.item_name || '',
    i.category || '',
    i.unit || '',
    i.quantity_in_stock ?? 0,
    i.minimum_stock_level ?? 0,
    (i.cost_price || 0).toFixed(2),
    (i.selling_price || 0).toFixed(2),
    i.quantity_in_stock <= i.minimum_stock_level ? 'Low Stock'
      : i.quantity_in_stock <= i.minimum_stock_level * 1.5 ? 'Warning'
      : 'In Stock',
  ])
  exportTableToPdf('Inventory', headers, rows, 'KUYAMOTO-Inventory')
}

export function exportServicesToPdf(records) {
  const headers = ['Service #', 'Customer', 'Vehicle', 'Plate', 'Date', 'Mechanic', 'Labor (S$)', 'Parts (S$)', 'Total (S$)', 'Status']
  const rows = records.map(r => [
    `KM-${String(r.service_number || 0).padStart(4, '0')}`,
    r.customers?.name || '',
    r.vehicles ? `${r.vehicles.make} ${r.vehicles.model}` : '',
    r.vehicles?.plate_number || '',
    r.service_date ? new Date(r.service_date).toLocaleDateString('en-SG') : '',
    r.technician || '',
    (r.labor_cost || 0).toFixed(2),
    (r.parts_cost || 0).toFixed(2),
    (r.total_cost || 0).toFixed(2),
    r.status || '',
  ])
  exportTableToPdf('Service Records', headers, rows, 'KUYAMOTO-Services')
}

export function exportCatalogToPdf(services) {
  const headers = ['Service Name', 'Category', 'Duration', 'Base Price (S$)', 'Description']
  const rows = services.map(s => [
    s.name || s.service_name || '',
    s.category || '',
    s.estimated_duration || '',
    (s.base_price || 0).toFixed(2),
    s.description || '',
  ])
  exportTableToPdf('Service Catalog', headers, rows, 'KUYAMOTO-ServiceCatalog')
}
