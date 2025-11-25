const fs = require('fs');

const generateLeads = (count) => {
  const headers = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "status",
    "lead_source",
    "assigned_to_email"
  ];

  let csvContent = headers.join(',') + '\n';

  const firstNames = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Rohit", "Kritika", "Saurabh", "Manish"];
  const lastNames = ["Sharma", "Mehta", "Verma", "Kapoor", "Singh", "Gupta", "Chopra", "Aggarwal", "Jain", "Kumar"];
  const locations = ["Connaught Place Delhi", "Bandra West Mumbai", "Laxmi Nagar Delhi", "Salt Lake Kolkata"];
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "protonmail.com", "testmail.io", "mailinator.com"];

  // Multiple staff emails (you can add more)
  const staffEmails = [
    "ujjwaltiwari05032004@gmail.com",
    "staff.member1@example.com",
    "sales.team01@company.com",
    "support.lead@company.com",
    "manager.operations@gmail.com",
    "growth.team@startup.com",
    "lead.coordinator@example.com"
  ];

  const STATUS = "New Lead";
  const LEAD_SOURCE = "instagram";

  for (let i = 1; i <= count; i++) {

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];

    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${randomNum}@${domain}`;

    const phone = `98765${String(100000 + i).slice(-5)}`;
    const address = locations[Math.floor(Math.random() * locations.length)];

    // Random assigned staff
    const assignedTo = staffEmails[Math.floor(Math.random() * staffEmails.length)];

    csvContent += `${firstName},${lastName},${email},${phone},"${address}",${STATUS},${LEAD_SOURCE},${assignedTo}\n`;
  }

  fs.writeFileSync('leads_random_unique_with_staff.csv', csvContent, 'utf8');
  console.log(`Generated leads_random_unique_with_staff.csv with ${count} rows.`);
};

generateLeads(9900);
