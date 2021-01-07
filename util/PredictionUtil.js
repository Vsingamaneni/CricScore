const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
var mom = require('moment-timezone');
var dateFormat = require('dateformat');
const dateAndTime = require('date-and-time');
const pattern = dateAndTime.compile('MMM DD YYYY, hh:mm:ss A');

mom.suppressDeprecationWarnings = true;

const app = express();

//set views file
app.set('views', path.join(__dirname, 'views'));

//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));

exports.sortSchedule = async function getSchedule(connection, req) {

    let sql = `Select *
               from SCHEDULE`;
    var schedules = [];

    await new Promise((resolve, reject) => {
        var result = connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (item) {
                        schedules.push(item);
                    });
                    resolve(schedules);
                } else {
                    resolve(schedules);
                }
            }
        });
    });


    schedules.forEach(schedule => {
        var d1 = new Date();
        var d2 = new Date(schedule.deadline);
        if (d1.getTime() < d2.getTime()) {
            schedule.allow = true;
        } else {
            schedule.allow = false;
        }
/*        var date = new Date(schedule.deadline);
        schedule.localDate = dateAndTime.format(date, pattern);*/
        schedule.localDate = clientTimeZoneMoment(schedule.deadline, req.cookies.clientOffset);
    });
    return schedules;
}

// returns the entire schedule for the given matchDay.
exports.getMatchdaySchedule = async function getMatchdaySchedule(connection, matchDay, req) {

    let sql = `Select * from SCHEDULE where matchDay =${matchDay}`;
    var matches = [];

    await new Promise((resolve, reject) => {
        var result = connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (item) {
                        if (item.winner == null) {
                            item.deadline = clientTimeZoneMoment(item.deadline, req.cookies.clientOffset);
                            matches.push(item);
                        }
                    });
                    resolve(matches);
                } else {
                    resolve(matches);
                }
            }
        });
    });

    return matches;
}

// returns the entire schedule for the given matchDay.
exports.getMatchSchedule = async function getMatchSchedule(connection, matchNumber, req) {

    let sql = `Select * from SCHEDULE where matchNumber =${matchNumber}`;
    var matches = [];

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        if (!item.done) {
                            item.deadline = clientTimeZoneMoment(item.deadline, req.cookies.clientOffset);
                            matches.push(item);
                        }
                    });
                    resolve(matches);
                } else {
                    resolve(matches);
                }
            }
        });
    });

    return matches;
}

// returns the entire predictions for the given matchDay and memberId.
exports.getMatchdayPredictions = async function getMatchdayPredictions(connection, memberId, matchDay) {
    let sql;
    if (matchDay != null) {
        sql = `Select * from PREDICTIONS where memberId = ${memberId} and matchDay = ${matchDay}`;
    } else {
        sql = `Select * from PREDICTIONS where memberId = ${memberId}`;
    }

    let matches = [];

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        matches.push(item);
                        resolve(matches);
                    });
                } else {
                    resolve(matches);
                }
            }
        });
    });

    let userPredictions = new Map();

    if (matches.length > 0) {
        matches.forEach(function (match) {
            if (undefined != userPredictions.get(match.matchDay)) {
                let gameWeek = userPredictions.get(match.matchDay);
                gameWeek.push(match);
            } else {
                let weeksSchedule = [];
                weeksSchedule.push(match);
                userPredictions.set(match.matchDay, weeksSchedule);
            }
        });
    }
    return userPredictions;

}

// returns the entire predictions for the given matchId.
exports.getAllPredictionsPerGame = async function getAllPredictionsPerGame(connection, matchId) {
    let sql = `Select * from PREDICTIONS where matchNumber = ${matchId}`;

    let userPredictions = [];

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        userPredictions.push(item);
                        resolve(userPredictions);
                    });
                } else {
                    resolve(userPredictions);
                }
            }
        });
    });

    return userPredictions;

}

