const models = require('../models');
const mustache = require('mustache');
const mjml = require('mjml');
const nodemailer = require('nodemailer');
const Logger = require('../Logger');
let { deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog } = require('../services/ActivityLogService')
const { Entities } = require('../utils/Entities');
const { getCompany } = require('../cache/Companies');

const getBasicTemplate = async function (banner, body, data_parameter, subject, companyCreds) {
    let basic_template = companyCreds.templates.email_template;
    const companyName = companyCreds.name//"Development"
    const companyCode = companyCreds.code//"dev-app"
    let companyAddress = companyCreds.address;

    let combineAddress = await getCombineAddress(companyAddress).then(result => {
        return (result);
    }).catch(err => {
        reject(err);
    });

    let default_parameter = {
        company_name: companyName,
        company_code: companyCode,
        company_address: combineAddress,
        company_link: companyCreds.contact_details.website_url,
        contact_url: companyCreds.contact_details.contact_url,

        footer: `{{company_name}} <br/>
        {{{company_address}}} <br/>
        <a href = {{company_link}}> {{company_link}} </a>`,
        header: ``,
        body,
        banner
    }

    const template_parameter = Object.assign({}, default_parameter, data_parameter)
    body = mustache.render(body, template_parameter);
    banner = mustache.render(banner, template_parameter);
    const renderedMJML1 = mustache.render(basic_template, template_parameter);
    const renderedMJML2 = mustache.render(renderedMJML1, template_parameter);
    const renderedMJML3 = mustache.render(renderedMJML2, template_parameter);
    const renderedMJML4 = mustache.render(renderedMJML3, template_parameter);
    let { html } = mjml(renderedMJML4, { keepComments: false });
    subject = mustache.render(subject, template_parameter);
    // if (companyCode == 'purmo') {
    //     subject = `${companyName} - ${subject}`
    // }
    html = html.replace(`style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;"`, `style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:auto;font-size:13px;"`);
    return { html, subject };
}

const getCombineAddress = function (companyAddress) {
    return new Promise(async (resolve, reject) => {
        let checknullJson = {};
        let combineAddress = ``;
        const line_1 = companyAddress.line_1;
        const line_2 = companyAddress.line_2;
        const line_3 = companyAddress.line_3;
        const city = companyAddress.city;
        const state = companyAddress.state;
        const zip_code = companyAddress.zip_code;
        const country = companyAddress.country;
        if (line_1) { checknullJson.line_1 = line_1; }
        if (line_2) { checknullJson.line_2 = line_2; }
        if (line_3) { checknullJson.line_3 = line_3; }
        if (city) { checknullJson.city = city; }
        if (state) { checknullJson.state = state; }
        if (zip_code) { checknullJson.zip_code = zip_code; }
        if (country) { checknullJson.country = country; }
        // if no data
        if (checknullJson && Object.keys(checknullJson).length < 1) {
            resolve(combineAddress);
        }
        // if some data    
        if (checknullJson && Object.keys(checknullJson).length > 0) {
            const keyItem = Object.keys(checknullJson);
            // check whether the keyItem includes address fields or not
            if (keyItem.includes('line_1')) {
                const key_value = checknullJson['line_1'];
                combineAddress = key_value + `<br/>`;
            }
            if (keyItem.includes('line_2')) {
                const key_value = checknullJson['line_2'];
                combineAddress = combineAddress + key_value + `<br/>`;
            } else {
                if (combineAddress.length > 0) { combineAddress = combineAddress + `<br/>`; }
            }
            if (keyItem.includes('line_3')) {
                const key_value = checknullJson['line_3'];
                combineAddress = combineAddress + key_value + `<br/>`;
            }
            if (keyItem.includes('city')) {
                const key_value = checknullJson['city'];
                combineAddress = combineAddress + key_value + `<br/>`;
            }
            if (keyItem.includes('state')) {
                const key_value = checknullJson['state'];
                combineAddress = combineAddress + key_value + `<br/>`;
            }
            if (keyItem.includes('zip_code')) {
                const key_value = checknullJson['zip_code'];
                combineAddress = combineAddress + key_value + `<br/>`;
            }
            if (keyItem.includes('country')) {
                const key_value = checknullJson['country'];
                combineAddress = combineAddress + key_value;
            }

            var s = combineAddress.split("<br/>");
            if (s[s.length - 1].length == 0) {
                s.pop();
                combineAddress = s.join("<br/>");
            }
        }
        resolve(combineAddress);
    })
}

