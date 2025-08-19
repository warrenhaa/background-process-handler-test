const CommunicateWithAwsIotService = require('../services/CommunicateWithAwsIotService');
const models = require('../models');
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const { setInCache, getOneFromCache, deleteFromCache, deleteFromCacheUsingKey } = require('../cache/Cache');
const axios = require('axios');
const e = require('express');
const { getCompany } = require('../cache/Companies');
var GOOGLE_MAP_KEY = process.env.GOOGLE_MAP_KEY
var WEATHER_API_KEY = process.env.WEATHER_API_KEY
var companyId = null

var getZipCode = async function (shadowData) {
    let zipCode = null
    let payload = JSON.parse(shadowData.payload);
    let appDatacValue = null
    const { reported } = payload.state; // array
    const { connected } = reported;
    Object.keys(reported).forEach(async (key) => {
        if (reported[key].hasOwnProperty('properties')) {
            const { properties } = reported[key];
            base_key = key;
            if (Object.keys(properties).length > 0) {
                appDatac = Object.keys(properties).filter((name) => name.endsWith(":sZDOInfo:AppData_c"));
                let appDatacValueTmp = properties[appDatac[0]];
                try {
                    if (appDatacValueTmp) {
                        appDatacValue = JSON.parse(appDatacValueTmp)
                        if (appDatacValue && appDatacValue.addr) {
                            if (appDatacValue.addr.zip) {
                                zipCode = appDatacValue.addr.zip
                                return zipCode
                            }
                        }
                    }

                } catch (error) {
                    console.log("🚀 ~ file: SunsetSunriseHandler.js:40 ~ Object.keys ~ error:", error)
                }

            }
        }
    });
    return zipCode;
}
var getLatLongFromShadow = async function (shadowData) {
    let zipCode = null
    let payload = JSON.parse(shadowData.payload);
    let appDatacValue = null
    const { reported } = payload.state; // array
    const { connected, cloud_metadata_latitude, cloud_metadata_longitude } = reported;
    if (cloud_metadata_latitude && cloud_metadata_longitude) {
        return {
            lat: cloud_metadata_latitude,
            lng: cloud_metadata_longitude
        };
    } else {
        return null
    }
}
var getLatLong = async function (zipCode) {
    let latlong = null
    latlong = await client.geocode({
        params: {
            address: zipCode || '590006',
            key: GOOGLE_MAP_KEY,
        },
    }).then((result) => {
        if (result.data.results && result.data.results.length > 0) {
            let locationData = result.data.results[0]
            latlong = locationData.geometry.location
            return latlong;
        } else {
            return null
        }
    }).catch((e) => {
        console.log(e.response.data.error_message);
    });
    return latlong;
}
var get_next_suntime = function (currentTimestamp, sunriseTimeUtc) {
    let suntime_timestamp = parseInt(sunriseTimeUtc)
    if (suntime_timestamp > currentTimestamp) {
        return suntime_timestamp
    } else {
        return suntime_timestamp + 24 * 60 * 60
    }



}
var getSunsetSunriseTime = async function (latlong) {
    let url = "https://api.weather.com/v3/wx/observations/current"
    url = url + "?geocode=" + latlong.lat + "," + latlong.lng + "&units=m&language=en-US&format=json&apiKey=" + WEATHER_API_KEY
    let sunriseTimestamp = null
    let sunsetTimestamp = null
    await axios.get(url, {},
        {
            mode: 'no-cors',
            headers: { 'cache-control': "no-cache" },
            crossDomain: true,
        }).then(async (result) => {
            // console.log("🚀 ~ getSunsetSunriseTime ~ result:", result)
            if (result && result.data) {
                let currentTimestamp = Date.now()
                sunriseTimestamp = get_next_suntime(currentTimestamp, (result.data["sunriseTimeUtc"]))
                sunsetTimestamp = get_next_suntime(currentTimestamp, (result.data["sunsetTimeUtc"]))
            }
            return {
                sunriseTimestamp,
                sunsetTimestamp
            }
        }).catch(error => {
            console.log("🚀 ~ file: SunsetSunriseHandler.js:77 ~ getSunsetSunriseTime ~ error:", error)
        })
    return {
        sunriseTimestamp,
        sunsetTimestamp
    }
}
var getrecords = async function (limit, page, recordList) {
    const offset = limit * page
    const PSQL_QUERY = `select D1.device_code, D1.latlong,  D2.device_code as coordinator_device_code from devices as D1 join devices as D2 on D2.gateway_id = D1.id where D1.status='online' and D1.type = 'gateway' and D2.type = 'coordinator_device' order by D1.created_at asc limit :limit offset :offset`;
    // Execute the PSQL query
    const data_status = await models.sequelize.query(PSQL_QUERY,
        {
            raw: true,
            replacements: {
                limit: limit,
                offset: offset,
            }
        }).catch(err => {
            reject(err);
        });
    const data = data_status[0] || [];
    if (data.length > 0) {
        page++;
        const data2 = await getrecords(limit, page, data);
        if (data2.length > 0) {
            recordList = recordList.concat(data2);

        }
    }
    return (recordList);
}


