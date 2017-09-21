# Circuit-fuses
[![Version][npm-image]][npm-url] ![Downloads][downloads-image] [![Build Status][status-image]][status-url] [![Open Issues][issues-image]][issues-url] [![Dependency Status][daviddm-image]][daviddm-url] ![License][license-image]

> Wrapper around screwdriver-node-circuitbreaker to define a callback interface

## Usage

```bash
npm install circuit-fuses
```

This module wraps the [screwdriver-node-circuitbreaker] and provides a simple callback interface for handling the circuit breaker.

```js
const Breaker = require('circuit-fuses').breaker;
const request = require('request');
const command = request.get
// To setup the fuse, instantiate a new Breaker with the command to run
const breaker = new Breaker(command);

breaker.runCommand('http://yahoo.com', (err, resp) => {
    if (err) {
        /* If the circuit is open the command is not run, and an error
         * with message "CircuitBreaker Open" is returned.
         * In this case, you can switch on the error and have a fallback technique
         */
        // ... stuff
    }
    // Here there is no error and it's possible to proceed with the resp object
});
```

The `runCommand` method will return a promise if a callback is not supplied.

```js
const Breaker = require('circuit-fuses').breaker;
const request = require('request');
const command = request.get
// To setup the fuse, instantiate a new Breaker with the command to run
const breaker = new Breaker(command);

breaker.runCommand('http://yahoo.com')
    .then(resp => {
        // Here there is no error and it's possible to proceed with the resp object
    })
    .catch(err => {
        /* If the circuit is open the command is not run, and an error
         * with message "CircuitBreaker Open" is returned.
         * In this case, you can switch on the error and have a fallback technique
         */
        // ... stuff
    });
```

### Constructor
`constructor(command, options)` 

| Parameter        | Type  | Required  |  Description | Default |
| :-------------   | :---- | :---- | :-------------| :---------- |
| command        | Function | Yes | The command to run with circuit breaker | none |
| options.breaker | Object | No | The object to configure the breaker module with | {} |
| options.breaker.timeout | Number | No | The timeout in ms to wait for a command | 10000 |
| options.breaker.maxFailures | Number | No | The number of failures before the breaker switches |  5  |
| options.breaker.resetTimeout | Number | No | The number in ms to wait before resetting the circuit |  50 |
| options.retry | Object | No | The object to configure the retry module with | {} |
| options.retry.retries | Number | No | The number of retries to do before passing back a failure | 5 |
| options.retry.factor | Number | No | The exponential factor to use | 2 |
| options.retry.minTimeout | Number | No | The timeout to wait before doing the first retry | 1000 |
| options.retry.maxTimeout | Number | No | The max timeout to wait before retrying | Number.MAX_VALUE |
| options.retry.randomize | Boolean | No | Randomize the timeout | false |
| options.shouldRetry | Function | No | Special logic to should circuit retries | () => true |

### Short circuiting the retry logic
Normally, the circuit breaker will retry with exponential back off until the max number of retries has been reached or the breaker has opened due to max failures. You may have operations that you want to immediately fail under certain conditions. In this situation, a shouldRetry option is available. This is a function that receives the err object and arguments passed to the runCommand function.

For example, short circuit when runCommand is called with "MyArg" and the error contains a status code of 404:

```js
shouldRetry(err, args) {
    return args[0] === "MyArg" && err.statusCode === 404;
}
```

### Run Command
To run the command passed to the constructor

`runCommand(...args, callback)`

| Parameter        | Type  | Required  |  Description |
| :-------------   | :---- | :---- | :-------------|
| args        | Arguments | No | The arguments to pass to the command |
| callback | Function | No | The callback to call when the command returns |

### Get Total Number Requests
Returns the total number of requests from the circuit breaker

`getTotalRequests()`

### Get Total Number Request Timeouts
Returns the total number of request timeouts that occurred

`getTimeouts()`

### Get Total Number Request Successful
Returns the total number of successful requests that occurred

`getSuccessfulRequests()`

### Get Total Number Request Failed
Returns the total number of failed requests that occurred

`getFailedRequests()`

### Get Total Concurrent Requests
Returns the total number of concurrent requests that occurred

`getConcurrentRequests()`

### Get Average Request time
Returns the average request time taken

`getAverageRequestTime()`

### Get whether the breaker is closed
Returns boolean whether the circuit breaker is closed

`isClosed()`

### Get a holistic set of the above metrics
`stats()`

## Using Fuseboxes

A FuseBox is a collection of circuit breakers. If one circuit breaker in the fuse box breaks, the others break as well. To create a new fusebox:

```
const FuseBox = require('circuit-fuses').box;
const fusebox = new FuseBox();
```

To add circuit breakers to the fuse box, use the `addFuse()` method.

`addFuse(circuitbreaker)`

| Parameter        | Type  | Required  |  Description |
| :-------------   | :---- | :---- | :-------------|
| circuitbreaker   | CircuitBreaker | Yes | The circuit breaker to add to the fuse box |

Here's an example:

```
var breaker1 = new Breaker('testFn');
var breaker2 = new Breaker('testFn2');
var breaker3 = new Breaker('testFn3');
fusebox.addFuse(breaker1);
fusebox.addFuse(breaker2);
```
In the above case, if breaker1 trips, breaker2 will trip as well because both of them belong to the same fuse box.

## Testing

```bash
npm test
```

## License

Code licensed under the BSD 3-Clause license. See LICENSE file for terms.

[npm-image]: https://img.shields.io/npm/v/circuit-fuses.svg
[npm-url]: https://npmjs.org/package/circuit-fuses
[downloads-image]: https://img.shields.io/npm/dt/circuit-fuses.svg
[license-image]: https://img.shields.io/npm/l/circuit-fuses.svg
[issues-image]: https://img.shields.io/github/issues/screwdriver-cd/screwdriver.svg
[issues-url]: https://github.com/screwdriver-cd/screwdriver/issues
[status-image]: https://cd.screwdriver.cd/pipelines/22/badge
[status-url]: https://cd.screwdriver.cd/pipelines/22
[daviddm-image]: https://david-dm.org/screwdriver-cd/circuit-fuses.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/screwdriver-cd/circuit-fuses
[screwdriver-node-circuitbreaker]: https://github.com/screwdriver-cd/node-circuitbreaker