const getTemplateContent = function (key, type, language) {
    return new Promise(async (resolve, reject) => {
        const data = await models.template_contents.findOne({
            where: {
                key, type, language
            }
        }).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });

        if (data && Object.keys(data).length > 0) {
            resolve(data);
        } else {
            const dataDefault = await models.template_contents.findOne({
                where: {
                    key, type, language: Entities.default_language.event_name.default
                }
            }).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            resolve(dataDefault);
        }
    })
}
const sendMail = function (to, template, subject) {
    return new Promise(async (resolve, reject) => {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PSWD,
            },
        });
        const mailOptions = {
            from: process.env.EMAIL_SENDER,
            to: to,
            subject: subject,
            html: template
        };
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                reject(err)
            }
            else {
                resolve(info)
            }
        });
    })
}
const manageTemplateContent = function (obj, key, type, language, companyCreds, companyId) {
    return new Promise(async (resolve, reject) => {
        await getTemplateContent(key, type, language).then(async (templateContentObj) => {

            if (templateContentObj) {
                let subject = templateContentObj.email_config.subject
                let body = templateContentObj.email_config.body
                let banner = templateContentObj.email_config.banner
                let data = obj
                let receiverList = data.receiverList || [];

                receiverList.forEach(async receiver => {
                    let email = receiver.email
                    let userId = receiver.userId
                    data["receiver_email"] = email
                    let template = await getBasicTemplate(banner, body, data, subject, companyCreds)
                    if (template) {
                        sendMail(email, template.html, template.subject).then(result => {
                            try {
                                addActivityLog(Entities.email.entity_name, Entities.email.event_name.sent, { email, data, subject: subject, key: key }, "Email sent", companyId, companyId)
                            } catch (error) {
                                addActivityLog(Entities.email.entity_name, Entities.email.event_name.error, { error }, "Email error", companyId, companyId)
                                Logger.error("Error", { "msg": error.message })
                                reject(error);
                            }
                        }).catch(err => {
                            addActivityLog(Entities.email.entity_name, Entities.email.event_name.error, { err }, "Email error", companyId, companyId)
                            if (err && err.message) {
                                Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            }
                            reject(err);

                        })
                    }
                });

                resolve()

            } else {
                //No default template configs found
                resolve()
                Logger.info("Info-Error", { "message": "No template content found for alert." + key, value: companyCreds.code })
            }
        }).catch(err => {
            reject(err)
        })
    })
}
const manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        try {
            let companyId = null;
            let companyCreds = null;
            let company = null;
            if (obj && obj.company_id) {
                // call a function which will find company data from cache if not present it will set new data in cache and returns the company data.
                company = await getCompany(obj.company_id).then(result => {
                    return (result);
                }).catch(err => {
                    console.log("caught error line - 235:", err);
                    reject(err);
                });
                if (!company || !company.id) {
                    Logger.info("Info-Error", { "message": "company_id is wrong, not found company_id to postgres db.", value: obj.company_id })
                    reject();
                }

                if (!companyId) {
                    companyId = company.id
                    companyCreds = company
                }
                let key = obj.key //for template key
                let type = obj.type  // for template type
                let language = obj.language; // for template language
                if (key && type && language) {
                    //Handle template contents
                    manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                        resolve()
                    }).catch(err => {
                        reject(err)
                    })
                } else {
                    Logger.info("Info-Error", { "message": "key and type is missing." + JSON.stringify(obj), value: obj.company_id })
                    resolve()
                }
            } else {
                Logger.info("Info-Error", { "message": "company_id is missing." + JSON.stringify(obj) })
                resolve()
            }
        } catch (error) {
            reject(error)
        }

    })
}

module.exports = {
    manage
}
