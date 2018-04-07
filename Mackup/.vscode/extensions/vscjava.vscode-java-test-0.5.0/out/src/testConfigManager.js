"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const vscode_1 = require("vscode");
const Configs = require("./Constants/configs");
const Logger = require("./Utils/Logger/logger");
class TestConfigManager {
    constructor(_projectManager) {
        this._projectManager = _projectManager;
        const workspaceFolders = vscode_1.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('Not supported without a folder!');
        }
        this._configPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', Configs.TEST_LAUNCH_CONFIG_NAME);
    }
    get configPath() {
        return this._configPath;
    }
    loadConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createTestConfigIfNotExisted();
            return new Promise((resolve, reject) => {
                fs.readFile(this._configPath, 'utf-8', (readErr, data) => {
                    if (readErr) {
                        Logger.error('Failed to read the test config!', {
                            error: readErr,
                        });
                        return reject(readErr);
                    }
                    try {
                        const config = JSON.parse(data);
                        resolve(config);
                    }
                    catch (ex) {
                        Logger.error('Failed to parse the test config!', {
                            error: ex,
                        });
                        reject(ex);
                    }
                });
            });
        });
    }
    editConfig() {
        const editor = vscode_1.window.activeTextEditor;
        return this.createTestConfigIfNotExisted().then(() => {
            return vscode_1.workspace.openTextDocument(this._configPath).then((doc) => {
                return vscode_1.window.showTextDocument(doc, editor ? editor.viewColumn : undefined);
            }, (err) => {
                return Promise.reject(err);
            });
        });
    }
    createTestConfigIfNotExisted() {
        return new Promise((resolve, reject) => {
            mkdirp(path.dirname(this._configPath), (merr) => {
                if (merr && merr.code !== 'EEXIST') {
                    Logger.error(`Failed to create sub directory for this config. File path: ${this._configPath}`, {
                        error: merr,
                    });
                    return reject(merr);
                }
                fs.access(this._configPath, (err) => {
                    if (err) {
                        const config = this.createDefaultTestConfig();
                        const content = JSON.stringify(config, null, 4);
                        fs.writeFile(this._configPath, content, 'utf-8', (writeErr) => {
                            if (writeErr) {
                                Logger.error('Failed to create default test config!', {
                                    error: writeErr,
                                });
                                return reject(writeErr);
                            }
                        });
                    }
                    resolve();
                });
            });
        });
    }
    createDefaultTestConfig() {
        const projects = this._projectManager.getAll();
        const config = {
            run: projects.map((i) => {
                return {
                    name: i.name,
                    projectName: i.name,
                    workingDirectory: vscode_1.workspace.getWorkspaceFolder(i.path).uri.fsPath,
                    args: [],
                    vmargs: [],
                    preLaunchTask: '',
                };
            }),
            debug: projects.map((i) => {
                return {
                    name: i.name,
                    projectName: i.name,
                    workingDirectory: vscode_1.workspace.getWorkspaceFolder(i.path).uri.fsPath,
                    args: [],
                    vmargs: [],
                    preLaunchTask: '',
                };
            }),
        };
        return config;
    }
}
exports.TestConfigManager = TestConfigManager;
//# sourceMappingURL=testConfigManager.js.map