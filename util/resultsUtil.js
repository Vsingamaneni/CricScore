const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
var mom = require('moment-timezone');
var dateFormat = require('dateformat');
const dateAndTime = require('date-and-time');
const pattern = dateAndTime.compile('MMM DD YYYY, hh:mm:ss A');
let userList = require('./users');

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

// DB functions
// Group and retrieve the standings from Database.
exports.getStandings = async function getStandings(connection, loginDetails, req) {

    let sql = `SELECT memberId, name, sum(wonAmount) as won, sum(lostAmount) as lost, sum(wonAmount)+sum(lostAmount) AS net from STANDINGS GROUP BY memberId, name ORDER BY net DESC;`;

    let users = await userList.userDetails(connection, req);
    let standings = [];
    let rank = 1;
    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (standing) {
                        users.forEach(user => {
                            if (user.memberId == standing.memberId) {
                                if (user.isActive) {
                                    standing.status = 'ACTIVE';
                                } else {
                                    standing.status = 'INACTIVE'
                                }
                            }
                        });
                        standing.rank = rank;
                        if (loginDetails.memberId == standing.memberId) {
                            standing.active = true;
                        } else {
                            standing.active = false;
                        }
                        standings.push(standing);
                        rank = rank + 1;
                    });
                    resolve(standings);
                } else {
                    resolve(standings);
                }
            }
        });
    });

    return standings;
}

exports.getOperatingTotal = async function getOperatingTotal(connection) {

    let sql = `SELECT sum(wonAmount) as won, sum(lostAmount) as lost from STANDINGS`;
    let standingsTotal = {'a': 123};

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (standing) {
                        standingsTotal.won = standing.won;
                        standingsTotal.lost = standing.lost;
                        resolve(standingsTotal);
                    });
                } else {
                    resolve(standingsTotal);
                }
            }
        });
    });

    return standingsTotal;
}

exports.getAdminTotal = async function getAdminTotal(connection) {

    let sql = `SELECT sum(adminAmount) as adminAmount from RESULTS`;
    let adminTotal = {'a': 123};

    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (standing) {
                        adminTotal.admin = standing.adminAmount;
                        resolve(adminTotal);
                    });
                } else {
                    resolve(adminTotal);
                }
            }
        });
    });

    return adminTotal;
}

exports.getHistory = async function getHistory(connection, id) {

    let sql = `select * from STANDINGS where memberId = ` + id;
    let userStandings = [];
    let net = 0;
    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (standing) {
                        net = standing.wonAmount + standing.lostAmount + net;
                        if (standing.wonAmount != 0) {
                            standing.result = 'won';
                            standing.net = standing.wonAmount;
                        } else if (standing.lostAmount != 0) {
                            standing.result = 'lost';
                            if (standing.selected == 'Default') {
                                standing.result = 'default';
                            }
                            standing.net = standing.lostAmount;
                        }

                        standing.net = net.toFixed(2);

                        standing.net = Number(Math.round(net + 'e2') + 'e-2');

                        userStandings.push(standing);
                    });
                    resolve(userStandings);
                } else {
                    resolve(userStandings);
                }
            }
        });
    });

    return userStandings;
}

exports.getResults = async function getResults(connection) {

    let sql = `select * from RESULTS`;
    let matchResults = [];
    let net = 0;
    await new Promise((resolve, reject) => {
        connection.query(sql, function (err, results) {
            if (err) {
                reject(err);
            } else {

                if (results.length > 0) {
                    results.forEach(function (matchResult) {
                        net = matchResult.adminAmount + net;
                        matchResult.net = net;
                        matchResults.push(matchResult);
                    });
                    resolve(matchResults);
                } else {
                    resolve(matchResults);
                }
            }
        });
    });

    return matchResults;
}

// Helper Functions
/*
exports.mapUserDetails = function mapUserDetails(standings, loginDetails){

    if (standings.length >0){
        standings.forEach(standing => {
           if (loginDetails.memberId == standing.memberId){
               standing.active = true;
           }
        });
    }
}*/
