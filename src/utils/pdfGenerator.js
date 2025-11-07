const PDFDocument = require('pdfkit');

const generateInvoicePdf = (invoice, billingSettings) => {
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

    const formatDate = (date) => new Date(date).toLocaleDateString('en-GB');

    // --- Dynamic Seller/Issuer Information ---
    const sellerName = billingSettings?.company_name || 'HPBIZ Billing';
    const sellerAddress = billingSettings?.address || 'Address Not Provided';
    const sellerEmail = billingSettings?.email || 'billing@hpbiz.com';


    const bankDetails = billingSettings?.bank_details || null;

    const displayTaxRate = invoice.tax_rate_display || '0.00';


    doc.fontSize(25).fillColor('#2c3e50').text('INVOICE', 50, 60);

    // Use Dynamic Seller Info
    doc.fontSize(10).fillColor('#34495e')
      .text(sellerName, 50, 65, { align: 'right' })
      .text(sellerAddress, 50, 80, { align: 'right' })
      .text(sellerEmail, 50, 95, { align: 'right' });

    doc.fillColor('#34495e').rect(50, 130, 510, 80).fillOpacity(0.05).fill().fillOpacity(1);

    doc.fontSize(10).fillColor('#34495e');

    doc.text('Invoice #:', 350, 140, { continued: true })
      .fillColor('#2c3e50').text(`  ${invoice.invoice_number}`, { align: 'left' });

    doc.fillColor('#34495e').text('Date:', 350, 155, { continued: true })
      .fillColor('#2c3e50').text(`  ${formatDate(invoice.created_at)}`, { align: 'left' });

    doc.fillColor('#34495e').text('Due Date:', 350, 170, { continued: true })
      .fillColor('#c0392b').text(`  ${formatDate(invoice.due_date)}`, { align: 'left' });

    doc.fillColor('#34495e').text('Status:', 350, 185, { continued: true })
      .fillColor(invoice.status === 'paid' ? '#27ae60' : '#c0392b').text(`  ${invoice.status.toUpperCase()}`, { align: 'left' });

    doc.fontSize(10).fillColor('#34495e').text('Billed To:', 50, 140)
      .fillColor('#2c3e50').text(invoice.company_name, 50, 155, { width: 280 })
      .text(invoice.billing_address || 'Address Not Provided', 50, 170, { width: 280 })
      .text(invoice.billing_email, 50, 185, { width: 280 });

    let tableTop = 250;
    const descX = 50;
    const packageX = 320;
    const amountX = 450;

    doc.fillColor('#2c3e50').rect(50, tableTop, 510, 20).fill('#ecf0f1');
    doc.fontSize(10).fillColor('#2c3e50').font('Helvetica-Bold')
      .text('DESCRIPTION', descX + 5, tableTop + 5, { width: 250 })
      .text('PACKAGE', packageX, tableTop + 5, { width: 110 })
      .text('AMOUNT', amountX, tableTop + 5, { width: 110, align: 'right' });

    let rowY = tableTop + 30;
    doc.font('Helvetica').fillColor('#34495e')
      .text(`Subscription Fee for period: ${formatDate(invoice.billing_period_start)} to ${formatDate(invoice.billing_period_end)}`,
        descX + 5, rowY, { width: 250 })
      .text(invoice.package_name, packageX, rowY, { width: 110 })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, amountX, rowY, { width: 110, align: 'right' });

    rowY += 20;

    let featuresList = [];
    if (invoice.features) {
        if (typeof invoice.features === 'string') {
            try { featuresList = JSON.parse(invoice.features); } catch(e) {}
        } else if (Array.isArray(invoice.features)) {
            featuresList = invoice.features;
        }
    }

    if (featuresList && featuresList.length > 0) {
        doc.font('Helvetica-Oblique').fillColor('#555').fontSize(8)
           .text('Included Features:', descX + 5, rowY);

        rowY += 10;

        const featureNames = featuresList.map(f => f.replace(/_/g, ' ')).join(', ');

        doc.font('Helvetica').fillColor('#666').fontSize(8)
           .text(featureNames, descX + 5, rowY, { width: 250 });

        rowY += 20;
    }

    rowY += 10;
    const totalY = rowY;
    const labelX = 380;
    const valueX = 480;

    doc.font('Helvetica').fillColor('#34495e')
      .text('Subtotal:', labelX, totalY, { width: 80 })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, valueX, totalY, { width: 80, align: 'right' });

    // Use Dynamic Tax Rate Display
    doc.text(`Tax (${displayTaxRate}%):`, labelX, totalY + 15, { width: 80 })
      .text(`${invoice.currency} ${taxAmount.toFixed(2)}`, valueX, totalY + 15, { width: 80, align: 'right' });

    doc.strokeColor('#34495e').lineWidth(0.5)
      .moveTo(labelX, totalY + 35)
      .lineTo(560, totalY + 35)
      .stroke();

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50')
      .text('TOTAL PAID:', labelX, totalY + 45, { width: 80 })
      .text(`${invoice.currency} ${totalAmount.toFixed(2)}`, valueX, totalY + 45, { width: 80, align: 'right' });


    // --- Dynamic Payment Instructions ---
    let paymentY = 700;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2c3e50').text('Payment Instructions', 50, paymentY);
    paymentY += 15;

    if (bankDetails) {
        doc.font('Helvetica').fillColor('#34495e').fontSize(9)
          .text(`Bank Name: ${bankDetails?.bank_name || 'N/A'}`, 50, paymentY)
          .text(`Account No: ${bankDetails?.account_number || 'N/A'}`, 50, paymentY + 10)
          .text(`IFSC Code: ${bankDetails?.ifsc_code || 'N/A'}`, 50, paymentY + 20);
    } else {
        doc.font('Helvetica').fillColor('#34495e').fontSize(9)
          .text('Payment details are currently not configured.', 50, paymentY);
    }

    if (qrCodeUrl) {
       doc.text(`QR Code Link: ${qrCodeUrl}`, 300, paymentY);
    }
    // --- End Dynamic Payment Instructions ---


    doc.fontSize(10).font('Helvetica').fillColor('#888')
      .text('Thank you for your business. This invoice confirms your payment and subscription activation.', 50, 750, { width: 510, align: 'center' })
      .text(`Contact us at ${sellerEmail} for payment inquiries.`, 50, 765, { width: 510, align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePdf };