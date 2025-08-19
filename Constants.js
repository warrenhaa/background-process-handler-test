var {data} = require('./services/Constants');
var Constant = function (key) {
    return new Promise(async (resolve, reject) => {
      var constants = await data(key).then(result => {
            return (result);
        }).catch(err => {  
            reject(err)
        })
        resolve(constants)
    })
}
module.exports = { Constant };
