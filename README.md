# es-modules-middleware

This middleware provides a connect-style middleware and a Karma middleware factory for resolving ES-module import and export statements on the fly.

Browsers do not currently support 'bare module specifiers' such as `import * from 'chai'`. The browser does not know how to resolve `'chai'` since its not an absolute URI or a relative URI. So results in this error message:

```
Uncaught TypeError: Failed to resolve module specifier "chai". Relative references must start with either "/", "./", or "../".
```

There are several proposals to fix this, one such proposal is [import-maps](https://github.com/nodejs/modules/issues/51) ([repo](https://github.com/domenic/import-maps)). The workaround to this would involve using relative references for imports, this is fine when you're not using any node_module based dependencies, but when you want to import some external lib you end up having to bundle your modules to resolve these dependencies or import through complete relative paths to your node_modules folder.

This middleware provides an alternative to that by rewriting the import and export statements served on the fly to resolve the paths to a node_module folder. This implementation is based heavily on the [es-module-devserver](https://github.com/myfreeweb/es-module-devserver) middleware by [myfreeweb](https://github.com/myfreeweb) with some small tweaks to make it compatible with Karma.

In general you would NOT use this middleware in any production service, where it is expected that you would use bundling to resolve these issues. This middleware is intended for development purposes so the complications of a bundled development environment can be avoided and ES-modules can be used natively. Polymers CLI tools also implement this behavior, for additional context see [this documentation](https://polymer-library.polymer-project.org/3.0/docs/es6#module-specifiers).

# Examples

There is a complete working example projection in the [examples folder](./example) which implements a web component using the [LitElement](https://lit-element.polymer-project.org) library as a dependency.

# Requirements

-   NodeJS >= 8.10.0

# Installation

```bash
npm install --save-dev @adobe/es-modules-middleware
```

# Usage

The module can be included and used as a connect middleware by providing it with a map of url base path to file system path from which to serve files. Any files served through the middleware will be processed to resolve import/export paths properly.

```javascript
const esModuleMiddleware = require('@adobe/es-modules-middleware');
const express = require('express');

const app = express();
const port = 3000;

const rootPath = path.resolve(__dirname);

app.use(
    esModuleMiddleware.middleware({
        paths: {
            '/node_modules': path.join(rootPath, 'node_modules'),
        },
    })
);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

It can also be used in Karma to aid in testing es-modules in the browser. Here's an example of using this middleware in combination with the [karma-web-components](https://github.com/jimsimon/karma-web-components) framework to test web components using HTML test pages:

```javascript
const path = require('path');

module.exports = function(config) {
    config.set({
        basePath: '.',
        plugins: ['karma-*', require('@adobe/es-modules-middleware')],
        frameworks: ['mocha', 'chai', 'sinon', 'web-components'],
        middleware: ['es-modules'],
        esModulesMiddleware: {
            // NOTE: add any paths which you wish to be processed and served by the middleware
            paths: {
                '/': __dirname,
                '/node_modules': path.join(__dirname, 'node_modules'),
            },
        },
        files: [
            {
                pattern: '**/*.test.html',
                watched: false,
                included: false,
                served: true,
            },
            {
                pattern: '**/test/*.js',
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
    });
};
```

# Contributing

We'd be very grateful if you contributed to the project! Check out our
[contribution guidelines](CONTRIBUTING.md) for more information.
