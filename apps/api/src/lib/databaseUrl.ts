export interface DatabaseConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const MYSQL_DEFAULT_PORT = 3306;

/**
 * Split a mysql:// URL into connection options. Percent-encoding in the user and password is
 * decoded. Errors never include the URL, because it carries the password.
 */
export const parseDatabaseUrl = (databaseUrl: string): DatabaseConnection => {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql:// scheme');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (url.hostname === '' || database === '') {
    throw new Error('DATABASE_URL must include a host and a database name');
  }
  return {
    host: url.hostname,
    port: url.port === '' ? MYSQL_DEFAULT_PORT : Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
};
