require('dotenv').config();
const pool = require('./src/config/database');
const bcrypt = require('bcryptjs');

const ADMIN = {
  name: 'Primary Super Admin',
  email: 'ujjwal@gmail.com',
  password: 'Abc@12345'
};

const seedSuperAdmin = async () => {
  let client;

  try {
    client = await pool.connect();

    const checkQuery = 'SELECT COUNT(*) FROM super_admins';
    const { rows: adminCountRows } = await client.query(checkQuery);

    if (parseInt(adminCountRows[0].count) > 20) {
      console.log('\nSuper Admin already exists. Seeding skipped.');
      return;
    }

    const roleQuery = `SELECT id FROM super_admin_roles WHERE role_name = 'Super Admin'`;
    const { rows: roleRows } = await client.query(roleQuery);

    if (roleRows.length === 0) {
        console.error('\n Super Admin roles table is empty. Run 03_super_admin.sql migration first.');
        return;
    }

    const superAdminRoleId = roleRows[0].id;
    const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

    const insertQuery = `
      INSERT INTO super_admins (email, password_hash, name, super_admin_role_id, is_super_admin)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, email, name, is_super_admin
    `;

    const result = await client.query(insertQuery, [
      ADMIN.email,
      hashedPassword,
      ADMIN.name,
      superAdminRoleId
    ]);

    const newAdmin = result.rows[0];

    console.log('Role:', 'Super Admin (ID 1)');
    console.log('Email:', newAdmin.email);
    console.log('Password:', ADMIN.password);

  } catch (error) {
    console.error('Error during Super Admin seeding:', error.message);
    if (error.code === '42P01') {
         console.error('Database tables not found. Ensure migrations (01_render_schema.sql, 03_super_admin.sql) were run.');
    }
    process.exit(1);
  } finally {
    if (client) client.release();
  }
};

seedSuperAdmin();