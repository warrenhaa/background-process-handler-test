const AWS = require('aws-sdk');
const Logger = require('../Logger');
AWS.config.update({
    region: process.env.DYNAMODB_AWS_REGION,
    accessKeyId: process.env.DYNAMODB_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DYNAMODB_AWS_SECRET_ACCESS_KEY
});

let docClient = new AWS.DynamoDB.DocumentClient();

var getFromTable = function (params) {
    return new Promise((resolve, reject) => {

        docClient.scan(params, function (err, data) {
            if (err) {
                Logger.error("Error ", { "error": err.stack })
                reject(err)
            } else {
                if (data.Item) {
                    resolve(data.Item)
                } else if (data.Items) {
                    resolve(data.Items)
                } else {
                    resolve(null)
                }
            }
        });
    })

}

var addToTable = function (params) {
    return new Promise((resolve, reject) => {

        console.log(params)
        // Call DynamoDB to add the item to the table
        docClient.put(params, function (err, data) {
            if (err) {
                console.log("Error", err);
                reject(err)
            } else {
                console.log("Success", data);
                resolve(data)
            }
        });
    })
}

var deleteFromTable = function (params) {
    return new Promise((resolve, reject) => {
        docClient.delete(params, (err, data) => {
            if (err) {
                console.log('Error', err);
                reject(err);
            } else {
                console.log('Success', data);
                resolve();
            }
        });
    });
};

const updateTable = function (params) {
    return new Promise((resolve, reject) => {
        docClient.update(params, (err, data) => {
            if (err) {
                console.log('Error', err);
                reject(err);
            } else {
                console.log('Success', data);
                resolve();
            }
        });
    });
};
module.exports = {
    getFromTable, addToTable, deleteFromTable, updateTable
}