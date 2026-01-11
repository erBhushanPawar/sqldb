const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('Testing connection to RDS...');

    const connection = await mysql.createConnection({
      host: 'qa-she-careers-mariadb.c9ott5sa9myf.us-east-2.rds.amazonaws.com',
      port: 3306,
      user: 'admin',
      password: 'Qx7tV2pW5sR9uY1zA4bC6dE8fG3hJ0kL_mN-pQ8sR1tU4vW',
      database: 'dev_she_careers_bhushan',
      connectTimeout: 10000,
    });

    console.log('✅ Connected successfully!');

    const [rows] = await connection.query('SELECT DATABASE() as db, NOW() as time');
    console.log('Database:', rows[0].db);
    console.log('Server time:', rows[0].time);

    await connection.end();
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testConnection();
