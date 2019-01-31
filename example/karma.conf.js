/*
Copyright 2018 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const path = require('path');

module.exports = function(config) {
    config.set({
        plugins: ['karma-*', require('../lib')], // You should use require('es-modules-middleware')
        frameworks: ['mocha', 'chai', 'web-components'],
        middleware: ['es-modules'],
        esModulesMiddleware: {
            paths: {
                '/': __dirname,
                '/node_modules': path.join(__dirname, 'node_modules'),
            },
        },
        files: [
            {
                pattern: 'test/**/*.test.html',
                watched: true,
                included: false,
                served: true,
            },
            {
                pattern: 'test/*.js',
                watched: true,
                included: false,
                served: false,
            },
        ],
        // NOTE: proxy node_modules paths to base so they get picked up by the middleware
        proxies: {
            '/node_modules/': '/base/node_modules/',
        },
        reporters: ['mocha'],
        browsers: [path.resolve(path.join(__dirname, 'test/chrome.sh'))],
    });
};
