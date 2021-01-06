const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
let predictionUtils = require('./util/PredictionUtil');
let matchDayUtils = require('./util/MatchDayPredictionsUtil');
let userList = require('./util/users');
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

exports.predictions = app.get('/predictions', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let type = 'all';
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            let alert;
            let msg;
            let fail;
            if (undefined != req.cookies.alert) {
                alert = req.cookies.alert;
                res.cookie('alert', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            if (undefined != req.cookies.msg) {
                msg = req.cookies.msg;
                res.cookie('msg', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            if (undefined != req.cookies.fail) {
                fail = req.cookies.fail;
                res.cookie('fail', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            let schedule = await predictionUtils.sortSchedule(connection);
            let includeFinishedGames = false;
            let gameWeekSchedule = predictionUtils.predictionDetails(predictionUtils.mapSchedule(schedule, includeFinishedGames));

            /*let matchDay = await predictionUtils.getActiveMatchDay(connection);*/
            let userPredictions = await predictionUtils.getMatchdayPredictions(connection, loginDetails.memberId);
            if (userPredictions.size > 0) {
                predictionUtils.mapPredictionsToSchedule(userPredictions, gameWeekSchedule);
                predictionUtils.generateClientTimeZone(gameWeekSchedule, req);
            }

            res.render('predictions/prediction', {
                title: 'Predictions ',
                team: loginDetails.team,
                fname: loginDetails.fName,
                schedule: gameWeekSchedule,
                memberId: loginDetails.memberId,
                userLogin: loginDetails,
                type: type,
                alert,
                msg,
                fail
            });

        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.log('error processing predictions', e);
        res.redirect('/login');
    }
});

exports.viewPredictions = app.get('/viewPredictions', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let type = 'single';
            let loginDetails = JSON.parse(req.cookies.loginDetails);

            let msg;
            if (undefined != req.cookies.msg) {
                msg = req.cookies.msg;
                res.cookie('msg', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            let schedules = await predictionUtils.sortSchedule(connection);
            let matchDay = 0;
            schedules.forEach(schedule => {
                if (schedule.isActive) {
                    matchDay = schedule.matchDay;
                }
            });

            let predictions = await predictionUtils.userPredictions(connection, loginDetails.memberId, matchDay);

            predictions = predictionUtils.mapScheduleToPrediction(schedules, predictions, req, matchDay);

            predictionUtils.mapPredictionsToSchedule(predictions, schedules);
            predictionUtils.validatePredictionDeadline(predictions);
            predictionUtils.generateClientTimeZoneForPredictedTimw(predictions, req);

            res.render('predictions/userPrediction', {
                title: 'User Predictions ',
                team: loginDetails.team,
                fname: loginDetails.fName,
                memberId: loginDetails.memberId,
                viewPredictions: predictions,
                type: type,
                msg: msg
            });

        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.log('error processing view predictions', e);
        res.redirect('/login');
    }
});

exports.predict = app.get('/predict/:matchNumber/:memberId/:matchDay/:type', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            const type = req.params.type;
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            const matchDay = req.params.matchDay;
            let schedule = await predictionUtils.getMatchdaySchedule(connection, matchDay, req);
            let userPredictions = await predictionUtils.getMatchdayPredictions(connection, loginDetails.memberId, matchDay);
            schedule = predictionUtils.mapSelectedPredictions(userPredictions, schedule)

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

            let matchDeadline;
            if (schedule.length > 0) {
                matchDeadline = predictionUtils.generateClientTimeZoneSingle(schedule[0].deadline, req);
                predictionUtils.setMatchAmounts(schedule);
            }

            res.cookie('schedule', schedule, {expires: new Date(Date.now() + 100 * 60000), httpOnly: true});

            return res.render('predictions/matchPredictions', {
                title: 'Match Day Predictions ',
                team: loginDetails.team,
                fname: loginDetails.fName,
                schedule: schedule,
                memberId: loginDetails.memberId,
                matchDay: matchDay,
                matchDeadline: matchDeadline,
                type: type,
                msg: msg,
                alert: alert
            });
        }
        return res.render('login/login', {
            title: 'Scoreboard'
        });
    } catch (e) {
        console.log('error processing single predictions', e);
        res.redirect('/login');
    }
});

exports.predictPerGame = app.get('/predictGame/:matchNumber/:memberId/:matchDay/:type', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            const matchNumber = req.params.matchNumber;
            const type = req.params.type;
            let schedule = await predictionUtils.getMatchSchedule(connection, matchNumber);
            let matchDeadline;

            let alert;
            if (undefined != req.cookies.alert) {
                alert = req.cookies.alert;
                res.cookie('alert', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            }

            if (schedule.length > 0) {
                matchDeadline = predictionUtils.generateClientTimeZoneSingle(schedule[0].deadline, req);
            }
            res.cookie('schedule', schedule, {expires: new Date(Date.now() + 100 * 60000), httpOnly: true});
            predictionUtils.setMatchAmounts(schedule);

            return res.render('predictions/matchPredictions', {
                title: 'Match Predictions',
                team: loginDetails.team,
                fname: loginDetails.fName,
                schedule: schedule,
                memberId: loginDetails.memberId,
                matchDeadline: matchDeadline,
                type: type,
                alert: alert
            });
        }
        return res.render('login/login', {
            title: 'Scoreboard'
        });
    } catch (e) {
        console.log('error processing predictions', e);
        res.redirect('/login');
    }
});

