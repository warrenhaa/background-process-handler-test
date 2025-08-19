const ruleEngine = require("node-rules");
const models = require('../models');
var { manage } = require('../handler/AlertsHandler')
// var getRules = function () {
//     return new Promise((resolve, reject) => {
//         models.rules.findAll().then((result) => {
//             resolve(result)
//         }).catch((err) => {
//             console.error(err)
//             reject(err)
//         })
//     })
// }
var configureRules = async function (rules, rulePasssedList) {
    var ruleList = []
    rules.forEach(element => {
        var obj = {
            "condition": function (R) {
                eval(element.rule);
            },
            "consequence": function (R) {
                rulePasssedList.push({
                    alertType: element.alert_type,
                    type: element.type,
                })
                R.next();
            }
        }
        ruleList.push(obj)
    });
    return ruleList;
}
const rulesTriggerEvaluator = async function (facts, pointer) {
    var engine = new ruleEngine();
    var rulePasssedList = []
    var ruleList = await getRules()
    var configuredRules = await configureRules(ruleList, rulePasssedList)
    engine.register(configuredRules);
    engine.execute(facts, function (data) {
        if (rulePasssedList.length > 0) {
            data.rulePasssedList = rulePasssedList
            manage(data, pointer)
        }
    });
}

module.exports = { rulesTriggerEvaluator }