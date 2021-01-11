const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
var mom = require('moment-timezone');
const sortMap = require('sort-map')

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



exports.generateMatchDayPredictions = function generateMatchDayPredictions(users, predictions, match) {
    var predictionsList = [];
    if (predictions.length > 0) {
        if (predictions.length > 0) {
            users.forEach(user => {
                let isPredictionFound = false;
                for (let prediction of predictions) {
                    if (user.memberId == prediction.memberId) {
                        isPredictionFound = true;
                        prediction.firstName = prediction.firstName.toUpperCase();
                        predictionsList.push(prediction);
                    }
                    if (isPredictionFound) {
                        break;
                    }
                }
                if (!isPredictionFound && match.isDeadlineReached) {
                    let addDefault = {'memberId': user.memberId};
                    addDefault.matchNumber = match.matchNumber;
                    addDefault.homeTeam = match.homeTeam;
                    addDefault.awayTeam = match.awayTeam;
                    addDefault.firstName = user.fname.toUpperCase() + " " + user.lname.toUpperCase();
                    addDefault.amount = match.minAmount;
                    addDefault.matchDay = match.matchDay;
                    addDefault.selected = 'Default';
                    predictionsList.push(addDefault);
                }
            });
        }
    }

    return predictionsList;
}

exports.generateMatchDayDetails = function generateMatchDayDetails(loginDetails, users, predictions, schedule, req) {
    let matchDayDetails = {'schedule': schedule};
    let home = schedule.homeTeam;
    let away = schedule.awayTeam;
    let homeTeam = new Map();
    let awayTeam = new Map();
    let currentUserPrediction = null;
    let homeTotal = 0;
    let awayTotal = 0;

    let homeCount = 0;
    let awayCount = 0;
    let defaulters = [];

    schedule.deadline = clientTimeZoneMoment(schedule.deadline, req.cookies.clientOffset);

    let userDetails = {'total': users.length};
    let defaultCount = 0;
    let predicted = 0;

    let userSelected = '';

    if (predictions.length > 0) {
        predictions.forEach(prediction => {
            let amountKey = prediction.amount;
            if (loginDetails.memberId == prediction.memberId){
                currentUserPrediction = prediction;
            }

            if (prediction.selected == home) {
                homeCount = homeCount +1;
                predicted = predicted + 1;
                homeTotal = homeTotal + prediction.amount;
                if (homeTeam.get(amountKey)) {
                    let homeValue = homeTeam.get(amountKey);
                    homeValue.members.push(prediction.firstName);
                    homeValue.count = homeValue.count + 1;
                    homeTeam.set(amountKey, homeValue);
                } else {
                    let homeValue = {'count': 1};
                    homeValue.members = [];
                    homeValue.members.push(prediction.firstName);
                    homeTeam.set(amountKey, homeValue);
                }

            } else if (prediction.selected == away) {
                awayCount = awayCount +1;
                predicted = predicted + 1;
                awayTotal = awayTotal + prediction.amount;
                if (awayTeam.get(amountKey)) {
                    let awayValue = awayTeam.get(amountKey);
                    awayValue.members.push(prediction.firstName);
                    awayValue.count = awayValue.count + 1;
                    awayTeam.set(amountKey, awayValue);
                } else {
                    let awayValue = {'count': 1};
                    awayValue.members = [];
                    awayValue.members.push(prediction.firstName);
                    awayTeam.set(amountKey, awayValue);
                }

            } else if (prediction.selected == 'Default') {
                defaultCount = defaultCount + 1;
                defaulters.push(prediction.firstName);
            }
        });
    }
    userDetails.predicted = predicted;
    userDetails.defaultCount = defaultCount;
    matchDayDetails.userDetails = userDetails;
    matchDayDetails.defaulters = defaulters;


    if (schedule.isDeadlineReached) {
        if (currentUserPrediction.selected == schedule.homeTeam) {
            userSelected = 'home';
        } else if (currentUserPrediction.selected == schedule.awayTeam) {
            userSelected = 'away';
        } else if (currentUserPrediction.selected == 'Default'){
            userSelected = 'default';
        }

        let isHomeSelection = userSelected == 'home' ? true : false;
        let adminFees = 0;
        let homeTeamPrice = (defaultCount * schedule.minAmount) + awayTotal;
        adminFees = Number((homeTeamPrice * 0.05).toFixed(2));
        if (loginDetails.role == 'admin') {
            matchDayDetails.homeTeamWinFees = adminFees;
        }
        homeTeamPrice = homeTeamPrice - adminFees;
        for (const [key, value] of homeTeam.entries()) {
            value.winning = Number(((key / homeTotal) * homeTeamPrice).toFixed(2));

            if (isHomeSelection && currentUserPrediction.amount == key) {
                currentUserPrediction.winning = value.winning;
            }
        }

        let isAwaySelection = userSelected == 'away' ? true : false;
        let awayTeamPrice = (defaultCount * schedule.minAmount) + homeTotal;
        adminFees = Number((awayTeamPrice * 0.05).toFixed(2));
        if (loginDetails.role == 'admin') {
            matchDayDetails.awayTeamWinFees = adminFees;
        }
        awayTeamPrice = awayTeamPrice - adminFees;
        for (const [key, value] of awayTeam.entries()) {
            value.winning = Number(((key / awayTotal) * awayTeamPrice).toFixed(2));

            if (isAwaySelection && currentUserPrediction.amount == key) {
                currentUserPrediction.winning = value.winning;
            }
        }

        if (userSelected == 'default'){
            currentUserPrediction.matchNumber = schedule.matchNumber;
            currentUserPrediction.firstName = loginDetails.fName.toUpperCase() + " " + loginDetails.lName.toUpperCase();
            currentUserPrediction.selected = 'Default';
            currentUserPrediction.amount = -schedule.minAmount;
            currentUserPrediction.winning = 'N/A';
        }
    }

    schedule.homeCount = homeCount;
    schedule.awayCount = awayCount;

    matchDayDetails.homeTeam = sortMap(homeTeam);
    matchDayDetails.awayTeam = sortMap(awayTeam);
    matchDayDetails.currentUserPrediction = currentUserPrediction;
    matchDayDetails.predictions = predictions;

    return matchDayDetails;
}

function clientTimeZoneMoment(date, clientTimeZone) {
    var format = 'lll';
     return mom(date).tz(clientTimeZone).format(format);
}