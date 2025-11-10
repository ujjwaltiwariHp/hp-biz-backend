const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');

// Helper function to fetch image buffer from a URL
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      return reject(new Error("URL is empty"));
    }
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        reject(new Error(`Failed to load QR code image, status code: ${res.statusCode}`));
      }
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const generateInvoicePdf = (invoice, billingSettings) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('error', reject);
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    // --- Data Extraction & Formatting ---
    const amount = parseFloat(invoice.amount) || 0;
    const taxAmount = parseFloat(invoice.tax_amount) || 0;
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const displayTaxRate = invoice.tax_rate_display || '0.00';

    // --- Static & Dynamic Issuer Info (Editable via Admin Panel) ---
    // The company name, address, and email are fetched from billingSettings or use your default branding.
    const ISSUER_NAME = 'Hanging Panda Pvt. Ltd.';
    const ISSUER_ADDRESS_LINE1 = 'B-64, B Block, Sector 63, Noida, Uttar Pradesh,';
    const ISSUER_ADDRESS_LINE2 = 'India, 201301';
    const ISSUER_EMAIL = billingSettings?.email || 'enquiry@hangingpanda.com';

    const QR_CODE_URL = billingSettings?.qr_code_image_url || null;
    const BANK_DETAILS = billingSettings?.bank_details || null;

    // Key Services from website screenshot for professional context
    const KEY_SERVICES = [
        'Mobile App Development', 'Software Development', 'Branding & Design',
        'Digital Marketing', 'Web Development', 'Cross-platform Development'
    ].join(' | ');


    // --- 1. HEADER & BRANDING ---
    const RED_ACCENT = '#d63031'; // Used for buttons on website screenshot
    const TEXT_PRIMARY = '#2c3e50'; // Dark/Black

    // Document Title
    doc.fontSize(28).fillColor(TEXT_PRIMARY).font('Helvetica-Bold').text('INVOICE', 50, 50, { align: 'right' });

    // Issuer Name & Contact
    doc.fontSize(16).fillColor(RED_ACCENT).text('HANGING PANDA', 50, 50); // Logo Placeholder - Name in Accent Color
    doc.fontSize(10).fillColor(TEXT_PRIMARY).font('Helvetica-Bold')
      .text(ISSUER_NAME, 50, 70);
    doc.font('Helvetica').fontSize(9)
      .text(ISSUER_ADDRESS_LINE1, 50, 85)
      .text(ISSUER_ADDRESS_LINE2, 50, 95)
      .text(`Email: ${ISSUER_EMAIL}`, 50, 105)
      .text(`Key Services: ${KEY_SERVICES}`, 50, 120, { width: 500 });

    // Line Separator
    doc.strokeColor(TEXT_PRIMARY).lineWidth(0.5).moveTo(50, 140).lineTo(560, 140).stroke();


    // --- 2. INVOICE AND BILLING DETAILS BLOCK ---
    const DETAIL_X = 350;
    let DETAIL_Y = 160;

    // Billing To
    doc.fontSize(10).fillColor(TEXT_PRIMARY).font('Helvetica-Bold').text('BILLED TO:', 50, DETAIL_Y);
    doc.font('Helvetica').fontSize(10)
      .text(invoice.company_name || 'N/A', 50, DETAIL_Y + 15)
      .text(invoice.billing_address || 'Address Not Provided', 50, DETAIL_Y + 30, { width: 280 })
      .text(invoice.billing_email || 'Email Not Provided', 50, DETAIL_Y + 45);

    // Invoice Details Column
    doc.fillColor(TEXT_PRIMARY).font('Helvetica-Bold').text('INVOICE NO:', DETAIL_X, DETAIL_Y, { width: 100 })
      .font('Helvetica').text(invoice.invoice_number, DETAIL_X + 80, DETAIL_Y);

    doc.font('Helvetica-Bold').text('INVOICE DATE:', DETAIL_X, DETAIL_Y + 15)
      .font('Helvetica').text(formatDate(invoice.created_at), DETAIL_X + 80, DETAIL_Y + 15);

    doc.font('Helvetica-Bold').text('DUE DATE:', DETAIL_X, DETAIL_Y + 30)
      .font('Helvetica').text(formatDate(invoice.due_date), DETAIL_X + 80, DETAIL_Y + 30);

    doc.font('Helvetica-Bold').text('STATUS:', DETAIL_X, DETAIL_Y + 45)
      .fillColor(invoice.status === 'paid' ? '#27ae60' : RED_ACCENT)
      .text(invoice.status.toUpperCase(), DETAIL_X + 80, DETAIL_Y + 45);

    // Reset color
    doc.fillColor(TEXT_PRIMARY);

    // --- 3. LINE ITEMS TABLE ---
    const TABLE_START_Y = 250;
    const COL_DESC_X = 50;
    const COL_PACKAGE_X = 350;
    const COL_AMOUNT_X = 480;

    // Header Row
    doc.rect(50, TABLE_START_Y, 510, 20).fill('#ecf0f1'); // Light Grey Background
    doc.fontSize(10).fillColor(TEXT_PRIMARY).font('Helvetica-Bold')
      .text('DESCRIPTION', COL_DESC_X + 5, TABLE_START_Y + 5, { width: 280 })
      .text('PACKAGE', COL_PACKAGE_X, TABLE_START_Y + 5, { width: 120, align: 'left' })
      .text('AMOUNT', COL_AMOUNT_X, TABLE_START_Y + 5, { width: 80, align: 'right' });

    // Data Row
    let dataRowY = TABLE_START_Y + 30;
    doc.font('Helvetica').fillColor('#34495e')
      .text(`Subscription Fee for period: ${formatDate(invoice.billing_period_start)} to ${formatDate(invoice.billing_period_end)}`,
        COL_DESC_X + 5, dataRowY, { width: 280 })
      .text(invoice.package_name, COL_PACKAGE_X, dataRowY, { width: 120, align: 'left' })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, COL_AMOUNT_X, dataRowY, { width: 80, align: 'right' });

    // --- 4. SUMMARY (Right Aligned) ---
    let summaryY = dataRowY + 50;
    const SUM_LABEL_X = 400;
    const SUM_VALUE_X = 480;

    // Subtotal
    doc.font('Helvetica').fillColor('#34495e').fontSize(10)
      .text('Subtotal:', SUM_LABEL_X, summaryY, { width: 80 })
      .text(`${invoice.currency} ${amount.toFixed(2)}`, SUM_VALUE_X, summaryY, { width: 80, align: 'right' });

    // Tax
    summaryY += 15;
    doc.text(`Tax (${displayTaxRate}%):`, SUM_LABEL_X, summaryY)
      .text(`${invoice.currency} ${taxAmount.toFixed(2)}`, SUM_VALUE_X, summaryY, { width: 80, align: 'right' });

    // Horizontal Rule above Total
    summaryY += 20;
    doc.strokeColor(TEXT_PRIMARY).lineWidth(1)
      .moveTo(SUM_LABEL_X - 10, summaryY)
      .lineTo(560, summaryY)
      .stroke();

    // Total Amount Due
    summaryY += 10;
    doc.fontSize(14).font('Helvetica-Bold').fillColor(RED_ACCENT)
      .text('TOTAL DUE:', SUM_LABEL_X - 20, summaryY, { width: 100 })
      .text(`${invoice.currency} ${totalAmount.toFixed(2)}`, SUM_VALUE_X, summaryY, { width: 80, align: 'right' });

    doc.fillColor(TEXT_PRIMARY); // Reset color for remaining text


    // --- 5. PAYMENT INSTRUCTIONS & QR CODE ---
    let paymentY = 650;
    const QR_CODE_SIZE = 100;
    const QR_CODE_X = 450;
    const QR_CODE_Y = 650;

    // Payment Instructions Header
    doc.fontSize(10).font('Helvetica-Bold').text('Payment Instructions', 50, paymentY);
    paymentY += 15;

    // Bank Details
    if (BANK_DETAILS) {
        doc.font('Helvetica').fontSize(9)
          .text(`Bank Name: ${BANK_DETAILS?.bank_name || 'N/A'}`, 50, paymentY)
          .text(`Account No: ${BANK_DETAILS?.account_number || 'N/A'}`, 50, paymentY + 10)
          .text(`IFSC Code: ${BANK_DETAILS?.ifsc_code || 'N/A'}`, 50, paymentY + 20);
    } else {
        doc.font('Helvetica').fontSize(9).text('Payment details are currently not configured.', 50, paymentY);
    }

    // QR Code Rendering Logic
    if (QR_CODE_URL) {
        try {
            const imageBuffer = await fetchImage(QR_CODE_URL); // Await the image fetch
            doc.image(imageBuffer, QR_CODE_X, QR_CODE_Y, { fit: [QR_CODE_SIZE, QR_CODE_SIZE] });

            // Label below QR code
            doc.fontSize(8).font('Helvetica-Bold').text('Scan to Pay', QR_CODE_X, QR_CODE_Y + QR_CODE_SIZE + 5, { width: QR_CODE_SIZE, align: 'center' });
        } catch (e) {
            console.error('Failed to embed QR code image:', e.message);
        }
    }


    // --- 6. FOOTER / CLOSING STATEMENT ---
    const FOOTER_Y = 780;
    doc.fontSize(8).fillColor('#666666').font('Helvetica-Oblique')
      .text("Thank you for your business. This invoice confirms your payment and subscription activation.",
            50, FOOTER_Y, { width: 510, align: 'center' })
      .text(`© ${new Date().getFullYear()} Hanging Panda Pvt. Ltd. | B-64, B Block, Sector 63, Noida`,
            50, FOOTER_Y + 15, { width: 510, align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePdf };