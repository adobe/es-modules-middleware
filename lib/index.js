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

const checkPaths = (paths, requestedFilePath) => {
    for (const pathPrefix in paths) {
        // if the requested file does not start with the path prefix we can move on
        if (!requestedFilePath.startsWith(pathPrefix)) {
            continue;
        }
        // strip the path prefix from the requested path and create the resolved path
        const servedPath = paths[pathPrefix];
        const strippedPath = requestedFilePath.slice(pathPrefix.length);
        const resolvedPath = path.join(servedPath, strippedPath);
        // if the resolved path exists and is not a directory return it
        if (fs.existsSync(resolvedPath)) {
            if (fs.lstatSync(resolvedPath).isDirectory()) {
                continue;
            }
            return resolvedPath;
        }
    }
    return false;
};

/**
 * Attempst to serve a response based on the given paths from which to serve files, and a requested path.
 *
 * @param {Response} res - a response object
 * @param {Function} next - the next handler if we don't serve the file
 * @param {Object} paths - a map of path prefix to filesystem path to serve files from
 * @param {string} originalUrl - the original requested path to serve
 * @param {string} baseDir - optional base dir that url must be prefixed with to be served by this middleware
 */
const serveResponse = (res, next, paths, originalUrl, baseDir) => {
    // if a base dir is specified, ignore anything thats not under it
    if (baseDir && !originalUrl.startsWith(`/${baseDir}/`)) {
        return next();
    }
    // strip off the /baseDir prefix if it exists, but leave the preceeding /
    const requestedPath = baseDir
        ? originalUrl.slice(`/${baseDir}`.length)
        : originalUrl;
    // resolve the requested file using the base path prefix
    const resolvedPath = checkPaths(paths, requestedPath);
    // if the file exists and is javascript transform it, otherwise just serve it
    if (resolvedPath) {
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

/**
 * A Karma middleware factory which uses the config.basePath to configure module resolution.
 *
 * @param {Object} config - the middleware configuration object, expected to contain a paths property mapping path
 *                          prefix to filesystem path
 * @returns {Function} - the karma middleware to be used with middleware configuration.
 */
const EsModulesMiddlewareFactory = function(config) {
    if (!config || !config.paths) {
        throw new Error(
            'Must specify a esModulesMiddleware configuration object containing a paths property.'
        );
    }
    const baseDir = config.baseDir || 'base'; // karma defaults to 'base' for user generated content

    return function(req, res, next) {
        return serveResponse(res, next, config.paths, req.originalUrl, baseDir);
    };
};

EsModulesMiddlewareFactory.$inject = ['config.esModulesMiddleware'];

/**
 * Connect-style middleware factory for use with express and similar servers.
 *
 * @param {Object} config - the middleware configuration object, expected to contain a paths property mapping path
 *                          prefix to filesystem path
 * @returns {Function} - returns the middleware which will resolve the paths based on the given paths map.
 */
function middleware(config) {
    if (!config.paths) {
        throw new Error(
            'Must specify a esModulesMiddleware configuration object containing a paths property.'
        );
    }
    return function(req, res, next) {
        return serveResponse(
            res,
            next,
            config.paths,
            req.originalUrl,
            config.baseDir
        );
    };
}
module.exports = {
    'middleware:es-modules': ['factory', EsModulesMiddlewareFactory],
    middleware,
};
