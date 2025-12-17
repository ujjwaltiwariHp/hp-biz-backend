const PDFDocument = require('pdfkit');

// --- Helper: Draw a Rounded KPI Card ---
const drawKpiCard = (doc, x, y, width, height, title, value, subtext = '', color = '#4E79A7') => {
  // Card Background with Shadow Effect (simulated by drawing gray rect first)
  doc.roundedRect(x + 2, y + 2, width, height, 5).fill('#e0e0e0'); // Shadow
  doc.roundedRect(x, y, width, height, 5).fill('#ffffff').stroke('#cccccc'); // Main Card

  // Title Strip
  doc.roundedRect(x, y, width, 25, 5).fill(color);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
     .text(title, x + 5, y + 7, { width: width - 10, align: 'center' });

  // Main Value
  doc.fillColor('#333333').fontSize(18).font('Helvetica-Bold')
     .text(value, x, y + 35, { width: width, align: 'center' });

  // Subtext
  if (subtext) {
    doc.fillColor('#666666').fontSize(8).font('Helvetica')
       .text(subtext, x, y + 60, { width: width, align: 'center' });
  }
};

// --- Helper: Draw a Simple Pie Chart ---
const drawPieChart = (doc, x, y, radius, data) => {
  let startAngle = 0;
  // Calculate total for percentages
  const total = data.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    doc.circle(x, y, radius).fill('#f0f0f0');
    doc.fillColor('#999999').fontSize(10).text('No Data', x - 20, y - 5);
    return;
  }

  data.forEach(slice => {
    if (slice.value > 0) {
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      doc.path(`M ${x} ${y} L ${x + radius * Math.cos(startAngle)} ${y + radius * Math.sin(startAngle)} A ${radius} ${radius} 0 ${sliceAngle > Math.PI ? 1 : 0} 1 ${x + radius * Math.cos(endAngle)} ${y + radius * Math.sin(endAngle)} Z`)
         .fill(slice.color);

      startAngle = endAngle;
    }
  });

  // Legend
  let legendY = y - radius + 10;
  const legendX = x + radius + 20;

  data.forEach(slice => {
    if (slice.value > 0) {
      doc.rect(legendX, legendY, 10, 10).fill(slice.color);
      doc.fillColor('#333333').fontSize(9).text(`${slice.label} (${Math.round((slice.value / total) * 100)}%)`, legendX + 15, legendY);
      legendY += 15;
    }
  });
};

// --- Helper: Draw a Horizontal Bar Chart ---
const drawHorizontalBarChart = (doc, x, y, width, height, data, maxVal) => {
  const barHeight = 20;
  const gap = 10;
  let currentY = y;

  data.forEach(item => {
    const barWidth = (item.value / maxVal) * (width - 100); // Leave space for labels

    // Label
    doc.fillColor('#333333').fontSize(9).text(item.label, x, currentY + 5, { width: 90, align: 'right' });

    // Bar
    doc.rect(x + 100, currentY, barWidth, barHeight).fill(item.color);

    // Value Label
    doc.fillColor('#333333').fontSize(9).text(item.value.toString(), x + 100 + barWidth + 5, currentY + 5);

    currentY += barHeight + gap;
  });
};

// --- Helper: Draw Timeline ---
const drawTimeline = (doc, x, y, events) => {
  let currentY = y;

  events.slice(0, 15).forEach((event, index) => { // Limit to 15 recent events for PDF fit
    if (currentY > 700) { // Simple pagination check
        doc.addPage();
        currentY = 50;
    }

    // Vertical Line
    if (index < events.length - 1) {
        doc.moveTo(x + 6, currentY + 6).lineTo(x + 6, currentY + 40).strokeColor('#dddddd').lineWidth(2).stroke();
    }

    // Dot
    doc.circle(x + 6, currentY + 6, 4).fill('#4E79A7');

    // Date
    doc.fillColor('#666666').fontSize(8).text(event.date, x + 20, currentY);

    // Action
    doc.fillColor('#333333').fontSize(10).text(event.action, x + 20, currentY + 12);

    currentY += 40;
  });
};

