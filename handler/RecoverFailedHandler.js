const axios = require('axios')
const { cognitoLogin } = require("../services/UserService");
const MAX_RETRY = 3
var createOccupant = function (obj) {
    return new Promise(async (resolve, reject) => {
        // console.log("🚀 ~ file: ServiceApiHandler.js:9 ~ obj:", obj)

        const companyId = obj?.body.company_id
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        const reqObj = {
            body: {
                company_id: companyId
            }
        }

        const AdminData = await cognitoLogin(reqObj, email, password).catch(error => { reject(error) });

        if (!AdminData) {
            Logger.info("_AdminData", "AdminData Not Found");
            reject({ message: "AdminData Not Found" });
        }

        //console.log("🚀 ~ file: ServiceApiHandler.js:9 ~ AdminData:", AdminData)

        const accessToken = AdminData.accessToken;
        const idToken = AdminData.idToken;
        const headerParams = {
            'x-company-code': companyId,
            'x-access-token': accessToken,
            'x-auth-token': idToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        console.info("body", obj.body)
        const userFormObj = obj.body

        if (userFormObj.retry) {
            if (userFormObj.retry >= MAX_RETRY) {
                console.log("🚀 ~ file: ServiceApiHandler.js:22 ~ max-retry:", userFormObj)
                return resolve(null)
            }

            userFormObj.retry = userFormObj.retry + 1
        } else {
            userFormObj.retry = 1
        }
        //console.info("userFormObj", userFormObj)
        axios.post(process.env.SERVICE_API_URL + "v1/occupants/create_occupant", userFormObj,
            {
                mode: 'no-cors',
                headers: headerParams,
                crossDomain: true,
            }).then(async (result) => {
                resolve(result)
            })
            .catch(err => {
                reject(err)
            })
    })
}


module.exports = {
    createOccupant
}