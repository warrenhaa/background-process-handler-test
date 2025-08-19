const axios = require('axios')
const { sleep } = require('../Helper')
var deviceProvison = function (headerParams, form, tryCount) {
    return new Promise((resolve, reject) => {
        axios.post(process.env.DEVICE_PROVISION_URL, form,
            {
                mode: 'no-cors',
                headers: headerParams,
                crossDomain: true,
            }).then(async (result) => {
                if (result && result.data && result.data.statusCode == 408 && tryCount <= 10) {
                    await sleep(5000)
                    // if (result.data.body == '"Resource Busy!"') {
                    tryCount = tryCount + 1
                    await deviceProvison(headerParams, form, tryCount).then((result) => {
                        resolve(result);
                    }).catch((err) => {
                        reject(err);
                    });
                    // } else {
                    //     resolve(result)
                    // }
                } else {
                    resolve(result)
                }
            })
            .catch(err => {
                reject(err)
            })
    })
}

var adminSetup = function (headerParams, form, tryCount) {
    return new Promise((resolve, reject) => {
        axios.post(process.env.ADMIN_SETUP_URL, form,
            {
                mode: 'no-cors',
                headers: headerParams,
                crossDomain: true,
            }).then(async (result) => {
                if (result && result.data && result.data.statusCode == 408 && tryCount <= 3) {
                    await sleep(5000)
                    if (result.data.body == '"Resource Busy!"') {
                        tryCount = tryCount + 1
                        await adminSetup(headerParams, form, tryCount)
                    } else {
                        resolve(result)
                    }
                } else {
                    resolve(result)
                }
            })
            .catch(err => {
                reject(err)
            })
    })
}

module.exports = {
    deviceProvison,
    adminSetup
}