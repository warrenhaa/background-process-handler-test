const lodash = require('lodash');
const axios = require('axios')
const Logger = require('../Logger');

const getIssue = function (params) {
  return new Promise(async (resolve, reject) => {
    let issueExists = false;
    const searchKey = params.search;
    const labelName = params.labels;
    const comment = params.description;
    let searchUrl = process.env.GITLAB_TICKET_SEARCH_URL;
    try {
      // Replace placeholders in the URL
      searchUrl = searchUrl.replace('searchKey', searchKey);
      searchUrl = searchUrl.replace('labelName', labelName);
      const config = {
        url: searchUrl,
        method: 'get',
        headers: {
          'PRIVATE-TOKEN': process.env.GITLAB_TICKET_ACCESS_TOKEN,
        },
      };
      const res = await axios(config);

      if (res.data && res.data.length > 0) {
        const urls = lodash.map(res.data, 'web_url');
        const issue = urls[0].split('-');
        let updateUrl = process.env.GITLAB_TICKET_UPDATE_URL;
        updateUrl = updateUrl.replace('issue', issue[3]);
        updateUrl = updateUrl.replace('comment', comment);

        const updateData = {
          url: updateUrl,
          method: 'post',
          headers: {
            'PRIVATE-TOKEN': process.env.GITLAB_TICKET_ACCESS_TOKEN,
          },
        };

        await axios(updateData);
        if (labelName.includes("Threshold1")) {
          const index = updateUrl.indexOf("/notes");
          const trimmedUrl = updateUrl.slice(0, index);
          let updatedLabels = labelName;
          if (labelName.includes("Threshold1")) {
            updatedLabels.push("Threshold2", "highest");
          }
          const updateData = {
            url: trimmedUrl,
            method: 'put',
            headers: {
              'PRIVATE-TOKEN': process.env.GITLAB_TICKET_ACCESS_TOKEN,
            },
            data: {
              labels: updatedLabels
            }
          };

          await axios(updateData);
        }
      }
      issueExists = true;
    } catch (error) {
      if (error.response) {
        const statusCode = error.response.status;
        switch (statusCode) {
          case 414:
            Logger.info('Info-Error', { message: 'Request URI Too Long. Check the length of the request URL.', value: (searchUrl) });
            break;
          case 400:
            Logger.info('Info-Error', { message: 'Bad Request. Check the request payload and parameters.', value: (searchUrl) });
            break;
          case 429:
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // 1-second delay (adjust as needed)
            return getIssue(params); // Retry the request
          default:
            Logger.error(`Unhandled Error. Status Code: ${statusCode}`);
        }
      } else {
        Logger.info('Network Error:', error.message);
      }
    }
    resolve(issueExists);
  })
}

const createIssue = function (params) {
  return new Promise(async (resolve, reject) => {
    try {
      const headerParams = {
        'PRIVATE-TOKEN': process.env.GITLAB_TICKET_ACCESS_TOKEN,
      };
      const response = await axios.post(process.env.GITLAB_TICKET_URL, {},
        {
          params,
          mode: 'no-cors',
          headers: headerParams,
          crossDomain: true,
        });
      resolve(response.data);
    } catch (error) {
      if (error.response) {
        const statusCode = error.response.status;

        switch (statusCode) {
          case 414:
            Logger.info('Info-Error', { message: 'Request URI Too Long. Check the length of the request URL.', value: (params) });
            break;
          case 400:
            Logger.info('Info-Error', { message: 'Bad Request. Check the request payload and parameters.', value: (params) });
            break;
          case 429:
            // Implement exponential backoff
            // console.log('Rate limited. Retrying after a delay...');
            // await new Promise((resolve) => setTimeout(resolve, 1000));
            // 1-second delay (adjust as needed)
            // return createIssue(params); // Retry the request
            Logger.info('Info-Error', { message: '429 Request. Check the request payload and parameters.', value: (params) });
            break;
          default:
            Logger.error(`Unhandled Error. Status Code: ${statusCode}`);
        }
      } else {
        console.error('Network Error:', error.message);
      }
    }
  });
}

module.exports = {
  createIssue, getIssue
}




