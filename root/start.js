let express = require("express");

let WebSocket = require("ws").Server;

let bodyParser = require("body-parser");
let mysql = require("mysql");

let app = express();

let urlParse = require("url-parse");

let db = mysql.createConnection({
    host:"127.0.0.1",
    port:3306,
    user:"root",
    password:"1234",
    database:"notishare"
});

db.connect(function (err) {
    console.log(err);
});
let notificationSocket = new WebSocket({port:3031, path: "/notificationSocket"});
let clipboardSocket = new WebSocket({port:3032, path:"/clipboardSocket"});


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

    ws.on("open", function open() {

    });
    console.log("notification connected");
    ws.send("Hello");
});


clipboardSocket.on("connection", function connection(ws){

    ws.on("message", function incoming(message) {
        console.log(message);
    });
    ws.on("close", function close() {

    });

    ws.on("open", function open() {
        wsArray.append(ws);
    });
    let link = urlParse(ws.upgradeReq.url, true);
    console.log("clipboard connected");
    ws.send("Hello");
});

app.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


app.post("/register", function (req, res) {
    let body = req.body;
    let selectQuery = db.query("SELECT userName FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
        console.log(error);
        if (rows.length === 0){
            let query = db.query("INSERT INTO user SET ?", body, function (error, result) {
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
    let body = req.body;
    let query = db.query("SELECT * FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
        if (rows.length !== 0){
            if ((rows[0].userName === body.userName) && (rows[0].passwordHash === body.passwordHash) ){
                putResponse(200, "Welcome", res);
            }else{
                putResponse(401, "Error. Incorrect auth data", res);
            }
        }else {
            putResponse(401, "Error. Incorrect auth data", res);
        }
    })
});



app.post("/registerDevice", function (req, res) {
    let body = req.body;
    let insertBody = {
        deviceId: body.deviceId,
        deviceType: body.deviceType
    };
    let objectToSend = new function () {
        this.idDevice = null;
        this.idUser = null;
        this.message = null;
    };
    let query = db.query("SELECT deviceId, id FROM device WHERE deviceId =?", body.deviceId, function (error, rows, fields) {
        if (rows.length === 0) {
            let insertQuery = db.query("INSERT INTO device SET ?", insertBody, function (error, result) {
                console.log(error);

                let insertedId = result.insertId;
                objectToSend.idDevice = insertedId;
                let userQuery = db.query("SELECT id FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
                    console.log(error);
                    objectToSend.idUser = rows[0].id;
                    let insertObject = {
                        user_id: rows[0].id,
                        device_id: insertedId
                    };
                    let insertUserDevice = db.query("INSERT INTO user_device SET ?", insertObject, function (error, result) {
                        console.log(error);
                        objectToSend.message = "Device registered";
                        let resultJson = JSON.stringify(objectToSend);
                        putResponse(200, resultJson, res);
                    });
                })
            })
        } else {
            let deviceDbId = rows[0].id;
            let checkUser = db.query("SELECT id FROM user WHERE userName = ?", body.userName, function (error, rows, fields) {
                let userIdDb = rows[0].id;
                let checkDevice = db.query("SELECT * FROM user_device WHERE user_id =? AND device_id =?", [rows[0].id, deviceDbId], function (error, rows, fields) {
                    if (rows.length === 0) {
                        let insertObject = {
                            user_id: userIdDb,
                            device_id: deviceDbId
                        };
                        objectToSend.idUser = userIdDb;
                        objectToSend.idDevice = deviceDbId;
                        let insertUserDevice = db.query("INSERT INTO user_device SET ?", insertObject, function (error, result) {
                            console.log(error);
                            objectToSend.message = "Device registered";
                            let resultJson = JSON.stringify(objectToSend);
                            putResponse(200, resultJson, res);
                        });
                    }
                    else {
                        objectToSend.idDevice = deviceDbId;
                        objectToSend.idUser = userIdDb;
                        objectToSend.message = "U are already at the system";
                        let resultJson = JSON.stringify(objectToSend);
                        putResponse(200, resultJson , res);
                    }
                });

            })
        }
    });
});



function putResponse(code, message, res) {
    res.status(code);
    res.send(message);
}



app.listen(3030, function () {
    console.log("server start");
});



