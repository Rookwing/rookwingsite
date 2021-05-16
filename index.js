const mysql = require("promise-mysql");
const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { response, request } = require("express");
const { Console } = require("console");
const { createPool, Login } = require("./server.js");

if (process.env.NODE_ENV != "production") {
	var dotenv = require("dotenv").config();
}

var PORT = process.env.PORT;

var app = express();
var server = app.listen(PORT, process.env.HOST);
console.log("Server Running on " + PORT);

app.use(express.static(__dirname + "/public/ref/"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
	pool = pool || (await createPool());

	var username = request.body.username;
	var password = request.body.password;
	var passwordHash = crypto.createHash("sha256").update(password).digest("hex");

	if (username && passwordHash) {
		const loginResult = await Login(pool, username, passwordHash);

		if (loginResult[0].isActive == 1) {
			request.session.loggedin = true;
			request.session.username = pool.escape(username);
			response.redirect("/home");
		} else {
			console.log("Incorrect Login/Pass");
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

app.get("/game", function (request, response) {
	if (request.session.loggedin) {
		fs.readFile(__dirname + "/public/game.html", function (err, data) {
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