var publishOnGateway = function (device_code, coordinator_device_code, latlong) {
    return new Promise(async function (resolve, reject) {
        // console.log("message", message)
        let deviceCode = device_code
        let coordinatorDeviceCode = coordinator_device_code
        let params = {
            thingName: deviceCode, /* required */
        };
        const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        companyId = company.id;
        // add code here for check shadow
        if (!latlong) {
            // add code here for check shadow
            let shadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, companyId, 'getThingShadow');
            if (shadowData && shadowData.payload) {
                latlong = await getLatLongFromShadow(shadowData)
                if (latlong) {
                    await models.devices.update({
                        latlong: latlong
                    }, {
                        where: {
                            device_code: device_code
                        }
                    })
                }
            }
        }
        if (latlong) {
            // console.log("🚀 ~ latlong:", latlong)
            let suntimeTimestamp = await getSunsetSunriseTime(latlong).catch(err => {
                console.log("🚀 ~ SunsetSunriseInfo ~ err:", err)
            })
            if (suntimeTimestamp) {
                // console.log("🚀 ~ suntimeTimestamp:", suntimeTimestamp)
                let SunsetSunRise = {
                    "ep0:sGateway:SetSunrise": null,
                    "ep0:sGateway:SetSunset": null
                }
                let sendSunsetSunrise = false;

                if (suntimeTimestamp.sunriseTimestamp) {
                    // console.log("🚀 ~ suntimeTimestamp.sunriseTimestamp: publishOnGateway 177 ", suntimeTimestamp.sunriseTimestamp)
                    SunsetSunRise["ep0:sGateway:SetSunrise"] = suntimeTimestamp.sunriseTimestamp.toString();
                    sendSunsetSunrise = true;
                }

                if (suntimeTimestamp.sunsetTimestamp) {
                    // console.log("🚀 ~ suntimeTimestamp.sunsetTimestamp: publishOnGateway 181", suntimeTimestamp.sunsetTimestamp)
                    SunsetSunRise["ep0:sGateway:SetSunset"] = suntimeTimestamp.sunsetTimestamp.toString();
                    sendSunsetSunrise = true;
                }

                if (sendSunsetSunrise) {
                    await CommunicateWithAwsIotService.publishPropertyValues(companyId, deviceCode, SunsetSunRise).catch(err => {
                        console.log("🚀 ~ SunsetSunriseInfo ~ err:", err)
                    });
                }


                // console.log("SunsetSunriseInfo", "Published ep0:sGateway:SetSunrise ep0:sGateway:SetSunset", deviceCode, coordinatorDeviceCode)
            } else {
                console.log("SunsetSunriseInfo", "suntimeTimestamp not found", deviceCode, coordinatorDeviceCode, latlong)
            }
        } else {
            console.log("SunsetSunriseInfo", "latlong not found", deviceCode, coordinatorDeviceCode)
        }
        // } else {
        //     console.log("SunsetSunriseInfo", "Shadow not found", deviceCode, coordinatorDeviceCode)
        // }
        resolve()
    })
}

var manage = function () {
    return new Promise(async function (resolve, reject) {
        let message = await getrecords(5000, 0, []);
        if (message.length > 0) {
            const batchSize = 500;
            const delay = 30000; // 30 seconds
            let index = 0;

            function processBatch() {
                const batch = message.slice(index, index + batchSize);
                let promises = [];

                for (let item of batch) {
                    let data = item;
                    promises.push(publishOnGateway(data.device_code, data.coordinator_device_code, data.latlong));
                }

                Promise.all(promises).then((results) => {
                    index += batchSize;
                    if (index < message.length) {
                        setTimeout(processBatch, delay);
                    } else {
                        resolve(results);
                    }
                }).catch(error => {
                    reject(error);
                });
            }

            processBatch();
        } else {
            resolve();
        }
    });
};
module.exports = {
    manage
}
