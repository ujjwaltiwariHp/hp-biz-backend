const fs = require('fs');

const generateLeads = (count) => {
  const headers = ["first_name", "last_name", "email", "phone", "address", "status_id", "lead_source_id", "assigned_to"];
  let csvContent = headers.join(',') + '\n';

  const firstNames = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Rohit", "Kritika", "Saurabh", "Manish"];
  const lastNames = ["Sharma", "Mehta", "Verma", "Kapoor", "Singh", "Gupta", "Chopra", "Aggarwal", "Jain", "Kumar"];
  const locations = ["Connaught Place Delhi", "Bandra West Mumbai", "Laxmi Nagar Delhi", "Salt Lake Kolkata"];
  const domains = ["examplecorp.in", "futurelabs.com", "globaltech.org"];

  const STATUS_ID = 3;
  const LEAD_SOURCE_ID = 10;
  const ASSIGNED_TO_ID = 42;

  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domains[i % domains.length]}`;
    const phone = `987654${String(10000 + i).slice(-5)}`;
    const address = locations[i % locations.length];

    csvContent += `${firstName},${lastName},${email},${phone},"${address}",${STATUS_ID},${LEAD_SOURCE_ID},${ASSIGNED_TO_ID}\n`;
  }

  fs.writeFileSync('leads_50000_optimized.csv', csvContent, 'utf8');
  console.log(`Generated leads_50000_optimized.csv with ${count} rows.`);
};

generateLeads(100000);