/**
 * Created by zheny on 09/05/2017.
 */




var express = require("express");


var app = express();


app.get("/", function (req, res) {
    res.status(200);
    res.send("hello");
} );


app.listen(3030, function () {
    console.log("server start");
});



