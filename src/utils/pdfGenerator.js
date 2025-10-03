const PDFDocument = require('pdfkit');

const generateInvoicePdf = (invoice) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('error', reject);

    doc.on('data', buffers.push.bind(buffers));

    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    const amount = parseFloat(invoice.amount) || 0;
    const taxAmount = parseFloat(invoice.tax_amount) || 0;
    const totalAmount = parseFloat(invoice.total_amount) || 0;

    doc.fontSize(25).fillColor('#2c3e50').text('INVOICE', 50, 60);

    doc.fontSize(10).fillColor('#34495e')
      .text('Super SaaS Billing', 50, 65, { align: 'right' })
      .text('123 SaaS Lane, Cloud City, SA 90210', 50, 80, { align: 'right' })
      .text('billing@supersaas.com', 50, 95, { align: 'right' });

    doc.fillColor('#34495e').rect(50, 130, 510, 80).fillOpacity(0.05).fill().fillOpacity(1);

    doc.fontSize(10).fillColor('#34495e');

    doc.text('Invoice #:', 350, 140, { continued: true })
      .fillColor('#2c3e50').text(`  ${invoice.invoice_number}`, { align: 'left' });

    doc.fillColor('#34495e').text('Date:', 350, 155, { continued: true })
      .fillColor('#2c3e50').text(`  ${new Date(invoice.created_at).toLocaleDateString()}`, { align: 'left' });

    doc.fillColor('#34495e').text('Due Date:', 350, 170, { continued: true })
      .fillColor('#c0392b').text(`  ${new Date(invoice.due_date).toLocaleDateString()}`, { align: 'left' });

    doc.fillColor('#34495e').text('Status:', 350, 185, { continued: true })
      .fillColor('#27ae60').text(`  ${invoice.status.toUpperCase()}`, { align: 'left' });

    doc.fontSize(10).fillColor('#34495e').text('Billed To:', 50, 140)
      .fillColor('#2c3e50').text(invoice.company_name, 50, 155, { width: 280 })
      .text(invoice.billing_address || 'Address Not Provided', 50, 170, { width: 280 })
      .text(invoice.billing_email, 50, 185, { width: 280 });

    const tableTop = 250;
    const descX = 50;
    const packageX = 320;
    const amountX = 450;

    doc.fillColor('#2c3e50').rect(50, tableTop, 510, 20).fill('#ecf0f1');
    doc.fontSize(10).fillColor('#2c3e50').font('Helvetica-Bold')
      .text('DESCRIPTION', descX + 5, tableTop + 5, { width: 250 })
      .text('PACKAGE', packageX, tableTop + 5, { width: 110 })
      .text('AMOUNT', amountX, tableTop + 5, { width: 110, align: 'right' });

    const rowY = tableTop + 30;
    doc.font('Helvetica').fillColor('#34495e')
      .text(`Subscription Fee for period: ${new Date(invoice.billing_period_start).toLocaleDateString()} to ${new Date(invoice.billing_period_end).toLocaleDateString()}`,
        descX + 5, rowY, { width: 250 })
      .text(invoice.package_name, packageX, rowY, { width: 110 })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, amountX, rowY, { width: 110, align: 'right' });

    const totalY = rowY + 60;
    const labelX = 380;
    const valueX = 480;

    doc.font('Helvetica').fillColor('#34495e')
      .text('Subtotal:', labelX, totalY, { width: 80 })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, valueX, totalY, { width: 80, align: 'right' });

    doc.text('Tax (0.0%):', labelX, totalY + 15, { width: 80 })
      .text(`${invoice.currency} ${taxAmount.toFixed(2)}`, valueX, totalY + 15, { width: 80, align: 'right' });

    doc.strokeColor('#34495e').lineWidth(0.5)
      .moveTo(labelX, totalY + 35)
      .lineTo(560, totalY + 35)
      .stroke();

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('TOTAL DUE:', labelX, totalY + 45, { width: 80 })
      .text(`${invoice.currency} ${totalAmount.toFixed(2)}`, valueX, totalY + 45, { width: 80, align: 'right' });

    doc.fontSize(10).font('Helvetica').fillColor('#888')
      .text('Thank you for your business. Please remit payment by the due date.', 50, 750, { width: 510, align: 'center' })
      .text('Contact us at billing@supersaas.com for payment inquiries.', 50, 765, { width: 510, align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePdf };