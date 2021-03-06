const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require("express-session");
var jstz = require('jstz');



// Routes for different api's
var userSession = require('./user');
var schedule = require('./schedule');
var predictions = require('./predictions');
var adminAction = require('./adminActions');
var resultAction = require('./resultActions');
var lastSeason = require('./lastSeason');

var db = require('./db');

const app = express();

app.locals.jstz = jstz;

app.use(cookieParser());
app.use(session({
  secret: 'AKe5OCBbfC',
  resave: true,
  saveUninitialized: false,
  cookie: { secure: true }
}));

module.exports = app;

var connection = db.dbConnection();

connection.connect(function(error){
    if(!!error) console.log(error);
    else console.log('Database Connected!');
}); 

//set views file
app.set('views',path.join(__dirname,'views'));
			
//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));


// User login and register Routes
//app.get('/', userSession.login);
app.get('/login', userSession.login);
app.get('/register', userSession.register);
app.get('/forget', userSession.forgetPass);
app.get('/users', userSession.usersList);
app.get('/activate/:memberId', userSession.activateMember);
app.get('/deActivate/:memberId', userSession.deActivateMember);
app.post('/userLogin', userSession.userLogin);
app.post('/registerSave', userSession.registerUser);
app.post('/retrieveUser', userSession.retrieveUser);
app.post('/validateSecurity', userSession.validateSecurityAnswer);
app.post('/updatePass', userSession.updatePassword);


// Schedule routes
app.get('/schedule', schedule.schedule);
app.get('/dashboard', schedule.dashboard);
app.get('/setcookie', schedule.setCookie);
app.get('/getcookie', schedule.getCookie);
app.get('/logout', schedule.removeCookie);

// Prediction routes
app.get('/predictions', predictions.predictions);
app.get('/viewPredictions', predictions.viewPredictions);
app.get('/predict/:matchNumber/:memberId/:matchDay/:type', predictions.predict);
app.get('/predictGame/:matchNumber/:memberId/:matchDay/:type', predictions.predictPerGame);
app.get('/updatePredictions/', predictions.updatePredictions);
app.get('/matchDayPredictions', predictions.matchDayPredictions);
app.get('/updatePredictions/:matchNumber/:memberId/:matchDay/:type', predictions.updatePredictions);
app.post('/updatePredictions/:matchNumber/:memberId/:matchDay/:type', predictions.updatePredictionsPost);
app.post('/savePredictions/:matchNumber/:memberId/:matchDay/:type', predictions.saveSinglePredictions);
app.post('/updateSinglePredictions/:matchNumber/:memberId/:matchDay/:type', predictions.updateSinglePredictions);

// Admin Action Routes
app.get('/updateResult', adminAction.updateResult);
app.post('/updateMatchResult/:matchNumber', adminAction.updateMatchResult);

// Result consolidation actions
app.get('/standings', resultAction.standings);
app.get('/history/:memberId', resultAction.history);

// Previous Season
app.get('/previousUsers', lastSeason.previousUsers);
app.get('/previousStandings', lastSeason.previousStandings);

app.get('/users',(req, res) => {
    //res.send('Hello There');
    let sql = "SELECT * FROM users";
    let query = connection.query(sql, (err, rows) => {
        if(err) throw err;
        res.render('schedule/user_index_nav', {
            title : 'DB Operations',
            users : rows,
            team : 'RR'
        });
    });
});


app.get('/',(req, res) => {
    let sql = "SELECT * FROM users";
    let query = connection.query(sql, (err, rows) => {
        if(err) throw err;
        res.render('user_index', {
            title : 'DB Operations',
            users : rows
        });
    });
});
app.get('/add',(req, res) => {
    res.render('user_add', {
        title : 'DB Operations'
    });
});

app.post('/save',(req, res) => { 
    let data = {name: req.body.name, email: req.body.email, phone_no: req.body.phone_no};
    let sql = "INSERT INTO users SET ?";
    let query = connection.query(sql, data,(err, results) => {
      if(err) throw err;
      res.redirect('/');
    });
});

app.get('/edit/:userId',(req, res) => {
    const userId = req.params.userId;
    let sql = `Select * from users where id = ${userId}`;
    let query = connection.query(sql,(err, result) => {
        if(err) throw err;
        res.render('user_edit', {
            title : 'DB Operations',
            user : result[0]
        });
    });
});


app.post('/update',(req, res) => {
    const userId = req.body.id;
    let sql = "update users SET name='"+req.body.name+"',  email='"+req.body.email+"',  phone_no='"+req.body.phone_no+"' where id ="+userId;
    let query = connection.query(sql,(err, results) => {
      if(err) throw err;
      res.redirect('/');
    });
});


app.get('/delete/:userId',(req, res) => {
    const userId = req.params.userId;
    let sql = `DELETE from users where id = ${userId}`;
    let query = connection.query(sql,(err, result) => {
        if(err) throw err;
        res.redirect('/');
    });
});


app.get('*',function (req, res) {
    console.log('I am here');
    res.redirect('/login');
});

// Server Listening
app.listen(8081, () => {
    console.log('Server is running at port 8081');
});