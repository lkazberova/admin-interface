/**
 * @module src/Utils/Yaml/Parser
 * @flow
 */
import path        from 'path';
import fs          from 'fs';
import yaml        from 'js-yaml';
import yamlInclude from 'yaml-include';
import lodash      from 'lodash';
import globby      from 'globby';
import Registry    from '../../Registry/Registry';

/**
 * Parse config object
 * @param {any} obj
 * @param {string} dirname
 * @param {any} type
 * @returns {any}
 */
export function configParser(obj: any, dirname: string, type: any = {}, cache: {[key: string]: string} = {}): any {
    let imported: any = type;

    lodash.forIn(obj, (filePath, key) => {
        if (typeof filePath === 'object') {
            if (!isNaN(Number(key))) { // eslint-disable-line no-restricted-globals
                imported[ key ] = filePath;
                imported        = lodash.values(imported);
            } else {
                imported[ key ] = configParser(filePath, dirname, {}, cache);
            }
        }

        if (Array.isArray(filePath)) {
            imported[ key ] = configParser(filePath, dirname, [], cache);
        }

        if (typeof filePath === 'string') {
            if (filePath.substr(0, 2) === './' || filePath.substr(0, 8) === '[module]') {
                let fsPath: string = '';

                if (filePath.substr(0, 8) === '[module]') {
                    const moduleInfo: Array<string> = filePath.split(' ');
                    const modulePath: Array<string> = moduleInfo[ 1 ].split('/');
                    const moduleName: string = moduleInfo[ 1 ][ 0 ] === '@' ? `${ modulePath[ 0 ] }/${  modulePath[ 1 ] }` : modulePath[ 0 ];
                    const moduleFile: string = modulePath.join('/').replace(moduleName, '');

                    if (!cache[ moduleName ]) {
                        // eslint-disable-next-line no-param-reassign
                        cache[ moduleName ] = globby.sync(`${ process.cwd() }/node_modules/**/**/${ moduleName }/`, {
                            nodir: false
                        })[ 0 ];
                    }

                    if (cache[ moduleName ]) {
                        fsPath = path.join(cache[ moduleName ], moduleFile);

                        global.console.log('connected module [%s]: %s', moduleName, fsPath);
                        global.console.log('------------------');
                    } else {
                        global.console.log('module not found [%s]: %s', moduleName, fsPath);
                        global.console.log('------------------');
                    }
                } else {
                    fsPath = path.join(dirname, filePath);
                }

                if (fsPath.length) {
                    const info = fs.statSync(fsPath);

                    if (info.isFile()) {
                        // eslint-disable-next-line global-require, import/no-dynamic-require
                        imported[ key ] = require(fsPath);
                    }
                    if (info.isDirectory()) {
                        imported[ key ] = fsPath;
                    }
                }
            } else if (!isNaN(Number(key))) { // eslint-disable-line no-restricted-globals
                imported[ key ] = filePath;
                imported        = lodash.values(imported);
            } else {
                imported[ key ] = filePath;
            }
        }
    });
    // console.log(imported);
    return imported;
}

/**
 * Parser yarn fie
 * @param {string} pathConfigFile
 * @returns {{any}}
 */
export function yamlParse(pathConfigFile: string): { [string]: any } {
    yamlInclude.setBaseFile(pathConfigFile);

    const configSrc = fs.readFileSync(pathConfigFile, 'utf8');

    return yaml.load(configSrc, {
        schema:   yamlInclude.YAML_INCLUDE_SCHEMA,
        filename: yamlInclude.basefile
    });
}

/**
 * Parse yaml config file
 * @param {string} dirname
 * @param {string} configFile
 * @returns {{any}}
 */
export function yamlConfigParse(dirname: string, configFile: string): { [string]: any } {
    const configPath = path.join(dirname, configFile);
    const config     = yamlParse(configPath);
    return configParser(config, dirname);
}

/**
 * Parse yaml routing file
 * @param {string} dirname
 * @param {string} configFile
 * @returns {{any}}
 */
export function yamlConfigRoutingParser(dirname: string, configFile: string): { [string]: any } {
    const config = yamlConfigParse(dirname, configFile);
    // Set handler of route
    Object.keys(config).forEach(key => {
        config[ key ].handler = config[ key ].controller[ config[ key ].action ];
    });
    return config;
}