exports.mapPredictionsToSchedule = function mapPredictionsToSchedule(predictions, schedule) {
    // schedule is a list
    if (schedule.length > 0) {
        validateDeadline(schedule);
        schedule.forEach(function (match) {
            let allowPrediction = true;
            if (predictions.size > 0) {
                for (const [key, value] of predictions.entries()) {
                    if (match.matchDay == key) {
                        match.isPartialPredicted = false;
                        if (value.length == 0) {
                            if (!match.isDeadlineReached) {
                                allowPrediction = true;
                            } else {
                                allowPrediction = false;
                            }
                        } else if (match.games == value.length) {
                            allowPrediction = false;
                        } else if (match.games > value.length) {
                            match.isPartialPredicted = true;
                            if (!match.isDeadlineReached) {
                                allowPrediction = true;
                            } else {
                                allowPrediction = false;
                            }
                        }
                    }
                }
            }
            match.allow = allowPrediction;
        })
    }

}

function validateDeadline(gameWeekSchedule) {
    if (gameWeekSchedule.length > 0) {
        gameWeekSchedule.forEach(game => {
            game.isDeadlineReached = isDeadlineReached(game.deadline);
        });
    }
}

exports.validatePredictionDeadline = function validatePredictionDeadline(predictions) {
    if (predictions.length > 0) {
        predictions.forEach(game => {
            game.isDeadlineReached = isDeadlineReached(game.deadline);
            if (game.isDeadlineReached && game.selected == '-'){
                game.selected = 'Default';
                game.amount = -game.matchAmount;
            }
        });
    }
}

exports.validateMatchDeadline = function validateMatchDeadline(gameWeekSchedule) {
    if (gameWeekSchedule.length > 0) {
        gameWeekSchedule.forEach(game => {
            game.isDeadlineReached = isDeadlineReached(game.deadline);
        });
    }
}

function isDeadlineReached(date) {
    var matchDate = new Date(date);
    var currentDate = new Date();

    if (matchDate > currentDate) {
        return false;
    } else {
        if (matchDate < currentDate) {
            return true;
        }
        return false;
    }
}

exports.mapSelectedPredictions = function mapSelectedPredictions(predictions, schedule) {
    // schedule is a list
    if (schedule.length > 0) {
        schedule.forEach(function (match) {
            let predictionFound = false;
            if (predictions.size > 0) {
                for (const [key, value] of predictions.entries()) {
                    value.forEach(function (prediction) {
                        if (match.matchNumber == prediction.matchNumber) {
                            predictionFound = true;
                            match.selected = prediction.selected;
                            match.predictionFound = predictionFound;
                            match.amount = prediction.amount;
                        }
                    });
                }
            }
            match.predictionFound = predictionFound;
        })
    }
    return schedule;
}

// Returns the current active matchDay
exports.getActiveMatchDaySchedule = async function getActiveMatchDaySchedule(connection) {
    let sql = `Select * from SCHEDULE where isActive = true`;
    let matchDay;
    var schedule = [];

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        schedule.push(item);
                        resolve(schedule);
                    });
                } else {
                    resolve(schedule);
                }
            }
        });
    });

    return schedule;
}

exports.mapSchedule = function mapSchedule(schedule, includeFinishedGames) {
    let matchDaySchedule = new Map();

    if (schedule.length > 0) {
        schedule.forEach(function (match) {
            if (!match.done || includeFinishedGames) {
                if (undefined != matchDaySchedule.get(match.matchDay)) {
                    let gameWeek = matchDaySchedule.get(match.matchDay);
                    gameWeek.push(match);
                } else {
                    let weeksSchedule = [];
                    weeksSchedule.push(match);
                    matchDaySchedule.set(match.matchDay, weeksSchedule);
                }
            }
        });

    }
    return matchDaySchedule;
}

exports.predictionDetails = function predictionDetails(matchDaySchedule) {
    let finalPredictionSchedule = [];
    if (matchDaySchedule.size > 0) {
        for (const [key, value] of matchDaySchedule.entries()) {
            let singleSchedule = {'matchDay': key};
            singleSchedule.localDate = value[0].localDate;
            singleSchedule.games = value.length;
            singleSchedule.deadline = value[0].deadline;
            singleSchedule.allow = true;
            singleSchedule.matchNumber = value[0].matchNumber;
            finalPredictionSchedule.push(singleSchedule);
        }
    }
    return finalPredictionSchedule;
}

exports.validateMatchDay = function validateMatchDay(req, matchDay) {
    let noError = true;
    let schedule = req.cookies.schedule;
    if (undefined != schedule) {
        schedule.forEach(function (match) {
            if (match.matchDay != matchDay) {
                noError = false;
            }
        });
    }
    return noError;
}

