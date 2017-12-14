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
            let notification_data = {notification_title: notificationObject.notification_title, notification_text: notificationObject.notification_text, image:  notificationObject.image, user_device_id:currentSocketArray.user_device_id,datetime_sending:notificationObject.datetime_sending  };
            let query = db.query("INSERT INTO notification_data SET ?", notification_data , function (error, result) {
                throwDbError(error);
                db.commit(function (error) {

                    if (error){
                        db.rollback(function () {
                            console.log(error);
                        })
                    }
                })
            });
        });



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
        let wsObject = { ws: ws, user_id: link.userId, user_device_id: link.user_device_id, type: link.type }
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
            let insert_clipboard = {clipboardText: clipboardObject.clipboardText, clipboardDateCreation: clipboardObject.clipboardDateCreation, user_device_id: user_deviceId,clipboard_data_type_id: clipboardObject.clipboard_data_type_id  };
            let query = db.query("INSERT INTO clipboard SET ?", insert_clipboard , function (error, result) {
                throwDbError(error);
                db.commit(function (error) {

                    if (error){
                        db.rollback(function () {
                            console.log(error);
                        })
                    }
                })
            });
        });


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
        let wsObject = { ws: ws, user_id: link.user_id, user_device_id: link.user_device_id, type: link.type };
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
    wsArray.forEach(function (currentValue, index, array) {
        if ((currentValue.user_id === userId) && (currentValue.type === '2')){
            currentValue.ws.send(message);
        }
    })
}

app.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


app.post("/register", function (req, res) {
    let body = req.body;
    let user_name = body.user_name;
    let selectQuery = db.query("SELECT DISTINCT user.id FROM user JOIN user_auth ON user_auth.user_name =? AND user.id = user_auth.id", user_name, function (error, rows, fields) {
        if (error) {
            console.log(error);
            throw error;
        }
        if (rows.length === 0){
            try {
                db.beginTransaction(function (error) {
                    if (error) {
                        console.log(error);
                        throw error;
                    }
                    let user_auth_data = {user_name: user_name, password_hash: body.password_hash};
                    let quetyAuth = db.query("INSERT INTO user_auth SET ?", user_auth_data, function (error, result) {
                        throwDbWithResponse(error, res, "Transaction error");
                        if (error) {
                            return;
                        }
                        let user_auth_id = result.insertId;
                        let profileData = {name: body.name, surname: body.surname, email: body.email};
                        let queryProfile = db.query("INSERT INTO profile SET ?", profileData, function (error, result) {

                            throwDbWithResponse(error, res, "Transaction error");
                            if (error) {
                                return;
                            }


                            let user_data = {user_auth_id: user_auth_id, profile_id: result.insertId};
                            let queryAll = db.query("INSERT INTO user SET ?", user_data, function (error, result) {
                                throwDbWithResponse(error, res, "Transaction error");
                                db.commit(function (error) {

                                    if (error) {
                                        db.rollback(function () {
                                            putResponse(500, "Transaction error", res);
                                            console.log(error);
                                            throw error;
                                        });
                                        return;
                                    }
                                    putResponse(200, "Registered", res);
                                });
                            });
                        });

                    });

                });


            }
        catch (error){
            console.log(error);
        }
        }else {
            putResponse(401, "User already exist", res);
        }
    })
});


app.post("/login", function (req, res) {
    let body = req.body;
    let query = db.query("SELECT DISTINCT user.id FROM user JOIN user_auth ON user_auth.user_name =? AND user_auth.password_hash =? AND user_auth.id = user.user_auth_id", [body.user_name, body.password_hash], function (error, rows, fields) {
        if (rows.length !== 0){
            let objectToSend = new function () {
                this.userId = rows[0].id;
                this.message = "Welcome";
            };
            putResponse(200, JSON.stringify(objectToSend), res);
        }else {
            let objectToSend = new function () {
                this.userId = -1;
                this.message = "Error. Incorrect auth data";
            };
            putResponse(401, JSON.stringify(objectToSend), res);
        }
    })
});



function throwDbWithResponse(error, res, message) {
    if (error){
        console.log(error);
        db.rollback(function () {
            putResponse(500, message, res);
            throw error;
        })
    }
}

function throwDbError(error) {
    if (error){
        console.log(error);
        db.rollback(function () {

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

    let error_object_to_send = {idUserDevice: -1, message: "Transaction error"};
    var existed_device = null;

    var user_device_id = null;

    let selectDeviceQuery = db.query("SELECT DISTINCT user_device.id FROM user_device JOIN device ON user_device.device_id = device.id AND user_device.user_id=? JOIN device_info ON device_info.deviceId=?", [body.user_id, body.deviceId], function (error, rows, field) {

        if (error){
            console.log(error);
            throw error;
        }



        if (rows.length === 0) {
            //create device at db
            let select_device_query = db.query("SELECT DISTINCT device.id FROM device JOIN device_info ON device.device_info_id = device_info.iddevice_info AND device_info.deviceId=? ", body.deviceId, function (error, rows, field) {

                if (error){
                    console.log(error);
                }else{

                    if (rows.length !== 0) {
                        existed_device = rows[0].id;
                    }
                }
            });
            try {
                db.beginTransaction(function (error) {
                    if (error) {
                        console.log(error);
                        throw error;
                    }
                            if (existed_device === null) {
                                let device_info_data = {deviceId: body.deviceId, device_name: body.device_name};
                                let insertDeviceInfo = db.query("INSERT INTO device_info SET ?", device_info_data, function (error, result) {

                                    throwDbWithResponse(error, res, JSON.stringify(error_object_to_send));
                                    if (error) {
                                        return;
                                    }


                                    let device_data = {device_info_id: result.insertId, device_type_id: body.device_type_id};
                                    let insertDevice = db.query("INSERT INTO device SET ?", device_data, function (error, result) {
                                        throwDbWithResponse(error, res, JSON.stringify(error_object_to_send));

                                        if (error) {
                                            return;
                                        }
                                        existed_device = result.insertId;
                                    });
                                });
                            }
                            let user_device_data = {device_id: existed_device, user_id: body.user_id};
                            let insertUserDevice = db.query("INSERT INTO user_device SET ?", user_device_data, function (error, result) {

                                throwDbWithResponse(error, res, JSON.stringify(error_object_to_send));
                                if (error) {
                                    return;
                                }
                                //todo send user_device_id
                                user_device_id = result.insertId;

                                db.commit(function (error) {

                                    if (error) {
                                        db.rollback(function () {
                                            putResponse(500, JSON.stringify(objectToSend), JSON.stringify(error_object_to_send));
                                            console.log(error);
                                            throw error;
                                        });
                                        return;
                                    }
                                    objectToSend.idUserDevice = user_device_id;
                                    objectToSend.message = "Device registered";
                                    putResponse(200, JSON.stringify(objectToSend), res);
                                });
                            });


                        })

            }catch(error){
                console.log(error);
            }
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






