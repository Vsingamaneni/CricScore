const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
var mom = require('moment-timezone');
let predictionUtils = require('./PredictionUtil');

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


exports.processUpdateResult = async function processUpdateResult(connection, matchDayDetails, winner, req, res) {
    let allOperationsDone = false;
    // Get All the predictions -> Transform to standings and set the amount won vs amount loss
    let currentMatchDetails = matchDayDetails[0];
    let schedule = currentMatchDetails.schedule;

    let standingsUpdateStatus = await updateStandings(connection, generateStandings(winner, currentMatchDetails), schedule, winner, res);

    // Update Schedule with result and update the isActive= false;
    let scheduleUpdateStatus = await updateSchedule(connection, schedule, winner, res);

    // Update the result with the new record and add the admin fees.
    let adminAmount = 0;
    if (schedule.homeTeam == winner) {
        adminAmount = currentMatchDetails.homeTeamWinFees;
    } else if (schedule.awayTeam == winner) {
        adminAmount = currentMatchDetails.awayTeamWinFees;
    }

    let isResultUpdated = await updateResult(connection, schedule, winner, adminAmount, res);

    // Update the next match to become active if required.
    let scheduleCount = await predictionUtils.getMatchdaySchedule(connection, schedule.matchDay, req);
    let isMatchDayUpdate;
    if (scheduleCount.length == 0) {
        isMatchDayUpdate = await updateMatchday(connection, schedule.matchDay + 1, res);
    } else {
        isMatchDayUpdate = true;
    }

    if (standingsUpdateStatus && scheduleUpdateStatus && isResultUpdated && isMatchDayUpdate) {
        return true;
    }

    return false;
}

function generateStandings(winner, currentMatchDetails) {
    let standings = [];
    let schedule = currentMatchDetails.schedule;
    let predictions = currentMatchDetails.predictions;
    let winningAmounts;

    if (schedule.homeTeam == winner) {
        winningAmounts = currentMatchDetails.homeTeam;
    } else if (schedule.awayTeam == winner) {
        winningAmounts = currentMatchDetails.awayTeam;
    }

    if (winner == schedule.homeTeam || winner == schedule.awayTeam) {
        predictions.forEach(prediction => {
            prediction.name = prediction.firstName;
            if (prediction.selected == winner) {
                for (const [key, value] of winningAmounts.entries()) {
                    if (prediction.amount == key) {
                        prediction.wonAmount = value.winning;
                    }
                }
                prediction.lostAmount = 0;
            } else {
                prediction.wonAmount = 0;
                prediction.lostAmount = -prediction.amount;
            }
            standings.push(prediction);
        })
    } else {
        // Match is draw.
        predictions.forEach(prediction => {
            prediction.name = prediction.firstName;
            prediction.wonAmount = 0;
            prediction.lostAmount = 0;
            standings.push(prediction);
        });
    }

    return standings;
}

async function updateStandings(connection, standings, schedule, matchWinner, res) {
    let isStandingSaveSuccess = false;

    let memberId;
    let matchNumber = schedule.matchNumber;
    let homeTeam = schedule.homeTeam;
    let awayTeam = schedule.awayTeam;
    let name;
    let selected;
    let amount;
    let wonAmount;
    let lostAmount;
    let matchDay = schedule.matchDay;

    for (const match of standings) {
        memberId = match.memberId;
        name = match.name;
        selected = match.selected;
        wonAmount = match.wonAmount;
        lostAmount = match.lostAmount;
        amount = match.amount;

        let data = {
            memberId: memberId,
            matchNumber: matchNumber,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            name: name,
            selected: selected,
            amount: amount,
            winner: matchWinner,
            wonAmount: wonAmount,
            lostAmount: lostAmount,
            matchDay: matchDay
        };

        let sql = "INSERT INTO STANDINGS SET ?";

        await new Promise((resolve, reject) => {
            connection.query(sql, data, (err, results) => {
                if (err) {
                    let alert = [];
                    alert.push('Unable to save standing');
                    res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                    isStandingSaveSuccess = false;
                    reject(false);
                }
                isStandingSaveSuccess = true;
                resolve(true);
            });
        });

    }
    return isStandingSaveSuccess;
}

async function updateSchedule(connection, schedule, winner, res) {
    let isUpdateScheduleSuccess = false;
    let sql = "update SCHEDULE set winner='" + winner + "' , isActive = false where matchNumber = " + schedule.matchNumber;
    await new Promise((resolve, reject) => {
        connection.query(sql, (err, results) => {
            if (err) {
                let alert = []
                alert.push('Unable to update schedule');

                res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                reject(false);
            }
            isUpdateScheduleSuccess = true;
            resolve(true);
        });
    });
    return isUpdateScheduleSuccess;
}

async function updateResult(connection, schedule, matchWinner, adminAmount, res) {
    let isResultUpdated = false;
    let sql = "INSERT INTO RESULTS SET ?";

    let data = {
        matchNumber: schedule.matchNumber,
        homeTeam: schedule.homeTeam,
        awayTeam: schedule.awayTeam,
        deadline: schedule.deadline,
        winner: matchWinner,
        adminAmount: adminAmount,
        matchDay: schedule.matchDay
    };
    await new Promise((resolve, reject) => {
        connection.query(sql, data, (err, results) => {
            if (err) {
                let alert = [];
                alert.push('Unable to save Result');
                res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                isResultUpdated = false;
                reject(false);
            }
            isResultUpdated = true;
            resolve(true);
        });
    });
    return isResultUpdated;
}

async function updateMatchday(connection, matchDay, res) {
    let isUpdateSuccess = false;
    let sql = "update SCHEDULE set isActive= true where matchDay =" + matchDay;
    await new Promise((resolve, reject) => {
        connection.query(sql, (err, results) => {
            if (err) {
                let alert = [];
                alert.push('Unable to update schedule with MatchDay');
                res.cookie('alert', alert, {expires: new Date(Date.now() + 60 * 60000), httpOnly: true});
                isUpdateSuccess = false;
                reject(false);
            }
            isUpdateSuccess = true;
            resolve(true);
        });
    });
    return isUpdateSuccess;
}

exports.resultsMapToHistory = function resultsMapToHistory(results, standings){
    if (standings.length > 0 && results.length >0 ){
        standings.forEach(standing => {
            results.forEach(result => {
                if (standing.matchNumber == result.matchNumber){
                    standing.adminAmount = result.adminAmount;
                    standing.adminNet = result.net;
                }
            });
        });
    }
}