// Save the predictions
exports.savePredictions = app.post('/savePredictions/:matchDay', urlencodedParser, [
    check('selected1', 'Select All games')
        /*.custom((value, {req}) => value != '--- Select Result ---')*/
        .custom((value, {req}) => {
            const matchDay = req.params.matchDay;

            if (!predictionUtils.validateMatchDay(req, matchDay)) {
                throw new Error('You are trying to select wrong matches');
            }

            if (!predictionUtils.validateMemberPredictions(req)) {
                throw new Error('You must select all games for Matchday : ' + matchDay);
            }
            return true;
        })

], (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            const alert = errors.array();
            res.cookie('schedule', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
            return res.redirect('/predictions');
        } else {
            const matchDay = req.params.matchDay;
            if (predictionUtils.saveSinglePredictions(connection, req, matchDay, res)) {
                const msg = [];
                msg.push('Predictions saved successfully for matchDay : ' + matchDay);
                res.cookie('msg', msg, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                return res.redirect('/predictions');
            } else {
                const fail = [];
                fail.push('Unable to save predictions for matchDay : ' + matchDay);
                res.cookie('fail', fail, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                return res.redirect('/predictions');
            }
        }
    } catch (e) {
        console.log('error processing predictions save', e);
        res.redirect('/login');
    }
});

exports.saveSinglePredictions = app.post('/savePredictions/:matchNumber/:memberId/:matchDay/:type', urlencodedParser, [
    check('selected', 'Select All games')
        .custom((value, {req}) => {
            const matchNumber = req.params.matchNumber;

            if (!predictionUtils.validateMemberSinglePrediction(req, matchNumber)) {
                throw new Error('You must select team and amount for match # : ' + matchNumber);
            }
            return true;
        })

], (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            let matchNumber = req.params.matchNumber;
            let memberId = req.params.memberId;
            let matchDay = req.params.matchDay;
            let type = req.params.type;

            const alert = errors.array();
            res.cookie('schedule', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
            if (type == 'all') {
                return res.redirect('/predict/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
            } else {
                return res.redirect('/predictGame/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
            }

        } else {
            const matchNumber = req.params.matchNumber;
            try {
                if (predictionUtils.saveSinglePredictions(connection, req, matchNumber, res)) {
                    const msg = [];
                    msg.push('Predictions saved successfully for Game # : ' + matchNumber);
                    res.cookie('msg', msg, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    let type = req.params.type;
                    let matchDay = req.params.matchDay;
                    let memberId = req.params.memberId;
                    if (type == 'all') {
                        return res.redirect('/predict/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
                    } else if (type == 'single') {
                        return res.redirect('/viewPredictions');
                    }
                } else {
                    const fail = [];
                    fail.push('Unable to save predictions for Game # : ' + matchNumber);
                    res.cookie('fail', fail, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    return res.redirect('/predictions');
                }
            } catch (ex) {
                console.log('Unable to save predictions' + ex);
                const fail = [];
                fail.push('Unable to save predictions for Game # : ' + matchNumber);
                res.cookie('fail', fail, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                return res.redirect('/predictions');
            }
        }
    } catch (e) {
        console.log('error processing predictions save', e);
        res.redirect('/login');
    }
});

exports.updateSinglePredictions = app.post('/updateSinglePredictions/:matchNumber/:memberId/:matchDay/:type', urlencodedParser, [
    check('selected', 'Select All games')
        .custom((value, {req}) => {
            const matchNumber = req.params.matchNumber;

            if (!predictionUtils.validateMemberSinglePrediction(req, matchNumber)) {
                throw new Error('You must select team and amount for match # : ' + matchNumber);
            }
            return true;
        })

], (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            let matchNumber = req.params.matchNumber;
            let memberId = req.params.memberId;
            let matchDay = req.params.matchDay;
            let type = req.params.type;

            const alert = errors.array();
            res.cookie('schedule', null, {expires: new Date(Date.now() + 0 * 0), httpOnly: true});
            res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
            if (type == 'all') {
                return res.redirect('/updatePredictions/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
            } else {
                return res.redirect('/updatePredictions/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
            }
        } else {
            const matchNumber = req.params.matchNumber;
            try {
                if (predictionUtils.updateSinglePrediction(connection, req, matchNumber, res)) {
                    const updateMessage = [];
                    updateMessage.push('Predictions updated successfully for Game # : ' + matchNumber);
                    res.cookie('msg', updateMessage, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    let type = req.params.type;
                    let matchDay = req.params.matchDay;
                    let memberId = req.params.memberId;
                    if (type == 'all') {
                        return res.redirect('/updatePredictions/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
                    } else {
                        return res.redirect('/updatePredictions/' + matchNumber + "/" + memberId + "/" + matchDay + "/" + type);
                    }
                } else {
                    const fail = [];
                    fail.push('Unable to save predictions for Game # : ' + matchNumber);
                    res.cookie('fail', fail, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    return res.redirect('/predictions');
                }
            } catch (ex) {
                console.log('Unable to save predictions' + ex);
                const fail = [];
                fail.push('Unable to save predictions for Game # : ' + matchNumber);
                res.cookie('fail', fail, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                return res.redirect('/predictions');
            }
        }
    } catch (e) {
        console.log('error processing update predictions', e);
        res.redirect('/login');
    }
});

// Get the user predictions to update
exports.updatePredictions = app.get('/updatePredictions/:matchNumber/:memberId/:matchDay/:type', async (req, res) => {
    if (req.cookies.loginDetails) {
        let loginDetails = JSON.parse(req.cookies.loginDetails);
        const matchDay = req.params.matchDay;
        const matchId = req.params.matchNumber;
        const type = req.params.type;
        let schedule = [];
        let predictions = [];
        if (type == 'all') {
            schedule = await predictionUtils.getMatchdaySchedule(connection, matchDay, req);
            predictions = await predictionUtils.userPredictions(connection, loginDetails.memberId, matchDay);

        } else {
            schedule = await predictionUtils.getMatchSchedule(connection, matchId);
            predictions = await predictionUtils.retrievePrediction(connection, loginDetails.memberId, matchId);
        }

        predictions = predictionUtils.mapScheduleToPrediction(schedule, predictions, req, matchDay);

        let matchDeadline;

        if (schedule.length > 0) {
            matchDeadline = predictionUtils.generateClientTimeZoneSingle(schedule[0].deadline, req);
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

        predictionUtils.setMatchAmounts(predictions);

        res.cookie('schedule', schedule, {expires: new Date(Date.now() + 100 * 60000), httpOnly: true});

        return res.render('predictions/updatePredictions', {
            title: 'Update Prediction',
            team: loginDetails.team,
            fname: loginDetails.fName,
            schedule: predictions,
            memberId: loginDetails.memberId,
            matchDay: matchDay,
            matchDeadline: matchDeadline,
            type: type,
            msg: msg,
            alert: alert
        });
    }
    return res.render('login/login', {
        title: 'Scoreboard'
    });
});

exports.updatePredictionsPost = app.post('/updatePredictions/:matchNumber/:memberId/:matchDay/:type', async (req, res) => {

    return res.redirect('/updatePredictions/:matchNumber/:memberId/:matchDay/:type');
});

exports.matchDayPredictions = app.get('/matchDayPredictions', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            let matchDaySchedule = await predictionUtils.getActiveMatchDaySchedule(connection);
            predictionUtils.validateMatchDeadline(matchDaySchedule);
            let matchIds = [];
            if (matchDaySchedule.length > 0) {
                matchDaySchedule.forEach(function (item) {
                    if (item.winner == null) {
                        let date = new Date(item.deadline);
                        item.localDate = dateAndTime.format(date, pattern);
                        matchIds.push(item);
                    }
                });
            }
            let memberId = loginDetails.memberId;
            let users = [];
            let matchDayPredictions = [];
            let singleMatchPredictions = [];
            let msg = [];
            if (matchIds.length == 0) {
                let message = "No active matches";
                msg.push(message);
            } else {
                if (loginDetails.role == 'member') {
                    for (const match of matchIds) {
                        if (match.isDeadlineReached) {
                            if (users.length == 0) {
                                users = await userList.userDetails(connection, req);
                                users = matchDayUtils.filterActiveUsers(users);
                            }
                            singleMatchPredictions = await predictionUtils.getAllPredictionsPerGame(connection, match.matchNumber);
                            let predictions = matchDayUtils.generateMatchDayPredictions(users, singleMatchPredictions, match);
                            let matchDayDetails = matchDayUtils.generateMatchDayDetails(loginDetails, users, predictions, match);
                            matchDayPredictions.push(matchDayDetails);
                        } else {
                            let message = "Deadline for " + match.homeTeam + " vs " + match.awayTeam + " is : " + match.localDate;
                            msg.push(message);
                        }
                    }
                } else if (loginDetails.role == 'admin') {
                    for (const match of matchIds) {
                        if (users.length == 0) {
                            users = await userList.userDetails(connection, req);
                        }
                        singleMatchPredictions = await predictionUtils.getAllPredictionsPerGame(connection, match.matchNumber);
                        let predictions = matchDayUtils.generateMatchDayPredictions(users, singleMatchPredictions, match);
                        let matchDayDetails = matchDayUtils.generateMatchDayDetails(loginDetails, users, predictions, match);
                        matchDayPredictions.push(matchDayDetails);
                    }
                }
            }

            return res.render('predictions/matchDayPredictions', {
                title: 'Match Day Predictions',
                team: loginDetails.team,
                fname: loginDetails.fName,
                matchDayPredictions: matchDayPredictions,
                memberId: loginDetails.memberId,
                msg: msg
            });
        }
        return res.render('login/login', {
            title: 'Scoreboard'
        });
    } catch (e) {
        console.log('error processing predictions', e);
        res.redirect('/login');
    }
});

