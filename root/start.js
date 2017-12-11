let express = require("express");

let WebSocket = require("ws").Server;

let bodyParser = require("body-parser");
let mysql = require("mysql");

let app = express();

let route = express.Router();
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




var clipboardWsArray = [{}];

var notificationWsArray = [{}];

notificationSocket.on("connection", function connection(ws){

    let link = urlParse(ws.upgradeReq.url, true).query;
    ws.on("message", function incoming(message) {
        if (message === null)
        {
            return;
        }

        let notificationObject = JSON.parse(message);
        let currentSocketArray = parseArrayForWs(notificationWsArray, ws);
        sendDataToAllDevices(currentSocketArray.user_id, notificationWsArray, message, ws);

        db.beginTransaction(function (error) {
            if (error){
                throw error;
            }

            let query = db.query("INSERT INTO notification_data SET ?",[notificationObject.title, notificationObject.notificationText, notificationObject.image, currentSocketArray.user_device_id] , function (error, result) {
                throwDbError(error)
            });
        });

        db.commit(function (error) {

            if (error){
                db.rollback(function () {
                    console.log(error);
                })
            }
        })

    });

    ws.on("close", function close() {
        console.log("close");
        notificationWsArray.splice(parseSocketArrayForIndex(notificationWsArray, ws), 1);
    });

    ws.on("error", function (error) {
        console.log("error");
    });


    if (ws.readyState === ws.OPEN) {
        console.log("opened");
        let wsObject = { ws: ws, user_id: link.userId, user_device_id: link.userDeviceId, type: link.type }
        notificationWsArray.push(wsObject);
    }

    console.log("notification connected");
});


clipboardSocket.on("connection", function connection(ws){
    let link = urlParse(ws.upgradeReq.url, true).query;

    ws.on("message", function incoming(message) {
        console.log(message);
        let clipboardObject = JSON.parse(message);
        let currentWs = parseArrayForWs(clipboardWsArray, ws);
        var user_deviceId = currentWs.user_device_id;
        sendDataToAllDevices(currentWs.user_id, clipboardWsArray, message, ws);
        db.beginTransaction(function (error) {
            if (error){
                throw error;
            }

            let query = db.query("INSERT INTO clipboard SET ?",[clipboardObject.clipboardData, clipboardObject.datetimeCreation, user_deviceId, clipboardObject.dataType] , function (error, result) {
                throwDbError(error)
            });
        });

        db.commit(function (error) {

            if (error){
                db.rollback(function () {
                    console.log(error);
                })
            }
        })
    });

    ws.on("close", function close() {
        console.log("close");
        clipboardWsArray.splice(parseSocketArrayForIndex(clipboardWsArray, ws), 1);
    });

    ws.on("error", function (error) {
       console.log("error");
    });


    if (ws.readyState === ws.OPEN) {
        console.log("opened");
        let wsObject = { ws: ws, user_id: link.userId, user_device_id: link.userDeviceId, type: link.type };
        clipboardWsArray.push(wsObject);
    }

    console.log("clipboard connected");
});


function parseSocketArrayForIndex(wsArray, ws) {
    var result;
    for (var index = 0 ; index < wsArray.length; index++){
        if (wsArray[index].ws === ws)
        {
            result = index;
            break;
        }
    }
    return result;
}


function parseArrayForWs(wsArray, ws) {
    var result;
    for (var index = 0 ; index < wsArray.length; index++){
        if (wsArray[index].ws === ws)
        {
            result = wsArray[index];
            break;
        }
    }
    return result;
}


function sendDataToAllDevices(userId, wsArray, message, ws) {
    wsArray.forEach(function (item, index, array) {
        if ((item.user_id === userId) && (item.type === 2) && (ws.type !== 2) ){
            item.ws.send(message);
        }
    })
}

app.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


app.post("/register", function (req, res) {
    let body = req.body;
    let selectQuery = db.query("SELECT DISTINCT user.id FROM user JOIN user_auth ON user_auth.userName = ? AND user.id = user_auth.id", body.userName, function (error, rows, fields) {
        console.log(error);
        if (rows.length === 0){

            db.beginTransaction(function (error) {
                if (error){
                    throw error;
                }
                let quetyAuth = db.query("INSERT INTO user_auth SET ?", [body.userName, body.passwordHash], function (error, result) {
                    throwDbError(error)

                    let userAuthId = result.insertId;

                    let queryProfile = db.query("INSERT INTO profile SET ?", [body.name, body.surname, body.email], function (error, result) {

                            throwDbError(error);



                            let profileId = result.insertId;


                            let queryAll = db.query("INSERT INTO user SET ?" , [userAuthId, profileId], function (error, result) {
                                throwDbError(error);
                            });
                    });

                })

            });

            db.commit(function (error) {

                if (error){
                    db.rollback(function () {
                        putResponse(500, "Transaction error", res);
                        console.log(error);
                    });
                    return;
                }
                putResponse(200, "Registered", res);
            });
        }else {
            putResponse(401, "User already exist", res);
        }
    })
});


app.post("/login", function (req, res) {
    let body = req.body;
    let query = db.query("SELECT DISTINCT user.id FROM user JOIN user_auth ON user_auth.user_name =? AND user_auth.password_hash =? AND user_auth.id = user.user_auth_id", [body.userName, body.passwordHash], function (error, rows, fields) {
        if (rows.length !== 0){
            let objectToSend = new function () {
                this.userId = rows[0].id;
                this.message = "Welcome";
            };
            putResponse(200, JSON.stringify(objectToSend), res);
        }else {
            putResponse(401, "Error. Incorrect auth data", res);
        }
    })
});



function throwDbError(error) {
    if (error){
        console.log(error);
        db.rollback(function () {
            throw error;
        })
    }
}

app.post("/registerDevice", function (req, res) {
    let body = req.body;
    let insertBody = {
        deviceId: body.deviceId,
        deviceType: body.deviceType
    };
    let objectToSend = new function () {
        this.idUserDevice = null;
        this.message = null;
    };


    var user_device_id = null;

    let selectDeviceQuery = db.query("SELECT DISTINCT id FROM user_device JOIN device ON user_device.device_id = device.id AND user_auth.user_id=? JOIN device_info ON device_info.deviceId=?", [body.userId, body.deviceId], function (error, rows, field) {

        if (error){
            console.log(error);
        }

        if (rows.length === 0){
            //create device at db

            db.beginTransaction(function (error) {
                if (error){
                    console.log(error);
                    throw error;
                }


                let insertDeviceInfo = db.query("INSERT INTO device_info SET ?", [body.deviceId, body.deviceName], function (error, result) {

                    throwDbError(error);


                    let insertDevice = db.query("INSERT INTO device SET ?", [result.insertId, body.deviceType], function (error, result) {
                        throwDbError(error);

                        let insertUserDevice = db.query("INSERT INTO user_device SET ?", [body.userId, result.insertId], function (error, result) {

                            throwDbError(error);

                            //todo send user_device_id
                            user_device_id = result.insertId;
                        })
                    })
                })
            });


            db.commit(function (error) {

                if (error){
                   db.rollback(function () {
                       putResponse(500, "Bad request", res);
                       console.log(error)
                   });
                }
                objectToSend.idUserDevice = user_device_id;
                objectToSend.message = "Device registered";
                putResponse(200, JSON.stringify(objectToSend), res);
            })
        }
        else {
            objectToSend.idUserDevice = rows[0].id;
            objectToSend.message = "Device already registered";
            putResponse(200, JSON.stringify(objectToSend), res);
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



