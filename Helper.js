
const { v4: uuidV4 } = require('uuid')
const crypto = require('crypto');
const JSON5 = require('json5')
const getRandomString = function () {
    var uid = uuidV4();
    var rval = uid.toString();
    return rval;
}

const sleep = function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

var isValidJSON = async function (text){
    try{
        JSON5.parse(text);
        return true;
    }
    catch (error){
        return false;
    }
}

module.exports = { getRandomString, sleep, isValidJSON }