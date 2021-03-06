const path = require('path');
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
let resultUtils = require('./util/resultsUtil');
let adminUtils = require('./util/adminUtils');
var db = require('./db');

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

exports.standings = app.get('/standings', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            let standings = await resultUtils.getStandings(connection, loginDetails, req);

            res.render('results/standings', {
                title: 'Standings ',
                loginDetails: loginDetails,
                standings: standings
            });
        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.log('error processing schedule', e);
        res.redirect('/login');
    }
});

exports.history = app.get('/history/:memberId', async (req, res) => {
    try {
        if (req.cookies.loginDetails) {
            let loginDetails = JSON.parse(req.cookies.loginDetails);
            let memberId = req.params.memberId;
            let standings = await resultUtils.getHistory(connection, memberId);
            let isAdmin = loginDetails.memberId == memberId && loginDetails.role == 'admin' ? true : false;

            let userName = undefined;
            if (standings.length > 0){
                userName = standings[0].name.toUpperCase();
            }

            let standingsTotal;
            let adminTotal
            if (isAdmin){
                let results = await resultUtils.getResults(connection);
                adminUtils.resultsMapToHistory(results, standings);

                standingsTotal = await resultUtils.getOperatingTotal(connection);
                adminTotal = await resultUtils.getAdminTotal(connection);
                adminTotal.net = standingsTotal.won + standingsTotal.lost + adminTotal.admin;

            }

            res.render('results/history', {
                title: 'History',
                loginDetails: loginDetails,
                standings: standings,
                userName: userName,
                isAdmin: isAdmin,
                standingsTotal: standingsTotal,
                adminTotal: adminTotal
            });
        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.log('error processing schedule', e);
        res.redirect('/login');
    }
});