exports.validateMemberPredictions = function validateMemberPredictions(req) {
    let noError = true;
    let schedule = req.cookies.schedule;
    if (undefined != schedule) {
        schedule.forEach(function (match) {
            let selectedValue = returnSelectedValue(req, match.matchNumber);
            if (selectedValue == '--- Select Result ---') {
                noError = false;
            }
        });
    } else {
        noError = false;
    }
    return noError;
}

exports.validateMemberSinglePrediction = function validateMemberSinglePrediction(req, matchNumber) {
    let noError = true;
    let schedule = req.cookies.schedule;
    let match;
    if (undefined != schedule) {
        schedule.forEach(function (game) {
            if (game.matchNumber == matchNumber) {
                match = game;
            }
        });
        let selectedValue = req.body.selected;
        if (selectedValue == '--- Select Team ---') {
            noError = false;
        }

        let selectedAmount = req.body.amount;
        if (selectedAmount == '--- Select Amount ---') {
            noError = false;
        }
    } else {
        noError = false;
    }
    return noError;
}

exports.userPredictions = async function userPredictions(connection, memberId, matchDay) {

    let sql = `Select *
               from PREDICTIONS
               where memberId = ` + memberId + ` and matchday >= ` + matchDay;
    var predictions = [];

    await new Promise((resolve, reject) => {
        var result = connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        predictions.push(item);
                    });
                    resolve(predictions);
                } else {
                    resolve(predictions);
                }
            }
        });
    });


    /*    schedules.forEach(schedule => {
            var d1 = new Date();
            var d2 = new Date(schedule.deadline);
            if (d1.getTime() < d2.getTime()) {
                schedule.allow = true;
            } else {
                schedule.allow = false;
            }

        });*/
    return predictions;
}

exports.retrievePrediction = async function retrievePrediction(connection, memberId, matchId) {

    let sql = `Select *
               from PREDICTIONS
               where memberId = ` + memberId + ` and matchNumber = ` + matchId;
    var predictions = [];

    await new Promise((resolve, reject) => {
        var result = connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    results.forEach(function (item) {
                        predictions.push(item);
                    });
                    resolve(predictions);
                } else {
                    resolve(predictions);
                }
            }
        });
    });


    /*    schedules.forEach(schedule => {
            var d1 = new Date();
            var d2 = new Date(schedule.deadline);
            if (d1.getTime() < d2.getTime()) {
                schedule.allow = true;
            } else {
                schedule.allow = false;
            }

        });*/
    return predictions;
}

// Saves user predictions for the match day.
exports.saveMemberPredictions = async function saveMemberPredictions(connection, req, matchDay, res) {
    let isPredictionSaveSuccess = false;
    let loginDetails = JSON.parse(req.cookies.loginDetails);
    let schedule = req.cookies.schedule;
    if (undefined == schedule) {
        return;
    }

    const memberId = loginDetails.memberId;
    var matchNumber;
    var homeTeam;
    var awayTeam;
    var firstName;
    var selected;
    var predictedTime = new Date();

    schedule.forEach(function (match) {
        matchNumber = match.matchNumber;
        homeTeam = match.homeTeam;
        awayTeam = match.awayTeam;
        firstName = loginDetails.fName + ' ' + loginDetails.lName;
        selected = returnSelectedValue(req, matchNumber);

        let data = {
            memberId: memberId,
            matchNumber: matchNumber,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            firstName: firstName,
            selected: selected,
            predictedTime: predictedTime,
            matchDay: matchDay
        };

        let sql = "INSERT INTO PREDICTIONS SET ?";

        connection.query(sql, data, (err, results) => {
            if (err) {
                const alert = 'Unable to save predictions';
                res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                return res.redirect('/predictions');
            }
            isPredictionSaveSuccess = true;
        });

    })
    return isPredictionSaveSuccess;
}

