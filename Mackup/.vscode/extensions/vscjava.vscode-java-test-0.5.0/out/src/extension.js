// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const expandHomeDir = require("expand-home-dir");
const findJavaHome = require("find-java-home");
const path = require("path");
const pathExists = require("path-exists");
// tslint:disable-next-line
const vscode_1 = require("vscode");
const vscode_extension_telemetry_wrapper_1 = require("vscode-extension-telemetry-wrapper");
const classPathManager_1 = require("./classPathManager");
const junitCodeLensProvider_1 = require("./junitCodeLensProvider");
const projectManager_1 = require("./projectManager");
const testConfigManager_1 = require("./testConfigManager");
const testReportProvider_1 = require("./testReportProvider");
const testResourceManager_1 = require("./testResourceManager");
const testStatusBarProvider_1 = require("./testStatusBarProvider");
const Commands = require("./Constants/commands");
const Configs = require("./Constants/configs");
const Constants = require("./Constants/constants");
const testExplorer_1 = require("./Explorer/testExplorer");
const protocols_1 = require("./Models/protocols");
const testRunnerWrapper_1 = require("./Runner/testRunnerWrapper");
const junit5TestRunner_1 = require("./Runner/JUnitTestRunner/junit5TestRunner");
const junitTestRunner_1 = require("./Runner/JUnitTestRunner/junitTestRunner");
const commandUtility_1 = require("./Utils/commandUtility");
const Logger = require("./Utils/Logger/logger");
const outputTransport_1 = require("./Utils/Logger/outputTransport");
const telemetryTransport_1 = require("./Utils/Logger/telemetryTransport");
const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const onDidChange = new vscode_1.EventEmitter();
const testStatusBarItem = testStatusBarProvider_1.TestStatusBarProvider.getInstance();
const outputChannel = vscode_1.window.createOutputChannel('Test Output');
const testResourceManager = new testResourceManager_1.TestResourceManager();
const classPathManager = new classPathManager_1.ClassPathManager();
const projectManager = new projectManager_1.ProjectManager();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        activateTelemetry(context);
        Logger.configure(context, [new telemetryTransport_1.TelemetryTransport({ level: 'warn' }), new outputTransport_1.OutputTransport({ level: 'info', channel: outputChannel })]);
        yield testStatusBarItem.init(testResourceManager.refresh());
        const codeLensProvider = new junitCodeLensProvider_1.JUnitCodeLensProvider(onDidChange, testResourceManager);
        context.subscriptions.push(vscode_1.languages.registerCodeLensProvider(Configs.LANGUAGE, codeLensProvider));
        const testReportProvider = new testReportProvider_1.TestReportProvider(context, testResourceManager);
        context.subscriptions.push(vscode_1.workspace.registerTextDocumentContentProvider(testReportProvider_1.TestReportProvider.scheme, testReportProvider));
        const testExplorer = new testExplorer_1.TestExplorer(context, testResourceManager);
        context.subscriptions.push(vscode_1.window.registerTreeDataProvider(Constants.TEST_EXPLORER_VIEW_ID, testExplorer));
        testResourceManager.onDidChangeTestStorage((e) => {
            testExplorer.refresh();
        });
        const testConfigManager = new testConfigManager_1.TestConfigManager(projectManager);
        vscode_1.workspace.onDidChangeTextDocument((event) => {
            const uri = event.document.uri;
            testResourceManager.setDirty(uri);
            // onDidChange.fire();
        });
        vscode_1.workspace.onDidSaveTextDocument((document) => {
            const uri = document.uri;
            testResourceManager.setDirty(uri);
            onDidChange.fire();
        });
        checkJavaHome().then((javaHome) => {
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_RUN_TEST_COMMAND, (suites) => runTest(suites, false)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_DEBUG_TEST_COMMAND, (suites) => runTest(suites, true)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_SHOW_REPORT, (test) => showDetails(test)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_SHOW_OUTPUT, () => outputChannel.show()));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_SELECT, (node) => testExplorer.select(node)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_RUN_TEST, (node) => testExplorer.run(node, false)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_DEBUG_TEST, (node) => testExplorer.run(node, true)));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_RUN_WITH_CONFIG_COMMAND, (suites) => __awaiter(this, void 0, void 0, function* () {
                const config = yield getTestConfig(testConfigManager, false);
                return runTest(suites, false, config);
            })));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_DEBUG_WITH_CONFIG_COMMAND, (suites) => __awaiter(this, void 0, void 0, function* () {
                const config = yield getTestConfig(testConfigManager, true);
                return runTest(suites, true, config);
            })));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_RUN_TEST_WITH_CONFIG, (node) => __awaiter(this, void 0, void 0, function* () {
                const config = yield getTestConfig(testConfigManager, false);
                return testExplorer.run(node, false, config);
            })));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_EXPLORER_DEBUG_TEST_WITH_CONFIG, (node) => __awaiter(this, void 0, void 0, function* () {
                const config = yield getTestConfig(testConfigManager, true);
                return testExplorer.run(node, true, config);
            })));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_TEST_OPEN_LOG, () => openTestLogFile(context.asAbsolutePath(Configs.LOG_FILE_NAME))));
            context.subscriptions.push(vscode_extension_telemetry_wrapper_1.TelemetryWrapper.registerCommand(Commands.JAVA_CONFIGURE_TEST_COMMAND, () => testConfigManager.editConfig()));
            testRunnerWrapper_1.TestRunnerWrapper.registerRunner(protocols_1.TestKind.JUnit, new junitTestRunner_1.JUnitTestRunner(javaHome, context.storagePath, classPathManager, onDidChange));
            testRunnerWrapper_1.TestRunnerWrapper.registerRunner(protocols_1.TestKind.JUnit5, new junit5TestRunner_1.JUnit5TestRunner(javaHome, context.storagePath, classPathManager, onDidChange));
            classPathManager.refresh();
            projectManager.refresh();
        }).catch((err) => {
            vscode_1.window.showErrorMessage("couldn't find Java home...");
            Logger.error("couldn't find Java home.", {
                error: err,
            });
        });
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    testResourceManager.dispose();
    classPathManager.dispose();
    testStatusBarItem.dispose();
    commandUtility_1.CommandUtility.clearCommandsCache();
}
exports.deactivate = deactivate;
function activateTelemetry(context) {
    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    if (extensionPackage) {
        const packageInfo = {
            publisher: extensionPackage.publisher,
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey,
        };
        if (packageInfo.aiKey) {
            vscode_extension_telemetry_wrapper_1.TelemetryWrapper.initilize(packageInfo.publisher, packageInfo.name, packageInfo.version, packageInfo.aiKey);
            vscode_extension_telemetry_wrapper_1.TelemetryWrapper.sendTelemetryEvent(Constants.TELEMETRY_ACTIVATION_SCOPE, {});
        }
    }
}
function checkJavaHome() {
    return new Promise((resolve, reject) => {
        let javaHome = readJavaConfig();
        if (!javaHome) {
            javaHome = process.env[Constants.JDK_HOME];
            if (!javaHome) {
                javaHome = process.env[Constants.JAVA_HOME];
            }
        }
        if (javaHome) {
            javaHome = expandHomeDir(javaHome);
            if (pathExists.sync(javaHome) && pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
                return resolve(javaHome);
            }
        }
        findJavaHome((err, home) => {
            if (err) {
                reject(err);
            }
            resolve(home);
        });
    });
}
function readJavaConfig() {
    const config = vscode_1.workspace.getConfiguration();
    return config.get('java.home', null);
}
function runTest(tests, isDebugMode, config) {
    outputChannel.clear();
    const testList = Array.isArray(tests) ? tests : [tests];
    return testRunnerWrapper_1.TestRunnerWrapper.run(testList, isDebugMode, config);
}
function getTestConfig(configManager, isDebugMode) {
    return __awaiter(this, void 0, void 0, function* () {
        let config;
        try {
            config = yield configManager.loadConfig();
        }
        catch (ex) {
            vscode_1.window.showErrorMessage('Failed to load the test config! Please check whether your test configuration is a valid JSON file');
            throw ex;
        }
        const runConfigs = isDebugMode ? config.debug : config.run;
        const items = runConfigs.map((c) => {
            return {
                label: c.name,
                description: `project name: ${c.projectName}`,
                item: c,
            };
        });
        const selection = yield vscode_1.window.showQuickPick(items, { placeHolder: 'Select test config' });
        if (!selection) {
            vscode_1.window.showErrorMessage('Please specify the test config to use!');
            throw new Error('Please specify the test config to use');
        }
        return selection.item;
    });
}
function showDetails(test) {
    const testList = Array.isArray(test) ? test : [test];
    const uri = testReportProvider_1.encodeTestSuite(testList);
    const name = testReportProvider_1.parseTestReportName(testList);
    const config = vscode_1.workspace.getConfiguration();
    const position = config.get('java.test.report.position', 'sideView');
    return vscode_1.commands.executeCommand('vscode.previewHtml', uri, position === 'sideView' ? vscode_1.ViewColumn.Two : vscode_1.ViewColumn.Active, name);
}
function openTestLogFile(logFile) {
    return vscode_1.workspace.openTextDocument(logFile).then((doc) => {
        return vscode_1.window.showTextDocument(doc);
    }, () => false).then((didOpen) => {
        if (!didOpen) {
            vscode_1.window.showWarningMessage('Could not open Test Log file');
        }
        return didOpen ? true : false;
    });
}
//# sourceMappingURL=extension.js.map