require('dotenv').config();

const useWindowsAuth = (process.env.DB_AUTH || 'sql').toLowerCase() === 'windows';
const sql = useWindowsAuth ? require('mssql/msnodesqlv8') : require('mssql');
const server = process.env.DB_SERVER || 'localhost';
const port = Number(process.env.DB_PORT || 1433);
const database = process.env.DB_NAME || 'AgendaStyle';

const config = useWindowsAuth ? {
  server,
  port,
  database,
  driver: 'msnodesqlv8',
  connectionString: [
    `Driver={${process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
    `Server=${server}`,
    `Database=${database}`,
    'Trusted_Connection=Yes',
    `Encrypt=${process.env.DB_ENCRYPT === 'true' ? 'Yes' : 'No'}`,
    'TrustServerCertificate=Yes'
  ].join(';'),
  options: {
    trustedConnection: true,
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
} : {
  server,
  port,
  database,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

function getConnection() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

module.exports = { sql, getConnection };
