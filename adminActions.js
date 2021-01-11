const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
let predictionUtils = require('./util/PredictionUtil');
let matchDayUtils = require('./util/MatchDayPredictionsUtil');
let userList = require('./util/users');
let adminUtils = require('./util/adminUtils');
let db = require('./db');
const dateAndTime = require('date-and-time');
const pattern = dateAndTime.compile('MMM DD YYYY, hh:mm:ss A');

const urlencodedParser = bodyParser.urlencoded({extended: false})
const {check, validationResult} = require('express-validator')

const app = express();

//set views file
app.set('views', path.join(__dirname, 'views'));

//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));

const connection = db.dbConnection();

exports.updateResult = app.get('/updateResult', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            if (loginDetails.role != 'admin') {
                return res.redirect("/predictions");
            }

            let msg;
            if (undefined != req.cookies.msg) {
                msg = req.cookies.msg;
                res.cookie('msg', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            let alert;
            if (undefined != req.cookies.alert) {
                alert = req.cookies.alert;
                res.cookie('alert', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            let matchDaySchedule = await predictionUtils.getActiveMatchDaySchedule(connection);

            return res.render('predictions/updateResult', {
                title: 'Update Result',
                loginDetails: loginDetails,
                schedule: matchDaySchedule,
                msg: msg,
                alert: alert
            });
        }
        return res.render('login/login', {
            title: 'Scoreboard'
        });
    } catch (e) {
        console.log('error processing update result : ', e);
        res.redirect('/login');
    }
});

exports.updateMatchResult = app.post('/updateMatchResult/:matchNumber', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let msg = [];
            let alert = [];
            if (null != req.body.selected && req.body.selected != '--- Update Result ---'){

            } else {
                alert.push('Select the result to Update');
                res.cookie('alert', alert, {expires: new Date(Date.now() + 100 * 60000), httpOnly: true});
                return res.redirect('/updateResult');
            }
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            let matchId = req.params.matchNumber;
            let matchDaySchedule = await predictionUtils.getMatchSchedule(connection, matchId, req);
            let matchIds = [];
            let users = [];
            let matchDayPredictions = [];
            let singleMatchPredictions = [];

            if (matchDaySchedule.length > 0) {
                matchDaySchedule.forEach(function (item) {
                    if (item.winner == null) {
                        matchIds.push(item);
                    }
                });
            }

            predictionUtils.validateMatchDeadline(matchIds);

            for (const match of matchIds) {
                users = await userList.userDetails(connection, req);
                users = userList.activeUsers(users);
                singleMatchPredictions = await predictionUtils.getAllPredictionsPerGame(connection, match.matchNumber);
                let predictions = matchDayUtils.generateMatchDayPredictions(users, singleMatchPredictions, match);
                let matchDayDetails = matchDayUtils.generateMatchDayDetails(loginDetails, users, predictions, match, req);
                matchDayPredictions.push(matchDayDetails);
            }

            if (await adminUtils.processUpdateResult(connection, matchDayPredictions, req.body.selected, req, res)){
                let message = 'Updated the Match Result';
                msg.push(message);
                res.cookie('msg', msg, {expires: new Date(Date.now() + 100 * 60000), httpOnly: true});
            }
            return res.redirect('/updateResult');
        }
        return res.render('login/login', {
            title: 'Scoreboard'
        });
    } catch (e) {
        console.log('error processing update result', e);
        res.redirect('/login');
    }
});