const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const pool = require('./src/config/database');
const authRoutes = require('./src/routes/authRoutes');
const staffRoutes = require("./src/routes/staffRoutes");
const roleRoutes = require("./src/routes/roleRoutes");
const leadRoutes = require('./src/routes/leadsRoutes');
const leadDistributionRoutes = require('./src/routes/leadDistributionRoutes');
const performanceRoutes = require('./src/routes/performanceRoutes');
const notificationRoutes = require('./src/routes/notificationsRoutes');
const loggingRoutes = require('./src/routes/loggingRoutes');
const superAdminAuthRoutes = require('./src/routes/super-admin-routes/authRoutes');
const superAdminCompanyRoutes = require('./src/routes/super-admin-routes/companyRoutes');
const superAdminSubscriptionRoutes = require('./src/routes/super-admin-routes/subscriptionRoutes');
const superAdminPaymentRoutes = require('./src/routes/super-admin-routes/paymentRoutes');
const superAdminInvoiceRoutes = require('./src/routes/super-admin-routes/invoiceRoutes');
const superAdminnotificationRoutes = require('./src/routes/super-admin-routes/notificationRoutes');
const superAdminLoggingRoutes = require('./src/routes/super-admin-routes/loggingRoutes');
const swaggerDocs = require('./src/config/swagger');
const { startOtpCleanupJob } = require('./src/jobs/otpCleanup');
const { startSubscriptionCron } = require('./src/jobs/subscriptionExpiry');
const { globalLogActivity, logError } = require('./src/middleware/loggingMiddleware');
const { startNotificationCron } = require('./src/utils/notificationCron');
const { attachTimezone, attachTimezoneForSuperAdmin } = require('./src/middleware/timezoneMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "https://hp-biz-frontend.vercel.app",
  "https://hp-biz-backend-production-46ce.up.railway.app",
  "https://hp-biz-frontend-9caj6r6yq-ujjwals-projects-44afb61b.vercel.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-device-timezone"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


swaggerDocs(app, PORT);

app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use(globalLogActivity);

app.use('/api/v1/auth', attachTimezone, authRoutes);
app.use('/api/v1/staff', attachTimezone, staffRoutes);
app.use('/api/v1/roles', attachTimezone, roleRoutes);
app.use('/api/v1/leads', attachTimezone, leadRoutes);
app.use('/api/v1/leadsDistribution', attachTimezone, leadDistributionRoutes);
app.use('/api/v1/performance', attachTimezone, performanceRoutes);
app.use('/api/v1/notifications', attachTimezone, notificationRoutes);
app.use('/api/v1/logs', attachTimezone, loggingRoutes);

app.use('/api/v1/super-admin/auth', attachTimezoneForSuperAdmin, superAdminAuthRoutes);
app.use('/api/v1/super-admin/companies', attachTimezoneForSuperAdmin, superAdminCompanyRoutes);
app.use('/api/v1/super-admin/subscriptions', attachTimezoneForSuperAdmin, superAdminSubscriptionRoutes);
app.use('/api/v1/super-admin/payments', attachTimezoneForSuperAdmin, superAdminPaymentRoutes);
app.use('/api/v1/super-admin/invoices', attachTimezoneForSuperAdmin, superAdminInvoiceRoutes);
app.use('/api/v1/super-admin/notifications', attachTimezoneForSuperAdmin, superAdminnotificationRoutes);
app.use('/api/v1/super-admin/logs', attachTimezoneForSuperAdmin, superAdminLoggingRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.use(logError);
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const startServer = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected at:', result.rows[0].now);
    startOtpCleanupJob();
    startNotificationCron();
    startSubscriptionCron();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

startServer();
