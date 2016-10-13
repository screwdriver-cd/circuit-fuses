'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const mockery = require('mockery');

require('sinon-as-promised');

sinon.assert.expose(assert, { prefix: '' });

describe('index test', () => {
    let Breaker;
    let circuitMock;
    let breakerMock;
    let statsMock;

    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    beforeEach(() => {
        statsMock = {
            totalRequests: 1,
            timeouts: 2,
            successfulResponses: 3,
            failedResponses: 4,
            concurrentRequests: sinon.stub(),
            averageResponseTime: sinon.stub()
        };
        breakerMock = sinon.stub();
        breakerMock.stats = statsMock;
        breakerMock.isClosed = sinon.stub().returns(true);
        circuitMock = sinon.stub().returns(breakerMock);

        mockery.registerMock('circuitbreaker', circuitMock);

        /* eslint-disable global-require */
        Breaker = require('../index');
         /* eslint-enable global-require */
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.resetCache();
    });

    after(() => {
        mockery.disable();
    });

    describe('constructor', () => {
        it('has functions', () => {
            const breaker = new Breaker();

            assert.isFunction(breaker.runCommand);
            assert.isFunction(breaker.getTotalRequests);
            assert.isFunction(breaker.getTimeouts);
            assert.isFunction(breaker.getSuccessfulRequests);
            assert.isFunction(breaker.getFailedRequests);
            assert.isFunction(breaker.getConcurrentRequests);
            assert.isFunction(breaker.getAverageRequestTime);
        });

        it('calls breaker with the command passed in', () => {
            const testFn = 'testFn';
            const breaker = new Breaker(testFn);

            assert.ok(breaker);
            assert.calledWith(circuitMock, testFn);
        });

        it('calls breaker with overridden options', () => {
            const testFn = 'testFn';
            const testOptions = {
                breaker: {
                    timeout: 432
                }
            };
            const breaker = new Breaker(testFn, testOptions);

            assert.ok(breaker);
            assert.calledWith(circuitMock, testFn, {
                timeout: 432,
                maxFailures: 5,
                resetTimeout: 50
            });
        });

        it('stores the options', () => {
            const testFn = 'testFn';
            const shouldRetry = () => false;
            const testOptions = {
                shouldRetry,
                breaker: {
                    timeout: 432,
                    maxFailures: 2,
                    resetTimeout: 10
                },
                retry: {
                    retries: 10,
                    factor: 4,
                    minTimeout: 100,
                    maxTimeout: 10000,
                    randomize: true
                }
            };
            const breaker = new Breaker(testFn, testOptions);

            assert.ok(breaker);
            assert.deepEqual(breaker.breakerOptions, testOptions.breaker);
            assert.deepEqual(breaker.retryOptions, testOptions.retry);
            assert.deepEqual(breaker.shouldRetry, shouldRetry);
        });
    });

    describe('runCommand', () => {
        let breaker;

        beforeEach(() => {
            breaker = new Breaker('testFn', {
                breaker: {
                    resetTimeout: 1000
                },
                retry: {
                    minTimeout: 25
                }
            });
        });

        it('calls breaker with the correct values', (done) => {
            breakerMock.resolves();
            breaker.runCommand('1', '2', () => {
                assert.calledWith(breakerMock, '1', '2');
                done();
            });
        });

        it('callsback with correct data on success', (done) => {
            breakerMock.resolves({
                real: 'data'
            });
            breaker.runCommand('1', '2', (err, data) => {
                assert.isNull(err);
                assert.deepEqual(data, {
                    real: 'data'
                });
                done();
            });
        });

        it('returns error but retries when an error and the breaker is closed', (done) => {
            const error = new Error('request failure');

            breakerMock.rejects(error);

            breaker.runCommand('1', '2', (err, data) => {
                assert.notOk(data);
                assert.deepEqual(err, error);
                assert.callCount(breakerMock, 6);
                done();
            });
        });

        it('does not retry when the breaker is closed', (done) => {
            const error = new Error('request failure');

            breakerMock.rejects(error);
            breakerMock.isClosed.onThirdCall().returns(false);

            breaker.runCommand('1', '2', (err, data) => {
                assert.notOk(data);
                assert.deepEqual(err, error);
                assert.callCount(breakerMock, 3);
                done();
            });
        });

        it('retries 3 times until success', (done) => {
            const error = new Error('request failure');

            breakerMock.rejects(error);
            breakerMock.onThirdCall().resolves({
                real: 'data'
            });

            breaker.runCommand('1', '2', (err, data) => {
                assert.isNull(err);
                assert.deepEqual(data, {
                    real: 'data'
                });
                assert.callCount(breakerMock, 3);
                done();
            });
        });

        it('will short circuit retries when special conditions met', (done) => {
            breaker = new Breaker('testFn', {
                shouldRetry: (err, args) => args[0] === '1' && err.message !== 'request failure2',
                breaker: {
                    resetTimeout: 1000,
                    maxFailures: 400
                },
                retry: {
                    minTimeout: 25
                }
            });

            const error = new Error('request failure');
            const error2 = new Error('request failure2');

            breakerMock.rejects(error);
            breakerMock.onThirdCall().rejects(error2);

            breaker.runCommand('1', '2', (err, data) => {
                assert.notOk(data);
                assert.deepEqual(err, error);
                assert.callCount(breakerMock, 3);
                done();
            });
        });

        it('implements a promise interface when no callback', () => {
            breakerMock.resolves('foo');

            return breaker.runCommand('1', '2')
                .then((data) => {
                    assert.calledWith(breakerMock, '1', '2');
                    assert.equal(data, 'foo');
                });
        });

        it('handles broken promise when no callback', () => {
            const breakerError = new Error('nope');

            breakerMock.rejects(breakerError);

            return breaker.runCommand('1', '2')
                .catch((err) => {
                    assert.calledWith(breakerMock, '1', '2');
                    assert.deepEqual(err, breakerError);
                });
        });
    });

    describe('getTotalRequests', () => {
        it('returns total requests', () => {
            const breaker = new Breaker();

            assert.equal(breaker.getTotalRequests(), 1);
        });
    });

    describe('getTimeouts', () => {
        it('returns number of timeouts', () => {
            const breaker = new Breaker();

            assert.equal(breaker.getTimeouts(), 2);
        });
    });

    describe('getSuccessfulRequests', () => {
        it('returns number of successful requests', () => {
            const breaker = new Breaker();

            assert.equal(breaker.getSuccessfulRequests(), 3);
        });
    });

    describe('getFailedRequests', () => {
        it('returns number of failed requests', () => {
            const breaker = new Breaker();

            assert.equal(breaker.getFailedRequests(), 4);
        });
    });

    describe('getConcurrentRequests', () => {
        it('returns number of concurrent requests', () => {
            statsMock.concurrentRequests.returns(5);
            const breaker = new Breaker();

            assert.equal(breaker.getConcurrentRequests(), 5);
        });
    });

    describe('getAverageRequestTime', () => {
        it('returns average request time', () => {
            statsMock.averageResponseTime.returns(6);
            const breaker = new Breaker();

            assert.equal(breaker.getAverageRequestTime(), 6);
        });
    });

    describe('isClosed', () => {
        it('returns boolean whether the breaker is closed', () => {
            breakerMock.isClosed.returns(false);
            const breaker = new Breaker();

            assert.equal(breaker.isClosed(), false);
        });
    });

    describe('stats', () => {
        it('should provide a unified stats interface', () => {
            breakerMock.isClosed.returns(false);
            statsMock.averageResponseTime.returns(6);
            statsMock.concurrentRequests.returns(5);

            const breaker = new Breaker();

            assert.deepEqual(breaker.stats(), {
                requests: {
                    total: 1,
                    timeouts: 2,
                    success: 3,
                    failure: 4,
                    concurrent: 5,
                    averageTime: 6
                },
                breaker: {
                    isClosed: false
                }
            });
        });
    });
});
