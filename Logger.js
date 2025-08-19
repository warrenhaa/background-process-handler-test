const winston = require('winston');
require('winston-daily-rotate-file');
const errorTransport = new (winston.transports.DailyRotateFile)({
    filename: 'DeviceStatusError-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    maxSize: '4m',
    maxFiles: '10',
    createSymlink: true,
    symlinkName: 'DeviceStatusError.log',
});
const infoTransport = new (winston.transports.DailyRotateFile)({
    filename: 'DeviceStatusInfo-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    maxSize: '4m',
    maxFiles: '10',
    createSymlink: true,
    symlinkName: 'DeviceStatusInfo.log',
});
// initialize error logger
const error = winston.createLogger({
    format: winston.format.json(),
    level: 'error',
    transports: [
        errorTransport,
        new (winston.transports.Console)({ level: 'error' }),
    ],
});
const info = winston.createLogger({
    format: winston.format.json(),
    level: 'info',
    transports: [
        infoTransport,
        new (winston.transports.Console)({ level: 'info' }),
    ],
});
module.exports = {
    error(msg, log) {
        error.error(msg, log);
    },
    info(msg, log) {
        info.info(msg, log);
    },
}