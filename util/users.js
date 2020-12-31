const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

//set views file
app.set('views',path.join(__dirname,'views'));

//set view engine
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + '/public'));
app.use('/public', express.static('public'));

exports.userDetails = async function getUserDetails(connection, req){
    let sql = `Select * from REGISTER`;
    return await new Promise( (resolve,reject) => {
        connection.query(sql, function(err, results) {
            if(err){
                reject(err);
            } else {
                let users = [];
                if (results.length > 0){
                    results.forEach(function(item) {
                        let loginDetails = JSON.parse(req.cookies.loginDetails);
                        if (loginDetails.memberId == item.memberId){
                            item.current = true;
                        } else {
                            item.current = false;
                        }
                        users.push(item);
                    });
                    resolve(users);
                } else {
                    resolve(users);
                }
            }
        });
    });
}

exports.activateUser = async function activateUser(connection, memberId){
    let sql = "Update REGISTER set isActive = true , isAdminActivated = true where memberId = "+ memberId;
    return await new Promise( (resolve,reject) => {
        connection.query(sql, function(err, results) {
            if(err){
                reject(err);
            } else {
                if (results.affectedRows > 0){
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });
}

exports.deActivateUser = async function deActivateUser(connection, memberId){
    let sql = "Update REGISTER set isActive = false where memberId = "+ memberId;
    return await new Promise( (resolve,reject) => {
        connection.query(sql, function(err, results) {
            if(err){
                reject(err);
            } else {
                if (results.affectedRows > 0){
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });
}