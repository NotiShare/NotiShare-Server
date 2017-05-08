/**
 * Created by zheny on 09/05/2017.
 */




var express = require("express");

var WebSocket = require("ws").Server;

var mysql = require("mysql");

var app = express();

var notificationSocket = new WebSocket({port:3031, path: "/notificationSocket"});

var router  = express.Router();

notificationSocket.on("connection", function connection(ws){

    console.log("connected");

});

router.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


router.post("/register", function (req, res) {

});

app.listen(3030, function () {
    console.log("server start");
});



