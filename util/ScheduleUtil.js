const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
let predictionUtils = require('./PredictionUtil');

var mom = require('moment-timezone');

const app = express();

//set views file
app.set('views',path.join(__dirname,'views'));

//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));


exports.matchDetails = async function getMatchDetails(connection, req){
    let sql = `Select * from SCHEDULE order by matchNumber asc`;
    return await new Promise( (resolve,reject) => {
        let result = connection.query(sql, function(err, results) {

            if(err){
                reject(err);
            } else {
                let schedule = [];
                if (results.length > 0){
                    results.forEach(function(item) {
                        // item.clientTime = clientTimeZone(item.deadline, req.cookies.clientOffset);
                        item.momentClientTime = clientTimeZoneMoment(item.deadline, req.cookies.clientOffset);
                        item.deadline = dashboardFormat(item.deadline, req.cookies.clientOffset);
                        schedule.push(item);
                    });
                    resolve(schedule);
                } else {
                    resolve(schedule);
                }
            }
        });
    });
}

exports.generateMatchDay = function generateMatchDay(schedule){
    return predictionUtils.mapSchedule(schedule, true);

}

function clientTimeZoneMoment(date, clientTimeZone){
    //var format = 'YYYY/MM/DD HH:mm:ss ZZ';
    var format = 'lll';
    return mom(date).tz(clientTimeZone).format(format);
}

function dashboardFormat(date, clientTimeZone){
    //var format = 'YYYY/MM/DD HH:mm:ss ZZ';
    var format = "yyyy-MM-DDTHH:mm:ss";
    return mom(date).tz(clientTimeZone).format(format);
}

exports.getActiveSchedule = function getActiveSchedule(schedule){
    let activeSchedule = [];
    if (schedule.length > 0){
        schedule.forEach(game =>{
            if (game.isActive){
                activeSchedule.push(game);
            }
        });
    }
    return activeSchedule;
}