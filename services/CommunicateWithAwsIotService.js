const models = require('../models');
const AWS = require('aws-sdk');
const { getCompany } = require('../cache/Companies');

var communicateWithAwsIot = function (params, company_id, type) {
  return new Promise(async (resolve, reject) => {
    const company = await getCompany(company_id).then(result => {
      return (result);
    }).catch(err => {
      reject(err);
    });
    const iotendpoint = `iot.${company.aws_region}.amazonaws.com`;
    const iotdata = new AWS.IotData({
      endpoint: company.aws_iot_end_point,
      region: company.aws_region,
      accessKeyId: company.aws_iam_access_key,
      secretAccessKey: company.aws_iam_access_secret,
    });
    const iot = new AWS.Iot({
      endpoint: iotendpoint,
      region: company.aws_region,
      accessKeyId: company.aws_iam_access_key,
      secretAccessKey: company.aws_iam_access_secret,
    });
    console.log("AWS-IOT-API-Call", new Date(), type, params)

    if (type == 'getThingShadow') {
      iotdata.getThingShadow(params, async (err, data) => {
        if (err) {
          //console.log("AWS-IOT-API-ERROR", new Date(), type, params, err)
          resolve(null);
        } // an error occurred
        else {
          resolve(data);
        } // successful response
      });
    } else if (type == 'updateThingShadow') {
      iotdata.updateThingShadow(params, async (err, data) => {
        if (err) {
          //console.log("AWS-IOT-API-ERROR", new Date(), type, params, err)
          resolve(null);
        } // an error occurred
        else {
          resolve(data);
        } // successful response
      });
    } else if (type == 'publish') {
      iotdata.publish(params, async (err, data) => {
        if (err) {
          //console.log("AWS-IOT-API-ERROR", new Date(), type, params, err)
          resolve(null);
        } // an error occurred
        else {
          resolve(data);
        } // successful response
      });
    } else if (type == 'listThingsInThingGroup') {
      iot.listThingsInThingGroup(params, async (err, data) => {
        if (err) {
          //console.log("AWS-IOT-API-ERROR", new Date(), type, params, err)
          resolve(null);
        } // an error occurred
        else {
          let things = []
          if (data && data.things) {
            things = data.things
          }
          if (data && data.nextToken) {
            params["nextToken"] = data.nextToken
            // console.log("🚀 ~ iot.listThingsInThingGroup ~ params: communicateWithAwsIot 70", params)
            let gatewaythings = await communicateWithAwsIot(params, company_id, type)
            if (gatewaythings && gatewaythings.things) {
              things = things.concat(gatewaythings.things)
            }
            resolve({ things });
          } else {
            resolve({ things });
          }
        } // successful response
      });
    }
  });
}
var publishJsonUrl = function (company_id, gateway_code, url) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: gateway_code,
    };
    // console.log("🚀 ~ returnnewPromise ~ params: publishJsonUrl 88", params)
    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    let base_key = null;
    let base = null;
    if (shadowData) {
      // gateway shadow not updated
      var payload = JSON.parse(shadowData.payload);
      const { reported } = payload.state; // array
      Object.keys(reported).forEach((key) => {
        if (reported[key].hasOwnProperty('properties')) {
          const { properties } = reported[key];
          base_key = key;
          if (Object.keys(properties).length > 0) {
            base = Object.keys(properties)[0];
          }
        }
      });
    }
    if (base) {
      const baseSplitArray = base.split(':');
      const setJsonUrl = `${baseSplitArray[0]}:sRule:SetJsonURL`;
      var payload = {
        state:
        {
          desired: {},
        },
      };
      payload.state.desired[base_key] = {
        properties:
          {},
      };
      payload.state.desired[base_key].properties[setJsonUrl] = url;
      const topic = `$aws/things/${gateway_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      // console.log("🚀 ~ returnnewPromise ~ params: publishJsonUrl 130", params)
      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          return (data);
        }).catch(err => {
          reject(err);
        });
      // if (publishShadowData) {
      //   return { success: true };
      // }
    };
  });
}

var publishSyncBlockProperty = function (company_id, gateway_code, value) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: gateway_code,
    };
    // console.log("🚀 ~ returnnewPromise ~ params: publishSyncBlockProperty 148", params)
    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    if (shadowData) {
      const property = `premium_app:sync_block`;
      var payload = {
        state:
        {
          reported: {},
        },
      };
      payload.state.reported[property] = JSON.stringify(value);
      const topic = `$aws/things/${gateway_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      // console.log("🚀 ~ returnnewPromise ~ params: publishSyncBlockProperty 168", params)
      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          return (data);
        }).catch(err => {
          reject(err);
        });
      return { success: true };
    }
  })
};

