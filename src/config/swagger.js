const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HP-Blizz CRM API',
      version: '1.0.0',
      description: 'Complete API documentation for HP-Blizz CRM System',
    },
    servers: [
      {
        url: 'https://hp-biz-backend-2.onrender.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Company Authentication',
        description: 'Company authentication and account management endpoints'
      },
      {
        name: 'Staff',
        description: 'Staff management endpoints'
      },
      {
        name: 'Roles',
        description: 'Role management endpoints'
      },
      {
        name: 'Lead Sources',
        description: 'Leads Source management endpoints'
      },
      {
        name: 'Lead Statuses',
        description: 'Leads management endpoints'
      },
      {
        name: 'Leads CRUD',
        description: 'Leads management endpoints'
      },
      {
        name: 'Leads Search',
        description: 'Leads management endpoints'
      },
      {
        name: 'Leads Details',
        description: 'Leads management endpoints'
      },
      {
        name: 'Leads Followups',
        description: 'Leads management endpoints'
      },
      {
        name: 'LeadsDistribution',
        description: 'Leads distribution management endpoints'
      },
      {
        name: 'Performance',
        description: 'Performance management endpoints'
      },
      {
        name: 'Notifications',
        description: 'Notification management endpoints'
      },
      {
        name: 'Logging',
        description: 'System logging endpoints'
      },
      {
        name: 'Super Admin - Auth',
        description: 'Super admin authentication endpoints'
      },
      {
        name: 'Super Admin - Companies',
        description: 'Super admin company management endpoints'
      },
      {
        name: 'Super Admin - Subscriptions',
        description: 'Super admin subscription management endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/routes/super-admin-routes/*.js'
  ],
};

const specs = swaggerJsdoc(options);

const swaggerDocs = (app, port) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "HP-Blizz CRM API Documentation"
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

module.exports = swaggerDocs;