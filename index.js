'use strict';
const circuitbreaker = require('circuitbreaker');

class CircuitBreaker {

    /**
     * Construct a CircuitBreaker object
     * @method constructor
     * @param  {Function}   command              The command to be running that requires the circuit breaker
     * @param  {Object}     [options]            Options to configure the circuit breaker with
     * @param  {Number}     options.timeout      The timeout in ms to wait for a command to complete
     * @param  {Number}     options.maxFailures  The number of failures before the circuit is tripped
     * @param  {Number}     options.resetTimeout The timeout in ms to reset the switch
     */
    constructor(command, options) {
        const optionsToCompare = options || {};

        this.command = command;
        this.options = {
            timeout: optionsToCompare.timeout || 10000,
            maxFailures: optionsToCompare.maxFailures || 5,
            resetTimeout: optionsToCompare.resetTimeout || 50
        };
        this.breaker = circuitbreaker(this.command, this.options);
    }

    /**
     * Run the breaker command specified in the constructor
     * @method runCommand
     * @param  {arguments}   arguments           List of arguments to call the circuit breaker command with
     * @param  {Function}    callback            Last argument is the callback to callback upon completion
     */
    runCommand() {
        const args = Array.prototype.slice.call(arguments);
        const callback = args.pop();

        this.breaker.apply(this.breaker, args).catch((err) => {
            callback(err);
            throw err;
        }).then((data) => {
            callback(null, data);
        });
    }

    /**
     * Return boolean whether the state of the breaker is closed
     * @method  isClosed()
     * @returns {Boolean}   Whether or not the breaker is closed
     */
    isClosed() {
        return this.breaker.isClosed();
    }

    /**
     * Get the Total Number of requests
     * @method  getTotalRequests
     * @returns {Number}    Total number requests
     */
    getTotalRequests() {
        return this.breaker.stats.totalRequests;
    }

    /**
     * Get the Total Number of request timeouts
     * @method  getTimeouts
     * @returns {Number}    Total number timeouts
     */
    getTimeouts() {
        return this.breaker.stats.timeouts;
    }

    /**
     * Get the Total Number of successful requests
     * @method  getSuccessfulRequests
     * @returns {Number}    Total number successful requests
     */
    getSuccessfulRequests() {
        return this.breaker.stats.successfulResponses;
    }

    /**
     * Get the Total Number of failed requests
     * @method  getSuccessfulRequests
     * @returns {Number}    Total number failed requests
     */
    getFailedRequests() {
        return this.breaker.stats.failedResponses;
    }

    /**
     * Get the Total Number of concurrent requests
     * @method  getConcurrentRequests
     * @returns {Number}    Total number concurrent requests
     */
    getConcurrentRequests() {
        return this.breaker.stats.concurrentRequests();
    }

    /**
     * Get the Average response time of the requests
     * @method  getAverageRequestTime
     * @returns {Number}    Average response time per request
     */
    getAverageRequestTime() {
        return this.breaker.stats.averageResponseTime();
    }
}

module.exports = CircuitBreaker;
