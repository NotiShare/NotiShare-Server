/**
 * Created by zheny on 09/05/2017.
 */




var express = require("express");

var WebSocket = require("ws").Server;

var bodyParser = require("body-parser")
var mysql = require("mysql");

var app = express();


var db = mysql.createConnection({
    host:"127.0.0.1",
    port:3306,
    user:"root",
    password:"1234",
    database:"notishare"
});

db.connect(function (err) {
    console.log(err);
});
var notificationSocket = new WebSocket({port:3031, path: "/notificationSocket"});

var router  = express.Router();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));


var wsArray = {};

notificationSocket.on("connection", function connection(ws){

    ws.on("message", function incoming(message) {

    });
    ws.on("close", function close() {
        
    });
    console.log("connected");
    ws.send("Hello");
});

app.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


app.post("/register", function (req, res) {
    var body = req.body;
    var selectQuery = db.query("SELECT userName FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
        console.log(error);
        if (rows.length === 0){
            var query = db.query("INSERT INTO user SET ?", body, function (error, result) {
                console.log(error);
                if (error === null){
                    putResponse(200, "Registered", res);
                }
            });
        }else {
            putResponse(401, "User already exist", res);
        }
    })
});


app.post("/login", function (req, res) {
    var body = req.body;
    var query = db.query("SELECT * FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
        if (rows.length !== 0){
            if ((rows[0].userName === body.userName) && (rows[0].passwordHash === body.passwordHash) ){
                putResponse(200, "Welcome", res);
            }else{
                putResponse(401, "Error. No such user or password");
            }
        }else {
            putResponse(401, "Error. No such user or password", res);
        }
    })
});


function putResponse(errorCode, message, res) {
    res.status(errorCode);
    res.send(message);
}



app.listen(3030, function () {
    console.log("server start");
});



