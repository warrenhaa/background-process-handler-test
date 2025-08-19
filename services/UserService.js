const models = require('../models');
const AWS = require('aws-sdk');
var Constants = require('../Constants');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const { getCompany } = require('../cache/Companies');


var cognitoLogin = function (req, email, password) {
    return new Promise(async (resolve, reject) => {
        const companyId = req.body.company_id;
        //console.log("🚀 ~ file: UserService.js:9 ~ companyId:", companyId)
        const AwsConstants = await getAWSDetailsFromCompanyId(companyId);
        //console.log("🚀 ~ file: UserService.js:10 ~ AwsConstants:", AwsConstants)

        AWS.config.update({
            region: AwsConstants.aws_region,
            accessKeyId: AwsConstants.aws_iam_access_key,
            secretAccessKey: AwsConstants.aws_iam_access_secret,
        });
        const poolData = {
            UserPoolId: AwsConstants.userPoolId, // Your user pool id here
            ClientId: AwsConstants.aws_cognito_userpool_web_client_id, // Your client id here
        };

        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        //console.log("🚀 ~ file: UserService.js:12 ~ userPool:", userPool)
        try {
            const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: email,
                Password: password,
            });
            const userData = {
                Username: email,
                Pool: poolData,
                Pool: userPool,
            };
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
            cognitoUser.authenticateUser(authenticationDetails, {
                async onSuccess(result) {
                    const accessToken = result.getAccessToken().getJwtToken();
                    const idToken = result.getIdToken().getJwtToken();

                    const getId = function (idToken1) {
                        return new Promise((resolve1, reject1) => {
                            const params = {
                                IdentityPoolId: AwsConstants.aws_cognito_identity_pool,
                                AccountId: process.env.ACCOUNT_ID,
                                Logins: {},
                            };
                            params.Logins['cognito-idp.' + AwsConstants.aws_region + '.amazonaws.com/' + AwsConstants.userPoolId] = idToken1
                            new AWS.CognitoIdentity().getId(params, (err, data) => {
                                if (err) {
                                    reject1(err);
                                } else {
                                    resolve1(data);
                                }
                            });
                        });
                    };
                    await getId(idToken)
                        .then(async (result2) => {
                            const { sub } = result.idToken.payload;
                            const identityId = result2.IdentityId;

                            resolve({
                                accessToken, identityId, idToken, // returning access token and identity id
                            });
                        })
                        .catch((err) => {
                            reject(err);
                        });
                },
                onFailure(err) {
                    console.log("🚀 ~ file: UserService.js:14 ~ onFailure ~ err:", err)
                    reject(err);
                },

            });
        } catch (error) {
        }
    });
}

var getAWSDetailsFromCompanyId = async function (companyId) {
    return new Promise(async (resolve, reject) => {
        let company = null;
        //  company = await getOneFromCache(Constants.COMPANIES, companyId);
        if (!company) {
            const companyData = await getCompany(companyId).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            company = companyData;
        }
        const awsDetails = {};
        awsDetails.userPoolId = company.aws_cognito_user_pool;
        awsDetails.aws_cognito_identity_pool = company.aws_cognito_identity_pool;
        awsDetails.aws_cognito_userpool_web_client_id = company.aws_cognito_userpool_web_client_id;
        awsDetails.aws_cognito_region = company.aws_cognito_region;
        awsDetails.aws_iam_access_key = company.aws_iam_access_key;
        awsDetails.aws_iam_access_secret = company.aws_iam_access_secret;
        awsDetails.aws_s3_bucket_name = company.aws_s3_bucket_name;
        awsDetails.aws_region = company.aws_region;
        awsDetails.aws_iot_end_point = company.aws_iot_end_point;
        resolve(awsDetails);
    });
}

module.exports = { cognitoLogin}
