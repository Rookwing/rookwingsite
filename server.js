const mysql = require("promise-mysql");

createTcpPool = async (config) => {
	// Establish a connection to the database
	console.log("Creating TCP Pool");
	try {
		return await mysql.createPool({
			user: process.env.DB_USER, // e.g. 'my-db-user'
			password: process.env.DB_PASS, // e.g. 'my-db-password'
			database: process.env.DB_NAME, // e.g. 'my-database'
			host: process.env.DB_HOST, // e.g. '127.0.0.1'
			port: process.env.DB_PORT,
		});
	} catch (err) {
		console.log(err);
		return;
	}
};

createUnixSocketPool = async (config) => {
	const dbSocketPath = process.env.DB_SOCKET_PATH || "/cloudsql/";
	console.log("Creating Socket Pool");

	try {
		// Establish a connection to the database
		return await mysql.createPool({
			user: process.env.DB_USER, // e.g. 'my-db-user'
			password: process.env.DB_PASS, // e.g. 'my-db-password'
			database: process.env.DB_NAME, // e.g. 'my-database'
			// If connecting via unix domain socket, specify the path
			socketPath: `${dbSocketPath}/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
			// Specify additional properties here.
			...config,
		});
	} catch (err) {
		console.log(err);
		return;
	}
};

async function createPool() {
	try {
		const config = {
			// 'connectionLimit' is the maximum number of connections the pool is allowed
			// to keep at once.
			connectionLimit: 5,
			// 'connectTimeout' is the maximum number of milliseconds before a timeout
			// occurs during the initial connection to the database.
			connectTimeout: 10000, // 10 seconds
			// 'acquireTimeout' is the maximum number of milliseconds to wait when
			// checking out a connection from the pool before a timeout error occurs.
			acquireTimeout: 10000, // 10 seconds
			// 'waitForConnections' determines the pool's action when no connections are
			// free. If true, the request will queued and a connection will be presented
			// when ready. If false, the pool will call back with an error.
			waitForConnections: true, // Default: true
			// 'queueLimit' is the maximum number of requests for connections the pool
			// will queue at once before returning an error. If 0, there is no limit.
			queueLimit: 0, // Default: 0
		};
		if (process.env.DB_HOST) {
			return await createTcpPool(config);
		} else {
			return await createUnixSocketPool(config);
		}
	} catch (err) {
		console.log(err);
		return;
	}
}

async function closePool(_pool) {
	try {
		return mysql.pool.end(_pool);
	} catch (error) {
		throw error;
	}
}

async function Login(_pool, _username, _passhash) {
	try {
		const loginQuery = await _pool.query(
			"SELECT isActive FROM User where LoginName = ? and PasswordHash = ?",
			[_username, _passhash]
		);
		const loginResult = loginQuery;
		if (loginResult.length > 0) {
			console.log(
				loginResult[0].isActive == 1 ? "Login Successful" : "Login Denied"
			);
			return loginResult;
		} else {
			return loginResult;
		}
	} catch (error) {
		throw error;
	}
}

module.exports = { createPool, Login };
