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
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const resolve = require('resolve');

/**
 * Resolves a given url against a given file path using node_module resolution.
 * @param {*} filepath - the filepath to resolve from
 * @param {*} url - the url to resolve relative to the filepath or node_module folder
 * @returns {string} - the resolved path to the requested url / module
 */
function resolvePath(filepath, url) {
    try {
        // ignore full urls
        new URL(url);
        return url;
    } catch (e) {}
    try {
        const result = path.relative(
            path.dirname(filepath),
            resolve.sync(url, {
                basedir: path.dirname(filepath),
                packageFilter: (pkg) => {
                    pkg.main = pkg.module || pkg['jsnext:main'] || pkg.main;
                    return pkg;
                },
            })
        );
        return result.startsWith('.') ? result : './' + result;
    } catch (e) {
        console.error(`Failed to resolve module ${url} : ${e}`);
    }
    return url;
}

/**
 * Transforms a javascript files import and export statements to resolve paths using node_module resolution.
 *
 * @param {*} filepath - the path to the file being updated
 * @param {*} src - the content of the file
 */
function transformJs(filepath, src) {
    return src
        .replace(
            /import\s+(|[\{\*\w][^"']*)["']([^"']+)["'][\t ]*($|;|\/\/|\/\*)/gm,
            (match, pre, url, post) =>
                `import ${pre}'${resolvePath(filepath, url)}'${post}`
        )
        .replace(
            /export\s+([\{\*\w][^"']*)\s*from\s*["']([^"']+)["'][\t ]*($|;|\/\/|\/\*)/gm,
            (match, pre, url, post) =>
                `export ${pre} from '${resolvePath(filepath, url)}'${post}`
        );
}

/**
 * A Karma middleware factory which uses the config.basePath to configure module resolution.
 *
 * @param {*} basePath - the basePath configuration from karma
 * @param {string[]} indexFiles - an array of index files to attempt to resolve directories to, in order of preference, defaults to `['index.html', 'index.js']`
 * @returns {Function} - the karma middleware to be used with beforeMiddleware configuration.
 */
const EsModulesMiddlewareFactory = function(
    basePath,
    indexFiles = ['index.html', 'index.js']
) {
    return function(req, res, next) {
        // we want to ignore anything thats karma specific
        // all user content is under /base or requested through /node_modules
        if (
            !req.url.startsWith('/base/') &&
            !req.url.startsWith('/node_modules/')
        ) {
            return next();
        }

        let resolvedPath = req.originalUrl;
        // if its a karma url served through /base, trim it off before resolving
        if (resolvedPath.startsWith('/base/')) {
            resolvedPath = resolvedPath.slice('/base/'.length);
            resolvedPath = path.join(basePath, resolvedPath);
        } else {
            // slice off leading slash so we have a path starting with node_module
            resolvedPath = resolvedPath.slice(1);
        }

        // resolve the path to an absolute path
        resolvedPath = path.resolve(resolvedPath);

        // if there's no path, do nothing
        if (resolvedPath.length < 1) {
            return next();
        }

        // if the file exists, and its javascript, attempt transform, otherwise just serve it
        if (fs.existsSync(resolvedPath)) {
            // if path is a directory, attempt default resolution to one of the index files
            if (fs.lstatSync(resolvedPath).isDirectory()) {
                for (let i = 0; i < indexFiles.length; i++) {
                    const index = indexFiles[i];
                    if (fs.existsSync(path.join(resolvedPath, index))) {
                        return res.redirect(path.join(req.originalUrl, index));
                    }
                }
                // if not just pass on to the next middleware
                return next();
            }
            const filetype =
                mime.getType(resolvedPath) || 'application/octet-stream';
            res.setHeader('Content-Type', filetype);
            if (
                filetype.startsWith('text/javascript') ||
                filetype.startsWith('application/javascript')
            ) {
                const content = fs.readFileSync(resolvedPath, {
                    encoding: 'utf-8',
                });
                return res.end(transformJs(resolvedPath, content), 'utf-8');
            } else {
                const content = fs.readFileSync(resolvedPath);
                return res.end(content);
            }
        }
        next();
    };
};

EsModulesMiddlewareFactory.$inject = ['config.basePath'];

/**
 * Connect-style middleware factory for use with express and similar servers.
 *
 * @param {string} basePath - the basePath for resolution to start from.
 * @param {string[]} indexFiles - an array of index files to attempt to resolve directories to, in order of preference, defaults to `['index.html', 'index.js']`
 * @returns {Function} - returns the middleware which will resolve the paths based on the given basePath.
 */
function middleware(basePath, indexFiles = ['index.html', 'index.js']) {
    return function(req, res, next) {
        let resolvedPath = req.originalUrl;

        if (resolvedPath.startsWith('/node_modules/')) {
            resolvedPath = resolvedPath.slice(1);
        }
        // resolve the requested file using the base path prefix
        resolvedPath = path.resolve(path.join(basePath, resolvedPath));
        // if there's no path, do nothing
        if (resolvedPath.length < 1) {
            return next();
        }
        // if the file exists and is javascript transform it, otherwise just serve it
        if (fs.existsSync(resolvedPath)) {
            // if path is a directory, attempt default resolution to one of the index files
            if (fs.lstatSync(resolvedPath).isDirectory()) {
                for (let i = 0; i < indexFiles.length; i++) {
                    const index = indexFiles[i];
                    if (fs.existsSync(path.join(resolvedPath, index))) {
                        return res.redirect(path.join(req.originalUrl, index));
                    }
                }
                // if not just pass on to the next middleware
                return next();
            }
            const filetype =
                mime.getType(resolvedPath) || 'application/octet-stream';
            res.setHeader('Content-Type', filetype);
            if (
                filetype.startsWith('text/javascript') ||
                filetype.startsWith('application/javascript')
            ) {
                const content = fs.readFileSync(resolvedPath, {
                    encoding: 'utf-8',
                });
                return res.end(transformJs(resolvedPath, content), 'utf-8');
            } else {
                const content = fs.readFileSync(resolvedPath);
                return res.end(content);
            }
        }
        next();
    };
}
module.exports = {
    'middleware:es-modules': ['factory', EsModulesMiddlewareFactory],
    middleware,
};
