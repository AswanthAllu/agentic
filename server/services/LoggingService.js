// server/services/LoggingService.js
const { v4: uuidv4 } = require('uuid');

class LoggingService {
    constructor(req) {
        this.userId = req?.user?.id || 'anonymous';
        this.requestId = req?.headers['x-request-id'] || uuidv4();
    }

    log(event, data) {
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            requestId: this.requestId,
            userId: this.userId,
            event,
            ...data
        };
        console.log(JSON.stringify(logData));
    }

    error(event, data) {
        const timestamp = new Date().toISOString();
        const logData = {
            timestamp,
            requestId: this.requestId,
            userId: this.userId,
            event: `ERROR_${event}`,
            ...data
        };
        console.error(JSON.stringify(logData));
    }

    // You can add more specific logging methods here
}

module.exports = LoggingService;