exports.saveSinglePredictions = async function saveSinglePredictions(connection, req, matchId, res) {
    let isPredictionSaveSuccess = false;
    let loginDetails = JSON.parse(req.cookies.loginDetails);
    let schedule = req.cookies.schedule;
    if (undefined == schedule) {
        return;
    }

    const memberId = loginDetails.memberId;
    var matchNumber;
    var homeTeam;
    var awayTeam;
    var firstName;
    var selected;
    var amount;
    var predictedTime = new Date();

    schedule.forEach(function (match) {
        matchNumber = match.matchNumber;
        if (matchId == matchNumber) {
            homeTeam = match.homeTeam;
            awayTeam = match.awayTeam;
            firstName = loginDetails.fName + ' ' + loginDetails.lName;
            selected = req.body.selected;
            amount = req.body.amount;

            let data = {
                memberId: memberId,
                matchNumber: matchNumber,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                firstName: firstName,
                selected: selected,
                predictedTime: predictedTime,
                matchDay: match.matchDay,
                amount: amount
            };

            let sql = "INSERT INTO PREDICTIONS SET ?";

            connection.query(sql, data, (err, results) => {
                if (err) {
                    const alert = 'Unable to save predictions';
                    res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    return res.redirect('/predictions');
                }
                isPredictionSaveSuccess = true;
            });
        }

    })
    return isPredictionSaveSuccess;
}

exports.updateSinglePrediction = async function updateSinglePrediction(connection, req, matchId, res) {
    let isPredictionSaveSuccess = false;
    var date = new Date();

    //let sql = "UPDATE PREDICTIONS SET selected='" + req.body.selected + "',amount='" + req.body.amount + "', predictedTime ='" + dateFormat(date, "isoDateTime") + "' where matchNumber = " + matchId;
    let sql = "UPDATE PREDICTIONS SET selected='" + req.body.selected + "',amount='" + req.body.amount + "', predictedTime ='" + dateAndTime.format(date, pattern) + "' where matchNumber = " + matchId;

    connection.query(sql, (err, results) => {
        if (err) {
            const alert = 'Unable to update predictions';
            res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
            return res.redirect('/predictions');
        }
        isPredictionSaveSuccess = true;
    });
    return isPredictionSaveSuccess;
}

exports.mapScheduleToPrediction = function mapScheduleToPrediction(schedule, predictions, req, matchDay) {
    var predictionsList = [];
    if (schedule.length > 0) {
        if (predictions.length > 0) {
            schedule.forEach(game => {
                if (game.matchDay >= matchDay) {
                    if (game.winner == undefined) {
                        var isPredictionFound = false;
                        var userPrediction = {'matchNumber': game.matchNumber};
                        userPrediction.game = game.homeTeam + " vs " + game.awayTeam;
                        predictions.forEach(prediction => {
                            if (game.matchNumber == prediction.matchNumber) {
                                isPredictionFound = true;
                                userPrediction.predictedTime = prediction.predictedTime;
                                userPrediction.selected = prediction.selected;
                                userPrediction.allow = false;
                                userPrediction.homeTeam = game.homeTeam;
                                userPrediction.awayTeam = game.awayTeam;
                                userPrediction.matchDay = game.matchDay;
                                /*userPrediction.deadline = clientTimeZoneMoment(game.deadline, req.cookies.clientOffset);*/
                                userPrediction.deadline = game.deadline;
                                userPrediction.minAmount = game.minAmount;
                                userPrediction.maxAmount = game.maxAmount;
                                userPrediction.amount = prediction.amount;
                                userPrediction.localDate = game.localDate;
                            }
                        });
                        if (!isPredictionFound) {
                            userPrediction.predictedTime = 'N/A';
                            userPrediction.selected = '-';
                            userPrediction.allow = true;
                            userPrediction.matchDay = game.matchDay;
                            /*userPrediction.deadline = clientTimeZoneMoment(game.deadline, req.cookies.clientOffset);*/
                            userPrediction.deadline = game.deadline;
                            userPrediction.amount = 0;
                            userPrediction.matchAmount = game.minAmount;
                            userPrediction.localDate = game.localDate;
                        }
                        predictionsList.push(userPrediction);
                    }
                }
            });
        } else {
            schedule.forEach(game => {
                if (game.matchDay >= matchDay) {
                    var userPrediction = {'matchNumber': game.matchNumber};
                    userPrediction.game = game.homeTeam + " vs " + game.awayTeam;
                    userPrediction.predictedTime = 'N/A';
                    userPrediction.selected = '-';
                    userPrediction.allow = true;
                    userPrediction.matchDay = game.matchDay;
                    /*userPrediction.deadline = clientTimeZoneMoment(game.deadline, req.cookies.clientOffset);*/
                    userPrediction.deadline = game.deadline;
                    userPrediction.minAmount = game.minAmount;
                    userPrediction.maxAmount = game.maxAmount;
                    userPrediction.localDate = game.localDate;
                    predictionsList.push(userPrediction);
                }
            });
        }
    }

    validateDeadline(predictions);
    return predictionsList;
}