var publishGenScheURL = function (company_id, gateway_code, url) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: gateway_code,
    };
    // console.log("🚀 ~ returnnewPromise ~ params: publishGenScheURL 184", params)

    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    let base_key = null;
    let base = null;
    if (shadowData) {
      // gateway shadow not updated
      var payload = JSON.parse(shadowData.payload);
      const { reported } = payload.state; // array
      Object.keys(reported).forEach((key) => {
        if (reported[key].hasOwnProperty('properties')) {
          const { properties } = reported[key];
          base_key = key;
          if (Object.keys(properties).length > 0) {
            base = Object.keys(properties)[0];
          }
        }
      });
    }
    if (base) {
      const baseSplitArray = base.split(':');
      const setJsonUrl = `${baseSplitArray[0]}:sGenSche:SetGenScheURL`;
      var payload = {
        state:
        {
          desired: {},
        },
      };
      payload.state.desired[base_key] = {
        properties:
          {},
      };
      payload.state.desired[base_key].properties[setJsonUrl] = url;
      const topic = `$aws/things/${gateway_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      // console.log("🚀 ~ returnnewPromise ~ params: publishGenScheURL 226", params)
      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          return (data);
        }).catch(err => {
          reject(err);
        });
      // if (publishShadowData) {
      //   return { success: true };
      // }
    };
  });
}

var publishDeviceName = function (company_id, device_code, property, property_value) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: device_code, /* required */
    };
    // console.log("🚀 ~ returnnewPromise ~ params: publishDeviceName 244", params)
    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    let base_key = null;
    let base = null;

    if (shadowData) {
      var payload = JSON.parse(shadowData.payload);
      const { reported } = payload.state; // array
      if (!reported) {
        return { success: false };
      }
      Object.keys(reported).forEach((key) => {
        if (reported[key].hasOwnProperty('properties')) {
          const { properties } = reported[key];
          base_key = key;
          if (Object.keys(properties).length > 0) {
            base = Object.keys(properties)[0];
          }
        }
      });
    }
    if (base) {
      const baseSplitArray = base.split(':');
      const setProperty = `${baseSplitArray[0]}${property}`;
      var payload = {
        state:
        {
          desired: {},
        },
      };
      payload.state.desired[base_key] = {
        properties:
          {},
      };

      payload.state.desired[base_key].properties[setProperty] = property_value;

      const topic = `$aws/things/${device_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      // console.log("🚀 ~ returnnewPromise ~ params: publishDeviceName 290", params)

      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          resolve(data);
        }).catch(err => {
          reject(err);
        });
    };

  });
}


var publishPropertyValues = function (company_id, device_code, listProperty) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: device_code, /* required */
    };

    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    let base_key = null;
    let base = null;

    if (shadowData) {
      var payload = JSON.parse(shadowData.payload);
      const { reported } = payload.state; // array
      if (!reported) {
        return { success: false };
      }
      Object.keys(reported).forEach((key) => {
        if (reported[key].hasOwnProperty('properties')) {
          const { properties } = reported[key];
          base_key = key;
          if (Object.keys(properties).length > 0) {
            base = Object.keys(properties)[0];
          }
        }
      });
    }

    if (base) {
      const baseSplitArray = base.split(':');
      var payload = {
        state:
        {
          desired: {},
        },
      };

      payload.state.desired[base_key] = {
        properties:
          {},
      };

      for (const [key, value] of Object.entries(listProperty)) {
        if (value != null) {
          payload.state.desired[base_key].properties[key] = value;
        }
      }

      const topic = `$aws/things/${device_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      console.log("🚀 ~ returnnewPromise ~ params: publishPropertyValue 352", params)

      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          // console.log("🚀 ~ file: CommunicateWithAwsIotService.js:310 ~ .then ~ data:", data)
          resolve(data);
        }).catch(err => {
          reject(err);
        });
    };
  });
}

var publishPropertyValue = function (company_id, device_code, property, property_value) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: device_code, /* required */
    };
    // console.log("🚀 ~ returnnewPromise ~ params: publishPropertyValue 306", params)
    const shadowData = await communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => {
        return (data);
      }).catch(err => {
        reject(err);
      });
    let base_key = null;
    let base = null;

    if (shadowData) {
      var payload = JSON.parse(shadowData.payload);
      const { reported } = payload.state; // array
      if (!reported) {
        return { success: false };
      }
      Object.keys(reported).forEach((key) => {
        if (reported[key].hasOwnProperty('properties')) {
          const { properties } = reported[key];
          base_key = key;
          if (Object.keys(properties).length > 0) {
            base = Object.keys(properties)[0];
          }
        }
      });
    }
    if (base) {
      const baseSplitArray = base.split(':');
      const setProperty = property;
      var payload = {
        state:
        {
          desired: {},
        },
      };
      payload.state.desired[base_key] = {
        properties:
          {},
      };

      payload.state.desired[base_key].properties[setProperty] = property_value;

      const topic = `$aws/things/${device_code}/shadow/update`;
      var params = {
        topic,
        payload: JSON.stringify(payload),
      };
      // console.log("🚀 ~ returnnewPromise ~ params: publishPropertyValue 352", params)

      const publishShadowData = await communicateWithAwsIot(params, company_id, 'publish')
        .then((data) => {
          // console.log("🚀 ~ file: CommunicateWithAwsIotService.js:310 ~ .then ~ data:", data)
          resolve(data);
        }).catch(err => {
          reject(err);
        });
    };

  });
}
module.exports = { communicateWithAwsIot, publishJsonUrl, publishDeviceName, publishGenScheURL, publishPropertyValue, publishSyncBlockProperty, publishPropertyValues }
