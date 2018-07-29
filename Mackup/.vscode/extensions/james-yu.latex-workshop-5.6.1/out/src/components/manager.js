"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const glob = require("glob");
class Manager {
    constructor(extension) {
        this.texFileTree = {};
        this.extension = extension;
        this.watched = [];
        this.rootFiles = {};
        this.rootOfFiles = {};
        this.workspace = '';
    }
    get rootDir() {
        return path.dirname(this.rootFile);
    }
    get rootFile() {
        const root = this.documentRoot();
        if (root) {
            this.rootFiles[this.workspace] = root;
            return root;
        }
        return this.rootFiles[this.workspace];
    }
    set rootFile(root) {
        this.rootFiles[this.workspace] = root;
    }
    documentRoot() {
        const window = vscode.window.activeTextEditor;
        if (window && window.document && this.rootOfFiles.hasOwnProperty(window.document.fileName)) {
            return this.rootOfFiles[window.document.fileName];
        }
        return undefined;
    }
    tex2pdf(texPath, respectOutDir = true) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const outputDir = respectOutDir ? configuration.get('latex.outputDir') : './';
        return path.resolve(path.dirname(texPath), outputDir, path.basename(`${texPath.substr(0, texPath.lastIndexOf('.'))}.pdf`));
    }
    isTex(filePath) {
        return ['.tex', '.sty', '.cls', '.bbx', '.cbx', '.dtx'].indexOf(path.extname(filePath)) > -1;
    }
    updateWorkspace() {
        let wsroot = vscode.workspace.rootPath;
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor) {
            const wsfolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri);
            if (wsfolder) {
                wsroot = wsfolder.uri.fsPath;
            }
        }
        if (wsroot) {
            if (wsroot !== this.workspace) {
                this.workspace = wsroot;
                this.extension.nodeProvider.refresh();
                this.extension.nodeProvider.update();
            }
        }
        else {
            this.workspace = '';
        }
    }
    findRoot() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateWorkspace();
            const findMethods = [() => this.findRootMagic(), () => this.findRootSelf(), () => this.findRootSaved(), () => this.findRootDir()];
            for (const method of findMethods) {
                const rootFile = yield method();
                if (rootFile !== undefined) {
                    if (this.rootFile !== rootFile) {
                        this.extension.logger.addLogMessage(`Root file changed from: ${this.rootFile}. Find all dependencies.`);
                        this.rootFile = rootFile;
                        this.findAllDependentFiles(rootFile);
                        this.updateRootOfFiles(rootFile, rootFile);
                    }
                    else {
                        this.extension.logger.addLogMessage(`Root file remains unchanged from: ${this.rootFile}.`);
                    }
                    return rootFile;
                }
            }
            return undefined;
        });
    }
    updateRootOfFiles(root, file) {
        if (this.texFileTree.hasOwnProperty(file)) {
            this.rootOfFiles[file] = root;
            for (const f of this.texFileTree[file]) {
                this.updateRootOfFiles(root, f);
            }
        }
    }
    findRootMagic() {
        if (!vscode.window.activeTextEditor) {
            return undefined;
        }
        const regex = /(?:%\s*!\s*T[Ee]X\sroot\s*=\s*([^\s]*\.tex)$)/m;
        const content = vscode.window.activeTextEditor.document.getText();
        const result = content.match(regex);
        if (result) {
            const file = path.resolve(path.dirname(vscode.window.activeTextEditor.document.fileName), result[1]);
            this.extension.logger.addLogMessage(`Found root file by magic comment: ${file}`);
            return file;
        }
        return undefined;
    }
    findRootSelf() {
        if (!vscode.window.activeTextEditor) {
            return undefined;
        }
        const regex = /\\begin{document}/m;
        const content = vscode.window.activeTextEditor.document.getText();
        const result = content.match(regex);
        if (result) {
            const file = vscode.window.activeTextEditor.document.fileName;
            this.extension.logger.addLogMessage(`Found root file from active editor: ${file}`);
            return file;
        }
        return undefined;
    }
    findSubFiles() {
        if (!vscode.window.activeTextEditor) {
            return undefined;
        }
        const regex = /(?:\\documentclass\[(.*(?:\.tex))\]{subfiles})/;
        const content = vscode.window.activeTextEditor.document.getText();
        const result = content.match(regex);
        if (result) {
            const file = path.join(path.dirname(vscode.window.activeTextEditor.document.fileName), result[1]);
            this.extension.logger.addLogMessage(`Found root file of this subfile from active editor: ${file}`);
            return file;
        }
        return undefined;
    }
    findRootSaved() {
        return this.documentRoot();
    }
    findRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            const regex = /\\begin{document}/m;
            if (!this.workspace) {
                return undefined;
            }
            try {
                const urls = yield vscode.workspace.findFiles('**/*.tex', undefined);
                for (const url of urls) {
                    const content = fs.readFileSync(url.fsPath);
                    const result = content.toString().match(regex);
                    if (result) {
                        const file = url.fsPath;
                        this.extension.logger.addLogMessage(`Try root file in root directory: ${file}`);
                        const window = vscode.window;
                        if (window && window.activeTextEditor && this.isRoot(url.fsPath, window.activeTextEditor.document.fileName, true)) {
                            this.extension.logger.addLogMessage(`Found root file in root directory: ${file}`);
                            return file;
                        }
                    }
                }
            }
            catch (e) { }
            return undefined;
        });
    }
    isRoot(root, file, updateDependent = false) {
        if (!fs.existsSync(root)) {
            return false;
        }
        if (root === file) {
            return true;
        }
        if (updateDependent) {
            this.findDependentFiles(root, undefined, true);
        }
        if (!this.texFileTree.hasOwnProperty(root) || !this.texFileTree.hasOwnProperty(file)) {
            return false;
        }
        for (const r of this.texFileTree[root]) {
            if (this.isRoot(r, file)) {
                return true;
            }
        }
        return false;
    }
    findAllDependentFiles(rootFile) {
        let prevWatcherClosed = false;
        if (this.fileWatcher !== undefined && this.watched.indexOf(rootFile) < 0) {
            // We have an instantiated fileWatcher, but the rootFile is not being watched.
            // => the user has changed the root. Clean up the old watcher so we reform it.
            this.extension.logger.addLogMessage(`Root file changed -> cleaning up old file watcher.`);
            this.fileWatcher.close();
            this.watched = [];
            prevWatcherClosed = true;
        }
        if (prevWatcherClosed || this.fileWatcher === undefined) {
            this.extension.logger.addLogMessage(`Instatiating new file watcher for ${rootFile}`);
            this.fileWatcher = chokidar.watch(rootFile);
            this.watched.push(rootFile);
            this.fileWatcher.on('change', (filePath) => {
                this.extension.logger.addLogMessage(`File watcher: responding to change in ${filePath}`);
                this.findDependentFiles(filePath);
            });
            this.fileWatcher.on('unlink', (filePath) => __awaiter(this, void 0, void 0, function* () {
                this.extension.logger.addLogMessage(`File watcher: ${filePath} deleted.`);
                this.fileWatcher.unwatch(filePath);
                this.watched.splice(this.watched.indexOf(filePath), 1);
                if (filePath === rootFile) {
                    this.extension.logger.addLogMessage(`Deleted ${filePath} was root - triggering root search`);
                    yield this.findRoot();
                }
            }));
            this.findDependentFiles(rootFile);
            const configuration = vscode.workspace.getConfiguration('latex-workshop');
            const additionalBib = configuration.get('latex.additionalBib');
            for (const bibGlob of additionalBib) {
                glob(bibGlob, { cwd: this.extension.manager.rootDir }, (err, files) => {
                    if (err) {
                        this.extension.logger.addLogMessage(`Error identifying additional bibfile with glob ${bibGlob}: ${files}.`);
                        return;
                    }
                    for (const bib of files) {
                        this.extension.logger.addLogMessage(`Try to watch global bibliography file ${bib}.`);
                        this.addBibToWatcher(bib, this.extension.manager.rootDir);
                    }
                });
            }
        }
    }
    findDependentFiles(filePath, rootDir = undefined, fast = false) {
        if (!rootDir) {
            rootDir = path.dirname(filePath);
        }
        this.extension.logger.addLogMessage(`Parsing ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const inputReg = /(?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/g;
        this.texFileTree[filePath] = new Set();
        while (true) {
            const result = inputReg.exec(content);
            if (!result) {
                break;
            }
            const inputFile = result[1];
            let inputFilePath = path.resolve(path.join(rootDir, inputFile));
            if (path.extname(inputFilePath) === '') {
                inputFilePath += '.tex';
            }
            if (!fs.existsSync(inputFilePath) && fs.existsSync(inputFilePath + '.tex')) {
                inputFilePath += '.tex';
            }
            if (fs.existsSync(inputFilePath)) {
                this.texFileTree[filePath].add(inputFilePath);
                if (!fast && this.fileWatcher && this.watched.indexOf(inputFilePath) < 0) {
                    this.extension.logger.addLogMessage(`Adding ${inputFilePath} to file watcher.`);
                    this.fileWatcher.add(inputFilePath);
                    this.watched.push(inputFilePath);
                }
                this.findDependentFiles(inputFilePath, rootDir);
            }
        }
        if (fast) {
            return;
        }
        const bibReg = /(?:\\(?:bibliography|addbibresource)(?:\[[^\[\]\{\}]*\])?){(.+?)}/g;
        while (true) {
            const result = bibReg.exec(content);
            if (!result) {
                break;
            }
            const bibs = result[1].split(',').map((bib) => {
                return bib.trim();
            });
            for (const bib of bibs) {
                this.addBibToWatcher(bib, rootDir);
            }
        }
        this.extension.completer.command.getCommandsTeX(filePath);
        this.extension.completer.reference.getReferencesTeX(filePath);
    }
    addBibToWatcher(bib, rootDir) {
        let bibPath;
        if (path.isAbsolute(bib)) {
            bibPath = bib;
        }
        else {
            bibPath = path.resolve(path.join(rootDir, bib));
        }
        if (path.extname(bibPath) === '') {
            bibPath += '.bib';
        }
        if (!fs.existsSync(bibPath) && fs.existsSync(bibPath + '.bib')) {
            bibPath += '.bib';
        }
        if (fs.existsSync(bibPath)) {
            this.extension.logger.addLogMessage(`Found .bib file ${bibPath}`);
            if (this.bibWatcher === undefined) {
                this.extension.logger.addLogMessage(`Creating file watcher for .bib files.`);
                this.bibWatcher = chokidar.watch(bibPath);
                this.bibWatcher.on('change', (filePath) => {
                    this.extension.logger.addLogMessage(`Bib file watcher - responding to change in ${filePath}`);
                    this.extension.completer.citation.parseBibFile(filePath);
                });
                this.bibWatcher.on('unlink', (filePath) => {
                    this.extension.logger.addLogMessage(`Bib file watcher: ${filePath} deleted.`);
                    this.extension.completer.citation.forgetParsedBibItems(filePath);
                    this.bibWatcher.unwatch(filePath);
                    this.watched.splice(this.watched.indexOf(filePath), 1);
                });
                this.extension.completer.citation.parseBibFile(bibPath);
            }
            else if (this.watched.indexOf(bibPath) < 0) {
                this.extension.logger.addLogMessage(`Adding .bib file ${bibPath} to bib file watcher.`);
                this.bibWatcher.add(bibPath);
                this.watched.push(bibPath);
                this.extension.completer.citation.parseBibFile(bibPath);
            }
            else {
                this.extension.logger.addLogMessage(`.bib file ${bibPath} is already being watched.`);
            }
        }
    }
}
exports.Manager = Manager;
//# sourceMappingURL=manager.js.map