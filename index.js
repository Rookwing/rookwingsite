var mysql = require("promise-mysql");
var express = require("express");
var session = require("express-session");
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
const { response, request } = require("express");
const { Console } = require("console");

if (process.env.NODE_ENV != "production") {
	var dotenv = require("dotenv").config();
}

var PORT = process.env.PORT || 8080;

var app = express();
app.set("view engine", "pug");
app.enable("trust proxy");
app.use(express.static(__dirname + "/public/ref/"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set Content-Type for all responses for these routes.
app.use((req, res, next) => {
	res.set("Content-Type", "text/html");
	next();
});

const createTcpPool = async (config) => {
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

const createUnixSocketPool = async (config) => {
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

const createPool = async () => {
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
};

// Set up a variable to hold our connection pool. It would be safe to
// initialize this right away, but we defer its instantiation to ease
// testing different configurations.
let pool;

app.use(async (req, res, next) => {
	if (pool) {
		return next();
	}
	try {
		pool = await createPool();
		next();
	} catch (err) {
		console.log(err);
		return next(err);
	}
});

app.use(
	session({
		secret: "sydneynumberone",
		name: "sessionID",
		resave: false,
		saveUninitialized: false,
	})
);

app.get("/", function (request, response) {
	response.redirect("/login");
});

app.post("/auth", async (request, response) => {
	console.log(`Logging In ${process.env.HOST}:${process.env.PORT}`);
	pool = pool || (await createPool());

	var username = request.body.username;
	var password = request.body.password;
	var passwordHash = crypto.createHash("sha256").update(password).digest("hex");

	if (username && passwordHash) {
		const stmt = `SELECT 1 as Result FROM UserData.User where LoginName = ${username} and PasswordHash = ${passwordHash}`;
		console.log(stmt);

		const loginQuery = pool.query(stmt, [username, passwordHash]);
		console.log(
			`Sending to Database ${process.env.DB_HOST}:${process.env.DB_PORT}`
		);
		const loginResult = await loginQuery;
		console.log(loginResult.Result == 1 ? "Login Successful" : "Login Denied");

		if (loginResult.length > 0) {
			request.session.loggedin = true;
			request.session.username = username;
			response.redirect("/home");
		} else {
			response.redirect("/login");
		}
		response.end();
	} else {
		response.send("Please enter Username and Password!");
		response.end();
	}
});

app.get("/home", function (request, response) {
	console.log("/home load");
	if (request.session.loggedin) {
		fs.readFile(__dirname + "/public/home.html", function (err, data) {
			if (err) {
				response.writeHead(500);
				return res.end("Error Loading home.html");
			}
			response.writeHead(200);
			response.end(data);
		});
	} else {
		response.redirect("/login");
	}
});

app.get("/contact", function (request, response) {
	console.log("/contact load");
	if (request.session.loggedin) {
		fs.readFile(__dirname + "/public/contact.html", function (err, data) {
			if (err) {
				response.writeHead(500);
				return res.end("Error Loading contact.html");
			}
			response.writeHead(200);
			response.end(data);
		});
	} else {
		response.redirect("/login");
	}
});

app.get("/about", function (request, response) {
	if (request.session.loggedin) {
		console.log("/about load");
		fs.readFile(__dirname + "/public/about.html", function (err, data) {
			if (err) {
				response.writeHead(500);
				return res.end("Error Loading about.html");
			}
			response.writeHead(200);
			response.end(data);
		});
	} else {
		response.redirect("/login");
	}
});

app.get("/login", function (request, response) {
	if (request.session.loggedin) {
		console.log("Already Logged In");
		response.redirect("/home");
	} else {
		console.log("Please Log In");
		fs.readFile(__dirname + "/public/login.html", function (err, data) {
			if (err) {
				response.writeHead(500);
				return res.end("Error Loading Login.html");
			}
			response.writeHead(200);
			response.end(data);
		});
	}
});

app.get("/logout", function (request, response) {
	if (request.session.loggedin) {
		request.session.loggedin = false;
		request.session.username = null;
		response.redirect("/login");
	} else {
		response.redirect("/login");
	}
});

console.log("Server Running on " + PORT);

app.listen(PORT, process.env.HOST);
