'use strict';
var vscode = require('vscode');
var fs = require('fs');
var cp = require('child_process');
var tmp = require("tmp");
var dumpError = function (e) {
    if (e)
        console.log('elm-format err:', e);
    return [];
};
// registered on actiation
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('elm-format.format', formatCommand));
    startOnSaveWatcher(context.subscriptions);
}
exports.activate = activate;
function startOnSaveWatcher(subscriptions) {
    var ignoreNextSave = new WeakSet();
    vscode.workspace.onDidSaveTextDocument(function (document) {
        if (document.languageId !== 'elm' || ignoreNextSave.has(document)) {
            return;
        }
        var config = vscode.workspace.getConfiguration('elm-format');
        var active = vscode.window.activeTextEditor;
        var range = new vscode.Range(0, 0, document.lineCount, document.getText().length);
        if (config['formatOnSave'] && active.document === document) {
            format()
                .then(function () {
                ignoreNextSave.add(document);
                return document.save();
            })
                .then(function () {
                ignoreNextSave.delete(document);
            });
        }
    }, null, subscriptions);
}
function formatCommand() {
    format()
        .then(function () {
        vscode.window.showInformationMessage('Succesfully formatting your Elm code.');
    });
}
function format() {
    var active = vscode.window.activeTextEditor;
    if (!active)
        return;
    if (!active.document)
        return;
    var document = active.document;
    var range = new vscode.Range(0, 0, document.lineCount, document.getText().length);
    var originalText = document.getText(document.validateRange(range));
    return createTmp(originalText)
        .then(runElmFormat)
        .then(readFile)
        .then(function (newText) { return updateEditor(newText, active, range); })
        .catch(function (err) {
        vscode.window.showErrorMessage(err);
    });
}
function updateEditor(newText, active, range) {
    return active.edit(function (editor) { return editor.replace(range, newText); });
}
function createTmp(originalText) {
    return new Promise(function (resolve, reject) {
        tmp.file({ postfix: '.elm' }, function (err, path, fd) {
            if (err)
                throw err;
            console.log("Creating a temporary .elm file: ", path);
            fs.write(fd, originalText, function () {
                resolve(path);
            });
        });
    });
}
function runElmFormat(path) {
    return new Promise(function (resolve, reject) {
        console.log("Executing elm-format");
        var bStderr = new Buffer(0);
        var process = cp.spawn('elm-format', [path, '--yes']);
        if (!process.pid) {
            reject("Unable to execute elm-format. Please make sure you have elm-format on your PATH");
        }
        process.stderr.on('data', function (stderr) {
            bStderr = Buffer.concat([bStderr, new Buffer(stderr)]);
        });
        process.stdout.on('end', function (code) {
            if (!!code) {
                reject(bStderr.toString());
            }
            resolve(path);
        });
    });
}
function readFile(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.toString());
            }
        });
    });
}
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map