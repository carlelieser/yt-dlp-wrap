var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EventEmitter } from 'events';
import { execFile, execSync, spawn, } from 'child_process';
import fs from 'fs';
import https from 'https';
import os from 'os';
import { Readable } from 'stream';
const executableName = 'yt-dlp';
const shellPath = "";
const progressRegex = /\[download] *(.*) of ([^ ]*)(:? *at *([^ ]*))?(:? *ETA *([^ ]*))?/;
export default class YTDlpWrap {
    constructor(binaryPath = executableName, shell = shellPath) {
        this.binaryPath = binaryPath;
        this.shell = shell;
    }
    execSync(command) {
        return execSync(command, {
            shell: this.shell
        });
    }
    setShell(path) {
        this.shell = path;
    }
    getBinaryPath() {
        return this.binaryPath;
    }
    setBinaryPath(binaryPath) {
        this.binaryPath = binaryPath;
    }
    static createGetMessage(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (httpResponse) => {
                httpResponse.on('error', (e) => reject(e));
                resolve(httpResponse);
            });
        });
    }
    static processMessageToFile(message, filePath) {
        const file = fs.createWriteStream(filePath);
        return new Promise((resolve, reject) => {
            message.pipe(file);
            message.on('error', (e) => reject(e));
            file.on('finish', () => message.statusCode == 200 ? resolve(message) : reject(message));
        });
    }
    static downloadFile(fileURL, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let currentUrl = fileURL;
            while (currentUrl) {
                const message = yield YTDlpWrap.createGetMessage(currentUrl);
                if (message.headers.location) {
                    currentUrl = message.headers.location;
                }
                else {
                    return yield YTDlpWrap.processMessageToFile(message, filePath);
                }
            }
        });
    }
    static getGithubReleases(page = 1, perPage = 1) {
        return new Promise((resolve, reject) => {
            const apiURL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases?page=' +
                page +
                '&per_page=' +
                perPage;
            https.get(apiURL, { headers: { 'User-Agent': 'node' } }, (response) => {
                let resonseString = '';
                response.setEncoding('utf8');
                response.on('data', (body) => (resonseString += body));
                response.on('error', (e) => reject(e));
                response.on('end', () => response.statusCode == 200
                    ? resolve(JSON.parse(resonseString))
                    : reject(response));
            });
        });
    }
    static downloadFromGithub(filePath, version, platform = os.platform()) {
        return __awaiter(this, void 0, void 0, function* () {
            const isWin32 = platform == 'win32';
            const fileName = `${executableName}${isWin32 ? '.exe' : ''}`;
            if (!version)
                version = (yield YTDlpWrap.getGithubReleases(1, 1))[0].tag_name;
            if (!filePath)
                filePath = './' + fileName;
            let fileURL = 'https://github.com/yt-dlp/yt-dlp/releases/download/' +
                version +
                '/' +
                fileName;
            yield YTDlpWrap.downloadFile(fileURL, filePath);
            !isWin32 && fs.chmodSync(filePath, '777');
        });
    }
    exec(ytDlpArguments = [], options = {}, abortSignal = null) {
        options = this.setDefaultOptions(options);
        const execEventEmitter = new EventEmitter();
        const ytDlpProcess = spawn(this.binaryPath, ytDlpArguments, options);
        execEventEmitter.ytDlpProcess = ytDlpProcess;
        this.bindAbortSignal(abortSignal, ytDlpProcess);
        let stderrData = '';
        let processError;
        ytDlpProcess.stdout.on('data', (data) => YTDlpWrap.emitYoutubeDlEvents(data.toString(), execEventEmitter));
        ytDlpProcess.stderr.on('data', (data) => (stderrData += data.toString()));
        ytDlpProcess.on('error', (error) => (processError = error));
        ytDlpProcess.on('close', (code) => {
            if (code === 0 || ytDlpProcess.killed)
                execEventEmitter.emit('close', code);
            else
                execEventEmitter.emit('error', YTDlpWrap.createError(code, processError, stderrData));
        });
        return execEventEmitter;
    }
    execPromise(ytDlpArguments = [], options = {}, abortSignal = null) {
        let ytDlpProcess;
        const ytDlpPromise = new Promise((resolve, reject) => {
            options = this.setDefaultOptions(options);
            ytDlpProcess = execFile(this.binaryPath, ytDlpArguments, options, (error, stdout, stderr) => {
                if (error)
                    reject(YTDlpWrap.createError(error, null, stderr));
                resolve(stdout);
            });
            this.bindAbortSignal(abortSignal, ytDlpProcess);
        });
        ytDlpPromise.ytDlpProcess = ytDlpProcess;
        return ytDlpPromise;
    }
    execStream(ytDlpArguments = [], options = {}, abortSignal = null) {
        const readStream = new Readable({ read() { } });
        options = this.setDefaultOptions(options);
        ytDlpArguments = ytDlpArguments.concat(['-o', '-']);
        const ytDlpProcess = spawn(this.binaryPath, ytDlpArguments, options);
        readStream.ytDlpProcess = ytDlpProcess;
        this.bindAbortSignal(abortSignal, ytDlpProcess);
        let stderrData = '';
        let processError;
        ytDlpProcess.stdout.on('data', (data) => readStream.push(data));
        ytDlpProcess.stderr.on('data', (data) => {
            let stringData = data.toString();
            YTDlpWrap.emitYoutubeDlEvents(stringData, readStream);
            stderrData += stringData;
        });
        ytDlpProcess.on('error', (error) => (processError = error));
        ytDlpProcess.on('close', (code) => {
            if (code === 0 || ytDlpProcess.killed) {
                readStream.emit('close');
                readStream.destroy();
                readStream.emit('end');
            }
            else {
                const error = YTDlpWrap.createError(code, processError, stderrData);
                readStream.emit('error', error);
                readStream.destroy(error);
            }
        });
        return readStream;
    }
    getExtractors() {
        return __awaiter(this, void 0, void 0, function* () {
            let ytDlpStdout = yield this.execPromise(['--list-extractors']);
            return ytDlpStdout.split('\n');
        });
    }
    getExtractorDescriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            let ytDlpStdout = yield this.execPromise(['--extractor-descriptions']);
            return ytDlpStdout.split('\n');
        });
    }
    getHelp() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.execPromise(['--help']);
        });
    }
    getUserAgent() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.execPromise(['--dump-user-agent']);
        });
    }
    getVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.execPromise(['--version']);
        });
    }
    getVideoInfo(ytDlpArguments) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof ytDlpArguments == 'string')
                ytDlpArguments = [ytDlpArguments];
            if (!ytDlpArguments.includes('-f') &&
                !ytDlpArguments.includes('--format'))
                ytDlpArguments = ytDlpArguments.concat(['-f', 'best']);
            let ytDlpStdout = yield this.execPromise(ytDlpArguments.concat(['--dump-json']));
            try {
                return JSON.parse(ytDlpStdout);
            }
            catch (e) {
                return JSON.parse('[' + ytDlpStdout.replace(/\n/g, ',').slice(0, -1) + ']');
            }
        });
    }
    bindAbortSignal(signal, process) {
        signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', () => {
            try {
                if (os.platform() === 'win32')
                    this.execSync(`taskkill /pid ${process.pid} /T /F`);
                else {
                    this.execSync(`pgrep -P ${process.pid} | xargs -L 1 kill`);
                }
            }
            catch (e) {
                // at least we tried
            }
            finally {
                process.kill(); // call to make sure that object state is updated even if task might be already killed by OS
            }
        });
    }
    setDefaultOptions(options) {
        if (!options.maxBuffer)
            options.maxBuffer = 1024 * 1024 * 1024;
        if (!options.shell)
            options.shell = this.shell;
        return options;
    }
    static createError(code, processError, stderrData) {
        let errorMessage = '\nError code: ' + code;
        if (processError)
            errorMessage += '\n\nProcess error:\n' + processError;
        if (stderrData)
            errorMessage += '\n\nStderr:\n' + stderrData;
        return new Error(errorMessage);
    }
    static emitYoutubeDlEvents(stringData, emitter) {
        let outputLines = stringData.split(/[\r\n]/g).filter(Boolean);
        for (let outputLine of outputLines) {
            if (outputLine[0] == '[') {
                let progressMatch = outputLine.match(progressRegex);
                if (progressMatch) {
                    let progressObject = {};
                    progressObject.percent = parseFloat(progressMatch[1].replace('%', ''));
                    progressObject.totalSize = progressMatch[2].replace('~', '');
                    progressObject.currentSpeed = progressMatch[4];
                    progressObject.eta = progressMatch[6];
                    emitter.emit('progress', progressObject);
                }
                let eventType = outputLine
                    .split(' ')[0]
                    .replace('[', '')
                    .replace(']', '');
                let eventData = outputLine.substring(outputLine.indexOf(' '), outputLine.length);
                emitter.emit('ytDlpEvent', eventType, eventData);
            }
        }
    }
}
//# sourceMappingURL=index.js.map