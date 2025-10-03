require('dotenv').config();
const pool = require('./src/config/database');
const bcrypt = require('bcryptjs');

const ADMIN = {
  name: 'Super Admin',
  email: 'admin@hpbiz.com',
  password: 'Admin@123456'
};

const seedSuperAdmin = async () => {
  let client;

  try {
    client = await pool.connect();

    const checkQuery = 'SELECT COUNT(*) FROM super_admins';
    const { rows } = await client.query(checkQuery);

    if (parseInt(rows[0].count) > 0) {
      console.log('Super admin already exists!');
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

    const insertQuery = `
      INSERT INTO super_admins (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at
    `;

    const result = await client.query(insertQuery, [
      ADMIN.email,
      hashedPassword,
      ADMIN.name
    ]);

    const newAdmin = result.rows[0];

    console.log('\n✅ Super Admin Created');
    console.log('Email:', newAdmin.email);
    console.log('Password:', ADMIN.password);
    console.log('Name:', newAdmin.name);
    console.log('\nLogin: POST /api/v1/super-admin/auth/login');
    console.log('DELETE this file after use!\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
};

seedSuperAdmin();