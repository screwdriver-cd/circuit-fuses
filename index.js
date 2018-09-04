'use strict';

/* eslint-disable no-underscore-dangle */
const circuitbreaker = require('screwdriver-node-circuitbreaker');
const retryFn = require('retry-function');
const EventEmitter = require('events');

/* Class representing a node circuit breaker.
 * @extends EventEmitter
 */
class CircuitBreaker extends EventEmitter {

    /**
     * Construct a CircuitBreaker object
     * @method constructor
     * @param  {Function}   command                      The command to be running that requires the circuit breaker
     * @param  {Object}     [options]                    Options to configure the circuit breaker with
     * @param  {Number}     options.breaker.timeout      The timeout in ms to wait for a command to complete
     * @param  {Number}     options.breaker.maxFailures  The number of failures before the circuit is tripped
     * @param  {Number}     options.breaker.resetTimeout The timeout in ms to reset the switch
     * @param  {Number}     options.retry.retries        The number of retries to do before passing back a failure
     * @param  {Number}     options.retry.factor         The exponential factor to use
     * @param  {Number}     options.retry.minTimeout     The timeout to wait before doing the first retry
     * @param  {Number}     options.retry.maxTimeout     The max timeout to wait before retrying
     * @param  {Boolean}    options.retry.randomize      Randomize the timeout
     */
    constructor(command, options) {
        super();

        const optionsToCompare = options || {};
        const breakerOptions = optionsToCompare.breaker || {};
        const retryOptions = optionsToCompare.retry || {};

        this.command = command;
        this.breakerOptions = {
            timeout: breakerOptions.timeout || 10000,
            maxFailures: breakerOptions.maxFailures || 5,
            resetTimeout: breakerOptions.resetTimeout || 50,
            errorFn: breakerOptions.errorFn || (() => true)
        };
        this.retryOptions = {
            retries: retryOptions.retries || 5,
            factor: retryOptions.factor || 2,
            minTimeout: retryOptions.minTimeout || 1000,
            maxTimeout: retryOptions.maxTimeout || Number.MAX_VALUE,
            randomize: retryOptions.randomize || false
        };

        this.shouldRetry = (options && options.shouldRetry) || (() => true);

        this.breaker = circuitbreaker(this.command, this.breakerOptions);
        this.breaker.on('open', () => {
            console.error(`Breaker with function ${this.command.toString()} \
was tripped on ${new Date().toUTCString()}`);
            this.emit('open');
        });
    }

    /**
     * Retry wrapper for the circuit breaker to retry on failure as long as circuit is closed
     * @method runCommand
     * @param  {arguments}   arguments           List of arguments to call the circuit breaker command with
     * @param  {Function}    [callback]          Last argument is the callback to callback upon completion
     */
    runCommand() {
        const args = Array.prototype.slice.call(arguments);
        let callback;

        if (args.length >= 1 && typeof args[args.length - 1] === 'function') {
            callback = args.pop();
        }

        const wrapBreaker = (cb) => {
            this.breaker.apply(this.breaker, args)
            .then(data => cb(null, data), err => cb(err));
        };
        const shouldRetry = this.shouldRetry;

        return new Promise((resolve, reject) => {
            retryFn({
                method: wrapBreaker,
                context: this,
                options: this.retryOptions,
                shouldRetry: err => err && this.isClosed() && shouldRetry(err, args)
            }, (err, ...data) => {
                if (typeof callback === 'function') {
                    return callback(err, ...data);
                }

                if (err) {
                    console.log(`Getting errors with ${args}: ${err}`);

                    return reject(err);
                }

                return resolve(...data);
            });
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

    /**
     * Force the circuit breaker open
     * @method forceOpen
     */
    forceOpen() {
        if (this.breaker.isClosed()) {
            console.log(`Forcing open ${this.command.toString()}`);
            this.breaker.forceOpen();
        }
    }

    /**
    * Retrieve stats for the breaker
    * @method   stats
    * @returns  {Object}           Object containing stats for the breaker
    */
    stats() {
        return {
            requests: {
                total: this.breaker.stats.totalRequests,
                timeouts: this.breaker.stats.timeouts,
                success: this.breaker.stats.successfulResponses,
                failure: this.breaker.stats.failedResponses,
                concurrent: this.breaker.stats.concurrentRequests(),
                averageTime: this.breaker.stats.averageResponseTime()
            },
            breaker: {
                isClosed: this.breaker.isClosed()
            }
        };
    }
}

/* Class representing a collection of CircuitBreaker instances */
class FuseBox {
    /**
     * Construct a FuseBox object
     * @constructor
     */
    constructor() {
        this.fuses = [];
    }

    /**
     * Add an existing circuit breaker to the fuse box
     * @method   addFuse
     * @param  {CircuitBreaker}   breaker                The circuit breaker to be added to the fuse box
     */
    addFuse(breaker) {
        const self = this;

        breaker.on('open', () => self.tripFuses());
        this.fuses.push(breaker);
    }

    /**
     * Trip all the circuit breakers inside the fuse box.
     * @method   tripFuses
     */
    tripFuses() {
        this.fuses.map(fuse => fuse.forceOpen());
    }
}

module.exports = {
    breaker: CircuitBreaker,
    box: FuseBox
};
