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
        breakerMock.isClosed = sinon.stub();
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
            const testOptions = { timeout: 432 };
            const breaker = new Breaker(testFn, testOptions);

            assert.ok(breaker);
            assert.calledWith(circuitMock, testFn, {
                timeout: 432,
                maxFailures: 5,
                resetTimeout: 50
            });
        });
    });

    describe('runCommand', () => {
        let breaker;

        beforeEach(() => {
            breaker = new Breaker('testFn');
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

        it('callsback with error on failure', (done) => {
            const error = new Error('request failure');

            breakerMock.rejects(error);
            breaker.runCommand('1', '2', (err, data) => {
                assert.notOk(data);
                assert.deepEqual(err, error);
                done();
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
});
