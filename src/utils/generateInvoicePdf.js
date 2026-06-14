import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY = {
  uen: 'UEN: 53522826X',
  address: 'BLK 459 YISHUN AVE 11',
  city: 'Singapore, 760459',
  phone: '+65 8905 5350',
  paynowId: 'JHEARIC',
}

const fmt = (n) => `$${(n || 0).toFixed(2)}`
const fmtDate = (d) => {
  const dt = d ? new Date(d) : new Date()
  return `${dt.getDate()}/${dt.getMonth() + 1}/${String(dt.getFullYear()).slice(2)}`
}

/**
 * Generate and download an invoice or receipt PDF.
 * @param {Array}  serviceRecords  — array of service record objects (with service_items, customers, vehicles)
 * @param {Object} opts            — { isReceipt: bool }
 */
export async function generateInvoicePdf(serviceRecords, opts = {}) {
  const { isReceipt = false } = opts
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const margin = 42

  // ── Company header (top-right) ─────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  const headerLines = [COMPANY.uen, COMPANY.address, COMPANY.city, COMPANY.phone]
  let hY = 26
  headerLines.forEach((line) => {
    doc.text(line, W - margin, hY, { align: 'right' })
    hY += 11
  })

  // ── INVOICE / RECEIPT title ────────────────────────────────────
  let y = 92
  doc.setFontSize(30)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 138)
  doc.text(isReceipt ? 'RECEIPT' : 'INVOICE', margin, y)

  y += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 0, 100)
  const today = new Date()
  doc.text(`${isReceipt ? 'Paid on' : 'Submitted on'} ${fmtDate(today)}`, margin, y)

  // ── Customer / Bike labels ─────────────────────────────────────
  y += 26
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Invoice for', margin, y)
  doc.text('Bike', W / 2, y)

  const firstRec = serviceRecords[0]
  const customer = firstRec?.customers?.name || ''
  const vehicle = firstRec?.vehicles
    ? `${firstRec.vehicles.make || ''} ${firstRec.vehicles.model || ''} (${firstRec.vehicles.plate_number || ''})`
    : ''

  y += 13
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(customer.toUpperCase(), margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(vehicle, W / 2, y)

  // ── Invoice # bar ──────────────────────────────────────────────
  y += 22
  doc.setFillColor(220, 230, 255)
  doc.rect(margin, y, W - margin * 2, 22, 'F')

  y += 9
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 138)
  doc.text('INVOICE #', margin + 4, y)
  doc.text('Invoice Date', W / 2, y)

  y += 12
  const serviceNums = serviceRecords.map(r => `KM-${String(r.service_number || 0).padStart(4, '0')}`)
  const invoiceLabel = serviceRecords.length === 1
    ? `INV-2026-${String(firstRec.service_number || 0).padStart(4, '0')}`
    : `INV-2026-${String(serviceRecords[0].service_number || 0).padStart(4, '0')} to ${String(serviceRecords[serviceRecords.length - 1].service_number || 0).padStart(4, '0')}`

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text(invoiceLabel, margin + 4, y)
  doc.text(fmtDate(today), W / 2, y)

  // ── Line items table ───────────────────────────────────────────
  y += 16

  const rows = []
  serviceRecords.forEach((rec) => {
    const svcNum = `KM-${String(rec.service_number || 0).padStart(4, '0')}`
    const items = rec.service_items || []
    items.forEach((item, idx) => {
      rows.push([
        svcNum,
        idx + 1,
        item.description || '',
        item.quantity ?? 1,
        fmt(item.unit_price),
        fmt(item.total_price),
      ])
    })
    if (items.length === 0) rows.push([svcNum, '', '', '', '', ''])
  })

  // Pad to at least 10 rows
  while (rows.length < 10) rows.push(['', '', '', '', '', ''])

  autoTable(doc, {
    startY: y,
    head: [['Service #', 'No', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE']],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      lineWidth: 0.5,
      lineColor: [180, 180, 180],
    },
    bodyStyles: {
      textColor: [40, 40, 40],
      lineWidth: 0.3,
      lineColor: [210, 210, 210],
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 62, halign: 'right' },
      5: { cellWidth: 66, halign: 'right' },
    },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Totals ─────────────────────────────────────────────────────
  const subtotal = serviceRecords.reduce((s, r) => s + (r.total_cost || 0), 0)
  const rightCol = W - margin

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Subtotal', rightCol - 70, y, { align: 'right' })
  doc.text(fmt(subtotal), rightCol, y, { align: 'right' })

  y += 13
  doc.text('Adjustments', rightCol - 70, y, { align: 'right' })

  // AMOUNT DUE bar
  y += 6
  doc.setFillColor(210, 225, 255)
  doc.rect(W / 2 + 10, y, W / 2 - margin - 10, 24, 'F')

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 58, 138)
  doc.text('AMOUNT DUE', W / 2 + 20, y + 6)

  doc.setFontSize(16)
  doc.setTextColor(190, 0, 100)
  doc.text(fmt(subtotal), rightCol, y + 7, { align: 'right' })

  // ── Notes / Mileage / Recommendations ─────────────────────────
  y += 34

  const notes = serviceRecords.map(r => r.remarks).filter(Boolean).join('; ')
  const mileage = serviceRecords.map(r => r.mileage).filter(Boolean).join(', ')
  const recText = serviceRecords.map(r => r.mechanic_recommendation).filter(Boolean).join('; ')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Notes: ${notes}`, margin, y)
  y += 13
  doc.text(`Current Mileage: ${mileage}`, margin, y)
  y += 13
  doc.text('Recommendations:', margin, y)

  // Recommendation box (right half)
  const boxX = W / 2
  const boxW = W / 2 - margin
  const boxH = 50
  doc.setDrawColor(170, 170, 170)
  doc.rect(boxX, y - 12, boxW, boxH)
  if (recText) {
    doc.setFontSize(7.5)
    const wrapped = doc.splitTextToSize(recText, boxW - 6)
    doc.text(wrapped, boxX + 4, y - 2)
  }

  // ── PayNow section ─────────────────────────────────────────────
  y += boxH + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(190, 0, 100)
  doc.text('PAY NOW WITH PAYNOW', margin, y)

  y += 13
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('Scan the QR code using your bank app to pay instantly.', margin, y)

  y += 8
  // Load QR image
  try {
    const response = await fetch('/paynow_qr.png')
    const blob = await response.blob()
    const qrDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    doc.addImage(qrDataUrl, 'PNG', margin, y, 62, 62)
  } catch {
    doc.setDrawColor(180, 0, 120)
    doc.rect(margin, y, 62, 62)
  }

  // PayNow ID text (centered to right of QR)
  const qrCenterX = margin + 62 + 80
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('PAYNOW ID', qrCenterX, y + 30, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(190, 0, 100)
  doc.text(COMPANY.paynowId, qrCenterX, y + 46, { align: 'center' })

  // ── PAID watermark (receipt only) ──────────────────────────────
  if (isReceipt) {
    doc.setFontSize(72)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 150, 60)
    doc.setGState(new doc.GState({ opacity: 0.1 }))
    doc.text('PAID', W / 2, 400, { align: 'center', angle: 35 })
    doc.setGState(new doc.GState({ opacity: 1.0 }))
  }

  // ── Footer ─────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(
    'NOTES: Kindly send the PayNow payment screenshot via WhatsApp once the transaction has been completed.',
    margin,
    pageH - 18
  )

  // ── Download ───────────────────────────────────────────────────
  const svcLabel = serviceNums.join('_')
  const dateStr = fmtDate(today).replace(/\//g, '')
  const filename = isReceipt
    ? `RECEIPT-${svcLabel}-${dateStr}.pdf`
    : `INVOICE-${svcLabel}-${dateStr}.pdf`

  doc.save(filename)
}
