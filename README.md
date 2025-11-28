# HP-Blizz CRM API

This is the backend API for the HP-Blizz CRM system, a powerful tool for managing leads, staff, and company operations. The system is divided into two main components: the main application for company-level users and a super admin panel for overall system management.

## Table of Contents

- [Features](#features)
  - [Main Application](#main-application)
  - [Super Admin Panel](#super-admin-panel)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

### Main Application

- **Authentication:** Secure JWT-based authentication for company users.
- **Staff Management:** Add, edit, and manage staff members.
- **Role Management:** Define roles and permissions for staff.
- **Lead Management:** Create, assign, and track leads.
- **Lead Distribution:** Automate the distribution of leads to staff.
- **Performance Tracking:** Monitor staff performance and lead conversion rates.
- **Notifications:** Real-time notifications for important events.
- **Logging:** Comprehensive logging of all system activities.

### Super Admin Panel

- **Authentication:** Separate, secure authentication for super admins.
- **Company Management:** Onboard new companies and manage existing ones.
- **Subscription Management:** Manage company subscriptions and billing cycles.
- **Payment Processing:** Handle payments and generate invoices.
- **System-wide Logging:** Access logs for all companies.
- **Notifications:** Send system-wide notifications.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens), bcrypt
- **API Documentation:** Swagger (OpenAPI)
- **File Uploads:** Multer
- **Scheduled Jobs:** node-cron
- **Email:** Nodemailer, Resend
- **Real-time Events:** Server-Sent Events (SSE)

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- PostgreSQL

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/hp-biz-backend-2.git
   cd hp-biz-backend-2
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up the database:**
   - Create a PostgreSQL database.
   - Run the SQL scripts in the `db/` directory in sequential order to set up the necessary tables and relationships.

4. **Configure environment variables:**
   - Create a `.env` file in the root directory.
   - Copy the contents of `.env.example` (if available) or add the necessary environment variables (see [Environment Variables](#environment-variables)).

## Running the Application

- **Development:**

  ```bash
  npm run dev
  ```

  This will start the server with Nodemon, which automatically restarts the application when file changes are detected.

- **Production:**

  ```bash
  npm start
  ```

  This will start the server in production mode.

## API Documentation

The API is documented using Swagger. Once the server is running, you can access the documentation at `http://localhost:3000/api-docs`.

## Environment Variables

You will need to create a `.env` file in the root of the project and add the following variables:

```ini
PORT=3000
DB_USER=your_db_user
DB_HOST=your_db_host
DB_DATABASE=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret
```

## Database Schema

The database schema is located in the `db/` directory. The SQL files are numbered to indicate the order in which they should be executed. The schema is designed to support a multi-tenant architecture, with separate data for each company.

## Project Structure

```bash
.
├── db/                  # Database schema files
├── src/
│   ├── config/          # Configuration files (database, swagger)
│   ├── controllers/     # Application logic
│   ├── jobs/            # Scheduled jobs
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # External services (email, etc.)
│   └── utils/           # Utility functions
├── .gitignore
├── package.json
├── README.md
└── server.js            # Main application entry point
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the ISC License.
