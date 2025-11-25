const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

const bulkUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return next(err);
    }
    if (!req.file) {
      return next(new Error("No file uploaded."));
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const leadsToCreate = [];
    const processingErrors = [];

    try {
      if (fileExtension === '.csv') {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            const firstName = row['First Name']?.trim() || row['first_name']?.trim();
            const lastName = row['Last Name']?.trim() || row['last_name']?.trim();
            const email = (row['Email']?.trim() || row['email']?.trim())?.toLowerCase();
            const phone = row['Phone']?.trim() || row['phone']?.trim();
            const companyName = row['Company Name']?.trim() || row['company_name']?.trim() || null;
            const jobTitle = row['Job Title']?.trim() || row['job_title']?.trim() || null;
            const address = row['Address']?.trim() || row['address']?.trim() || null;
            const statusName = row['Status']?.trim() || row['status']?.trim() || null;
            const sourceName = row['Lead Source']?.trim() || row['lead_source']?.trim() || null;
            const assignedToEmail = row['Assigned To Email']?.trim() || row['assigned_to_email']?.trim() || null;

            if (!firstName || !lastName || (!email && !phone)) {
              processingErrors.push(`Row missing required data (First Name, Last Name, Email, or Phone).`);
              return;
            }

            leadsToCreate.push({
              first_name: firstName,
              last_name: lastName,
              email: email,
              phone: phone,
              company_name: companyName,
              job_title: jobTitle,
              address: address,
              status_name: statusName,
              source_name: sourceName,
              assigned_to_email: assignedToEmail
            });
          })
          .on('end', async () => {
            fs.unlinkSync(filePath);
            req.leadsToCreate = leadsToCreate;
            req.processingErrors = processingErrors;
            next();
          });
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            return;
          }

          const rowData = row.values;
          const lead = {
            first_name: rowData[1]?.trim(),
            last_name: rowData[2]?.trim(),
            email: rowData[3]?.trim().toLowerCase(),
            phone: rowData[4]?.trim(),
            address: rowData[5]?.trim() || null,
            status_name: rowData[6]?.trim() || null,
            source_name: rowData[7]?.trim() || null,
            assigned_to_email: rowData[8]?.trim() || null
          };

          if (!lead.first_name || !lead.last_name || (!lead.email && !lead.phone)) {
            processingErrors.push(`Row ${rowNumber} missing required data.`);
            return;
          }
          leadsToCreate.push(lead);
        });

        fs.unlinkSync(filePath);
        req.leadsToCreate = leadsToCreate;
        req.processingErrors = processingErrors;
        next();
      } else {
        fs.unlinkSync(filePath);
        return next(new Error("Unsupported file type. Please upload a CSV or Excel file."));
      }
    } catch (parseError) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return next(parseError);
    }
  });
};

module.exports = bulkUploadMiddleware;