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
const testStatusBarProvider_1 = require("../testStatusBarProvider");
const Configs = require("../Constants/configs");
const protocols_1 = require("../Models/protocols");
const Logger = require("../Utils/Logger/logger");
const cp = require("child_process");
const vscode_1 = require("vscode");
class TestRunnerWrapper {
    static registerRunner(kind, runner) {
        TestRunnerWrapper.runnerPool.set(kind, runner);
    }
    static run(tests, isDebugMode, config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (TestRunnerWrapper.running) {
                vscode_1.window.showInformationMessage('A test session is currently running. Please wait until it finishes.');
                Logger.info('Skip this run cause we only support running one session at the same time');
                return;
            }
            TestRunnerWrapper.running = true;
            try {
                const runners = TestRunnerWrapper.classifyTests(tests);
                yield testStatusBarProvider_1.TestStatusBarProvider.getInstance().update(tests, (() => __awaiter(this, void 0, void 0, function* () {
                    for (const [runner, t] of runners.entries()) {
                        if (config && config.preLaunchTask.length > 0) {
                            yield this.execPreLaunchTask(config.workingDirectory, config.preLaunchTask);
                        }
                        const params = yield runner.setup(t, isDebugMode, config);
                        const res = yield runner.run(params);
                        this.updateTestStorage(t, res);
                        yield runner.postRun();
                    }
                }))());
            }
            finally {
                TestRunnerWrapper.running = false;
            }
        });
    }
    static classifyTests(tests) {
        return tests.reduce((map, t) => {
            const runner = this.getRunner(t);
            if (runner === null) {
                Logger.warn(`Cannot find matched runner to run the test: ${t.test}`, {
                    test: t,
                });
                return map;
            }
            const collection = map.get(runner);
            if (!collection) {
                map.set(runner, [t]);
            }
            else {
                collection.push(t);
            }
            return map;
        }, new Map());
    }
    static getRunner(test) {
        if (!TestRunnerWrapper.runnerPool.has(test.kind)) {
            return null;
        }
        return TestRunnerWrapper.runnerPool.get(test.kind);
    }
    static updateTestStorage(tests, result) {
        const mapper = result.reduce((total, cur) => {
            total.set(cur.test, cur.result);
            return total;
        }, new Map());
        const classesInflucenced = [];
        const flattenedTests = new Set(tests.map((t) => [t, t.parent, ...(t.children || [])])
            .reduce((total, cur) => total.concat(cur), [])
            .filter((t) => t));
        flattenedTests.forEach((t) => {
            if (mapper.has(t.test)) {
                t.result = mapper.get(t.test);
            }
            else if (t.level === protocols_1.TestLevel.Class) {
                classesInflucenced.push(t);
            }
        });
        classesInflucenced.forEach((c) => this.processClass(c));
    }
    static processClass(t) {
        let passNum = 0;
        let failNum = 0;
        let skipNum = 0;
        let duration = 0;
        let notRun = false;
        for (const child of t.children) {
            if (!child.result) {
                notRun = true;
                continue;
            }
            duration += Number(child.result.duration);
            switch (child.result.status) {
                case protocols_1.TestStatus.Pass:
                    passNum++;
                    break;
                case protocols_1.TestStatus.Fail:
                    failNum++;
                    break;
                case protocols_1.TestStatus.Skipped:
                    skipNum++;
                    break;
            }
        }
        t.result = {
            status: notRun ? undefined : (skipNum === t.children.length ? protocols_1.TestStatus.Skipped : (failNum > 0 ? protocols_1.TestStatus.Fail : protocols_1.TestStatus.Pass)),
            summary: `Tests run: ${passNum + failNum}, Failures: ${failNum}, Skipped: ${skipNum}.`,
            duration: notRun ? undefined : duration.toString(),
        };
    }
    static execPreLaunchTask(cwd, task) {
        return new Promise((resolve, reject) => {
            const process = cp.exec(task, { maxBuffer: Configs.CHILD_PROCESS_MAX_BUFFER_SIZE, cwd });
            process.on('error', (err) => {
                Logger.error(`Error occurred while executing prelaunch task. Name: ${err.name}. Message: ${err.message}. Stack: ${err.stack}.`, {
                    stack: err.stack,
                });
                reject(err);
            });
            process.stderr.on('data', (data) => {
                Logger.error(`Error occurred: ${data.toString()}`);
            });
            process.stdout.on('data', (data) => {
                Logger.info(data.toString());
            });
            process.on('close', (signal) => {
                if (signal && signal !== 0) {
                    reject(`Prelaunch task exited with code ${signal}.`);
                }
                else {
                    resolve(signal);
                }
            });
        });
    }
}
TestRunnerWrapper.runnerPool = new Map();
TestRunnerWrapper.running = false;
exports.TestRunnerWrapper = TestRunnerWrapper;
//# sourceMappingURL=testRunnerWrapper.js.map