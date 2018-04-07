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
const vscode_1 = require("vscode");
const Commands = require("./Constants/commands");
const Logger = require("./Utils/Logger/logger");
class ClassPathManager {
    constructor() {
        this.classPathCache = new Map();
    }
    refresh(token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode_1.workspace.workspaceFolders) {
                return;
            }
            return Promise.all(vscode_1.workspace.workspaceFolders.map((wkspace) => {
                return calculateClassPath(wkspace.uri).then((classpath) => {
                    this.storeClassPath(wkspace.uri, classpath);
                }, (reason) => {
                    if (token.isCancellationRequested) {
                        return;
                    }
                    Logger.error(`Failed to refresh class path. Details: ${reason}.`);
                    return Promise.reject(reason);
                });
            }));
        });
    }
    dispose() {
        this.classPathCache.clear();
    }
    getClassPath(wkspace) {
        const path = this.getWorkspaceFolderPath(wkspace) || '';
        return this.classPathCache.has(path) ? this.classPathCache.get(path) : undefined;
    }
    getClassPaths(wkspaces) {
        const set = new Set(wkspaces.map((w) => this.getWorkspaceFolderPath(w)).filter((p) => p && this.classPathCache.has(p)));
        return [...set].map((p) => this.classPathCache.get(p)).reduce((a, b) => a.concat(b), []);
    }
    storeClassPath(wkspace, classPath) {
        const path = this.getWorkspaceFolderPath(wkspace) || '';
        this.classPathCache.set(path, classPath);
    }
    getWorkspaceFolderPath(resource) {
        const folder = vscode_1.workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.path : undefined;
    }
}
exports.ClassPathManager = ClassPathManager;
function calculateClassPath(folder) {
    return Commands.executeJavaLanguageServerCommand(Commands.JAVA_CALCULATE_CLASS_PATH, folder.toString());
}
//# sourceMappingURL=classPathManager.js.map