// --- Main Function: Generate Staff Report ---
const generateStaffReportPdf = (staffName, period, data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // --- Header ---
    doc.fontSize(20).fillColor('#333333').text('Staff Performance Report', { align: 'center' });
    doc.fontSize(12).fillColor('#666666').text(`Staff: ${staffName} | Period: ${period.start} to ${period.end}`, { align: 'center' });
    doc.moveDown(2);

    // --- Section 1: KPI Cards ---
    const startY = doc.y;
    drawKpiCard(doc, 50, startY, 120, 80, 'Total Leads', data.totalLeads, 'Assigned', '#4E79A7');
    drawKpiCard(doc, 190, startY, 120, 80, 'Conversion Rate', `${data.conversion_rate}%`, 'Success Ratio', '#28a745');
    drawKpiCard(doc, 330, startY, 120, 80, 'Revenue', `${data.total_deal_value}`, 'Total Deal Value', '#f39c12');
    drawKpiCard(doc, 470, startY, 120, 80, 'Active', data.worked_count, 'Worked Leads', '#17a2b8');

    doc.y = startY + 100; // Move cursor below cards

    // --- Section 2: Charts ---
    doc.moveDown();
    doc.fontSize(14).fillColor('#333333').text('Lead Status Distribution');
    doc.moveDown(0.5);

    // Prepare Data for Pie Chart
    const statusData = data.status_breakdown.map(s => ({
        label: s.status_name,
        value: parseInt(s.count),
        color: s.status_color || '#cccccc'
    }));

    drawPieChart(doc, 100, doc.y + 70, 60, statusData);

    // --- Section 3: Operational Stats Table ---
    const tableY = doc.y + 20; // Align with chart roughly
    const tableX = 300;

    doc.fontSize(14).fillColor('#333333').text('Activity Metrics', tableX, doc.y - 140); // Reset Y manual adjust
    const metricsY = doc.y + 10;

    const opsData = [
        { label: 'Calls Made', value: data.calls_made },
        { label: 'Emails Sent', value: data.emails_sent },
        { label: 'Meetings', value: data.meetings_held },
        { label: 'Follow-ups', value: data.followUps },
        { label: 'Transferred Out', value: data.transferred_out }
    ];

    let currentMetricY = metricsY;
    opsData.forEach(m => {
        doc.rect(tableX, currentMetricY, 200, 20).fill('#f9f9f9').stroke('#eeeeee');
        doc.fillColor('#333333').fontSize(10).text(m.label, tableX + 10, currentMetricY + 5);
        doc.fillColor('#333333').font('Helvetica-Bold').text(m.value.toString(), tableX + 150, currentMetricY + 5, { align: 'right' });
        currentMetricY += 25;
    });

    doc.moveDown(8);

    // --- Section 4: Recent Activity Timeline ---
    doc.addPage();
    doc.fontSize(16).text('Recent Activity Timeline');
    doc.moveDown();

    drawTimeline(doc, 50, doc.y, data.timeline);

    doc.end();
  });
};

// --- Main Function: Generate Company Report ---
const generateCompanyReportPdf = (companyName, period, data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // --- Header ---
    doc.fontSize(22).fillColor('#2c3e50').text(companyName, { align: 'center' });
    doc.fontSize(16).fillColor('#7f8c8d').text('Performance Report', { align: 'center' });
    doc.fontSize(10).text(`Period: ${period.start} - ${period.end}`, { align: 'center' });
    doc.moveDown(2);

    // --- Section 1: High Level Overview (4 Cards) ---
    const startY = doc.y;
    drawKpiCard(doc, 50, startY, 120, 80, 'Total Revenue', data.overview.total_revenue, '', '#27ae60');
    drawKpiCard(doc, 190, startY, 120, 80, 'Total Leads', data.overview.total_leads, '', '#2980b9');
    drawKpiCard(doc, 330, startY, 120, 80, 'Conversion', `${data.overview.conversion_rate}%`, 'Rate', '#8e44ad');
    drawKpiCard(doc, 470, startY, 120, 80, 'Active Staff', data.overview.active_staff_count, 'Users', '#e67e22');

    doc.y = startY + 100;

    // --- Section 2: Top Performers (Bar Chart) ---
    doc.moveDown();
    doc.fontSize(14).fillColor('#333333').text('Top 5 Performers (Revenue)');
    doc.moveDown(0.5);

    const performerData = data.top_performers.map(p => ({
        label: p.name.split(' ')[0], // First name only for space
        value: p.total_deal_value,
        color: '#3498db'
    }));

    // Find max value for scaling
    const maxRev = Math.max(...performerData.map(d => d.value)) || 1000;
    drawHorizontalBarChart(doc, 50, doc.y, 400, 150, performerData, maxRev);

    doc.moveDown(8);

    // --- Section 3: Funnel Status (Pie Chart) ---
    const funnelY = doc.y;
    doc.fontSize(14).text('Lead Status Distribution', 50, funnelY);

    const funnelData = data.funnel_status.map(s => ({
        label: s.status_name,
        value: parseInt(s.count),
        color: s.status_color
    }));

    drawPieChart(doc, 100, funnelY + 80, 70, funnelData);

    // --- Section 4: Lead Sources Table (Next to Pie) ---
    const sourceTableX = 300;
    let sourceTableY = funnelY + 30;

    doc.fontSize(12).text('Top Sources', sourceTableX, funnelY);

    // Header
    doc.rect(sourceTableX, sourceTableY, 200, 20).fill('#ecf0f1');
    doc.fillColor('#333333').fontSize(9).text('Source', sourceTableX + 10, sourceTableY + 5);
    doc.text('Leads', sourceTableX + 150, sourceTableY + 5);
    sourceTableY += 25;

    data.lead_sources.slice(0, 5).forEach(source => {
        doc.rect(sourceTableX, sourceTableY, 200, 20).stroke('#bdc3c7');
        doc.fillColor('#333333').text(source.source_name, sourceTableX + 10, sourceTableY + 5);
        doc.text(source.total_leads.toString(), sourceTableX + 150, sourceTableY + 5);
        sourceTableY += 20;
    });

    doc.end();
  });
};

module.exports = {
  generateStaffReportPdf,
  generateCompanyReportPdf
};