const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const swaggerDocs = require('./src/config/swagger');
const { startOtpCleanupJob } = require('./src/jobs/otpCleanup');
const { globalLogActivity } = require('./src/middleware/loggingMiddleware');
const { logError } = require('./src/middleware/loggingMiddleware');
const { startNotificationCron } = require('./src/utils/notificationCron');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://hp-biz-frontend-zykn-ujjwals-projects-44afb61b.vercel.app",
  "https://hp-biz-backend-2.onrender.com",
  "https://hp-biz-backend-production-46ce.up.railway.app",
  "https://hp-biz-frontend-production-zzzzzz.up.railway.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/leadsDistribution', leadDistributionRoutes);
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/logs', loggingRoutes);
app.use('/api/v1/super-admin/auth', superAdminAuthRoutes);
app.use('/api/v1/super-admin/companies', superAdminCompanyRoutes);
app.use('/api/v1/super-admin/subscriptions', superAdminSubscriptionRoutes);
app.use('/api/v1/super-admin/payments', superAdminPaymentRoutes);
app.use('/api/v1/super-admin/invoices', superAdminInvoiceRoutes);
app.use('/api/v1/super-admin/notifications', superAdminnotificationRoutes);


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.use(logError);
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

startServer();
