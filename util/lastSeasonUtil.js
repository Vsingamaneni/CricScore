const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

//set views file
app.set('views', path.join(__dirname, 'views'));

//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));


exports.validateUsers = function validateUsers(currentUsers, lastUser) {
    let bothYears = [];
    let thisYear = [];

    if (currentUsers.length > 0) {
        currentUsers.forEach(current => {
            if (isUserPresentInPreviousYear(current, lastUser)) {
                bothYears.push(current);
            } else {
                thisYear.push(current);
            }
        })
    }

    let userDetails = {'last': 'last'};
    userDetails.thisYear = setRank(thisYear);
    userDetails.bothYears = setRank(bothYears);
    userDetails.disCountinued = setRank(discontinuedUsers(currentUsers, lastUser));

    return userDetails;
}

function isUserPresentInPreviousYear(user, lastSeasonUsers) {
    let isUserFound = false;
    if (lastSeasonUsers.length > 0) {
        lastSeasonUsers.forEach(lastUser => {
            if (user.email == lastUser.email) {
                isUserFound = true;
            }
        });
    }
    return isUserFound;
}


function discontinuedUsers(currentUsers, lastSeasonUsers) {
    currentUsers.forEach(current => {
        for (let i = 0; i < lastSeasonUsers.length; i++) {
            lastSeasonUsers[i].fname = lastSeasonUsers[i].fname.toUpperCase();
            lastSeasonUsers[i].lname = lastSeasonUsers[i].lname.toUpperCase();
            if (lastSeasonUsers[i].email === current.email) {
                lastSeasonUsers.splice(i, 1);
            }
        }
    });
    return lastSeasonUsers;
}

function setRank(usersList){
    let count = 1;
    if (usersList.length > 0){
        usersList.forEach(user =>{
           user.rank = count;
           count = count+1;
        });
    }
    return usersList;
}