function returnSelectedValue(req, matchId) {
    let selectedvalue;
    if (undefined != matchId) {
        if (matchId == 1) {
            selectedvalue = req.body.selected1;
        } else if (matchId == 2) {
            selectedvalue = req.body.selected2;
        } else if (matchId == 3) {
            selectedvalue = req.body.selected3;
        } else if (matchId == 4) {
            selectedvalue = req.body.selected4;
        } else if (matchId == 5) {
            selectedvalue = req.body.selected5;
        } else if (matchId == 6) {
            selectedvalue = req.body.selected6;
        } else if (matchId == 7) {
            selectedvalue = req.body.selected7;
        } else if (matchId == 8) {
            selectedvalue = req.body.selected8;
        } else if (matchId == 9) {
            selectedvalue = req.body.selected9;
        } else if (matchId == 10) {
            selectedvalue = req.body.selected10;
        } else if (matchId == 11) {
            selectedvalue = req.body.selected11;
        } else if (matchId == 12) {
            selectedvalue = req.body.selected12;
        } else if (matchId == 13) {
            selectedvalue = req.body.selected13;
        } else if (matchId == 14) {
            selectedvalue = req.body.selected14;
        }
    }
    return selectedvalue;
}

function clientTimeZoneMoment(date, clientTimeZone) {
    //var format = 'YYYY/MM/DD HH:mm:ss ZZ';
    var format = 'lll';
   /* console.log(mom(date).tz(clientTimeZone).format(format));
    return mom(date).tz(clientTimeZone).format("YYYY-MM-DD HH:mm:ss");*/
    return mom(date).tz(clientTimeZone).format(format);
}

exports.generateClientTimeZone = function generateClientTimeZone(gameWeekSchedule, req){
    //var format = 'YYYY/MM/DD HH:mm:ss ZZ';
    let clientTimeZone = req.cookies.clientOffset;
    gameWeekSchedule.forEach(game => {
        let format = 'lll';
        /*let format = 'MMM DD YYYY, hh:mm:ss A';*/
        let date = new Date(game.deadline);
        game.localDate = mom(date).tz(clientTimeZone).format(format);

        if (game.predictedTime != 'N/A'){
            /*let format = 'MMM DD YYYY, hh:mm:ss A';*/
            let date = new Date(game.predictedTime);
            game.predictedTime = mom(date).tz(clientTimeZone).format(format);
        }
    });
}

exports.generateClientTimeZoneForPredictedTimw = function generateClientTimeZoneForPredictedTimw(gameWeekSchedule, req){
    //var format = 'YYYY/MM/DD HH:mm:ss ZZ';
    let clientTimeZone = req.cookies.clientOffset;
    gameWeekSchedule.forEach(game => {
        if (game.predictedTime != 'N/A'){
            let format = 'MMM DD YYYY, hh:mm:ss A';
            let date = new Date(game.predictedTime);
            game.predictedTime = mom(date).tz(clientTimeZone).format(format);
        }
    });
}

exports.generateClientTimeZoneSingle = function generateClientTimeZoneSingle(deadline, req){
    let clientTimeZone = req.cookies.clientOffset;

        let format = 'lll';
        /*let format = 'MMM DD YYYY, hh:mm:ss A';*/
        let date = new Date(deadline);
        return mom(date).tz(clientTimeZone).format(format);

}


exports.setMatchAmounts = function setMatchAmounts(schedule) {
    if (schedule.length > 0) {
        schedule.forEach(match => {
            let amounts = [];
            let min = match.minAmount;
            let max = match.maxAmount;
            let increment = 50;
            let i;
            for (i = min; i <= max; i + increment) {
                amounts.push(i);
                i = i + increment;
            }
            match.amounts = amounts;

        })
    }
}





