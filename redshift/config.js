// import pgp from "pg-promise";
const pgp = require('pg-promise')
const connections = [];

  var getConnection = function() {
    const dbName = process.env.REDSHIFT_DB_NAME;

// console.log("🚀 ~ file: config.js:9 ~ getConnection ~ connections[dbName]", connections[dbName])
      if (!connections[dbName]) {
    
      const dbUser = process.env.REDSHIFT_DB_USER;
      const dbPassword = process.env.REDSHIFT_DB_PASSWORD;
      const dbHost = process.env.REDSHIFT_DB_HOST;
      const dbPort = parseInt(process.env.REDSHIFT_DB_PORT);

      const dbc = pgp({ capSQL: true });
      // console.log(`🚀 ~ file: configg.js:18 Opening connection to: ${dbName}, host is: ${dbHost}`);

      const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
      connections[dbName] = dbc(connectionString);
      // console.log("🚀 ~ file: config.js:22 ~ getConnection ~ connections[dbName", connections[dbName])
      // console.log("🚀 ~ file: configg.js:27 ~ getConnection ~ connectionString", connectionString)
    }
    return connections[dbName];
  }

var executeQuery = async function (query) {
    try {
      const connection = await getConnection();
      // console.log("🚀 ~ file: config.js:31 ~ returnnewPromise ~ connection", connection)
      const result = await connection.query(query);
      // console.log("🚀 ~ file: config.js:34 ~ returnnewPromise ~ result", result)
      return result;
    } catch (e) {
      console.error(`Error executing query: ${query} Error: ${e.message}`);
    }
}
      
module.exports = {
    executeQuery
}