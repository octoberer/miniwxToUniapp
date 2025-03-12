"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var covertor_js_1 = require("./dist/covertor.js");
var wxml2template_1 = require("./wxml2template");
var util_1 = require("util");
var readdir = (0, util_1.promisify)(fs.readdir);
var stat = (0, util_1.promisify)(fs.stat);
var readFile = (0, util_1.promisify)(fs.readFile);
var writeFile = (0, util_1.promisify)(fs.writeFile);
var mkdir = (0, util_1.promisify)(fs.mkdir);
var convertSnakeToCamel = function (snakeStr) {
    return snakeStr
        .split('-')
        .map(function (word, index) {
        // 将第一个字母大写，其余小写
        if (index === 0) {
            return word.charAt(0).toLowerCase() + word.slice(1);
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    })
        .join('');
};
var convertToVueComponentName = function (snakeStr) {
    var camelCaseStr = convertSnakeToCamel(snakeStr);
    // 确保首字母大写，以符合 Vue 组件名的惯例
    return camelCaseStr.charAt(0).toUpperCase() + camelCaseStr.slice(1);
};
function convertMiniProgram(srcDir, destDir, converters) {
    return __awaiter(this, void 0, void 0, function () {
        function processDirectory(currentDir) {
            return __awaiter(this, void 0, void 0, function () {
                var entries, _i, entries_1, entry, fullPath, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            return [4 /*yield*/, readdir(currentDir, { withFileTypes: true })];
                        case 1:
                            entries = _a.sent();
                            // 先处理当前目录
                            return [4 /*yield*/, processFolder(currentDir)];
                        case 2:
                            // 先处理当前目录
                            _a.sent();
                            _i = 0, entries_1 = entries;
                            _a.label = 3;
                        case 3:
                            if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                            entry = entries_1[_i];
                            fullPath = path.join(currentDir, entry.name);
                            if (!entry.isDirectory()) return [3 /*break*/, 5];
                            return [4 /*yield*/, processDirectory(fullPath)];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_1 = _a.sent();
                            throw new Error("\u5904\u7406\u76EE\u5F55 ".concat(currentDir, " \u5931\u8D25: ").concat(error_1.message));
                        case 8: return [2 /*return*/];
                    }
                });
            });
        }
        function processFolder(folderPath) {
            return __awaiter(this, void 0, void 0, function () {
                var relativePath_1, allowedRoots, shouldConvert, files, tsCount, wxmlCount, wxssCount, tsContent, wxmlContent, wxssContent, otherString, _i, files_1, file, filePath, ext, _a, output, _b, _c, _d, _e, error_2, vueContent, outputPath, parentDir, error_3;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _f.trys.push([0, 18, , 19]);
                            relativePath_1 = path.relative(srcDir, folderPath);
                            allowedRoots = [
                                'components',
                                'pages',
                                'me',
                                'operate-device' // 新增分包目录
                            ];
                            shouldConvert = allowedRoots.some(function (root) {
                                // 匹配根目录自身或子目录
                                var rootPattern = new RegExp("^".concat(root, "(\\").concat(path.sep, "|$)"));
                                return rootPattern.test(relativePath_1);
                            });
                            if (!shouldConvert) {
                                console.log("\u8DF3\u8FC7\u975E\u8F6C\u6362\u76EE\u5F55: ".concat(relativePath_1));
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, readdir(folderPath)];
                        case 1:
                            files = _f.sent();
                            tsCount = 0, wxmlCount = 0, wxssCount = 0;
                            tsContent = '', wxmlContent = '', wxssContent = '', otherString = '';
                            _i = 0, files_1 = files;
                            _f.label = 2;
                        case 2:
                            if (!(_i < files_1.length)) return [3 /*break*/, 13];
                            file = files_1[_i];
                            filePath = path.join(folderPath, file);
                            ext = path.extname(file);
                            _f.label = 3;
                        case 3:
                            _f.trys.push([3, 11, , 12]);
                            _a = ext;
                            switch (_a) {
                                case '.ts': return [3 /*break*/, 4];
                                case '.wxml': return [3 /*break*/, 6];
                                case '.wxss': return [3 /*break*/, 8];
                            }
                            return [3 /*break*/, 10];
                        case 4:
                            tsCount++;
                            if (tsCount > 1)
                                return [2 /*return*/];
                            _c = (_b = converters).convertTS;
                            return [4 /*yield*/, readFile(filePath, 'utf8')];
                        case 5:
                            output = _c.apply(_b, [_f.sent()]);
                            tsContent = output.outputVueCode;
                            otherString = output.otherString;
                            return [3 /*break*/, 10];
                        case 6:
                            wxmlCount++;
                            if (wxmlCount > 1)
                                return [2 /*return*/];
                            _e = (_d = converters).convertWXML;
                            return [4 /*yield*/, readFile(filePath, 'utf8')];
                        case 7:
                            wxmlContent = _e.apply(_d, [_f.sent()]);
                            return [3 /*break*/, 10];
                        case 8:
                            wxssCount++;
                            if (wxssCount > 1)
                                return [2 /*return*/];
                            return [4 /*yield*/, readFile(filePath, 'utf8')];
                        case 9:
                            wxssContent = _f.sent();
                            return [3 /*break*/, 10];
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            error_2 = _f.sent();
                            throw new Error("\u5904\u7406\u6587\u4EF6 ".concat(file, " \u5931\u8D25: ").concat(error_2.message));
                        case 12:
                            _i++;
                            return [3 /*break*/, 2];
                        case 13:
                            // 验证必要文件
                            if (!tsCount)
                                return [2 /*return*/];
                            if (!wxmlCount)
                                return [2 /*return*/];
                            // 生成Vue文件内容
                            tsContent = tsContent.trim() ? "<script lang=\"ts\" setup>\n".concat(tsContent, "\n</script>\n") : '';
                            wxmlContent = wxmlContent.trim() ? "<template>\n".concat(wxmlContent, "\n</template>\n") : '';
                            wxssContent = wxssContent.trim() ? "<style>\n".concat(wxssContent, "\n</style>") : '';
                            vueContent = "".concat(tsContent).concat(wxmlContent).concat(wxssContent);
                            outputPath = path.join(destDir, relativePath_1);
                            parentDir = path.dirname(outputPath);
                            return [4 /*yield*/, mkdir(parentDir, { recursive: true })];
                        case 14:
                            _f.sent();
                            // console.log(path.join(parentDir, `${convertToVueComponentName(path.basename(folderPath))}.vue`));
                            return [4 /*yield*/, writeFile(path.join(parentDir, "".concat(path.basename(folderPath), ".vue")), vueContent, 'utf8')];
                        case 15:
                            // console.log(path.join(parentDir, `${convertToVueComponentName(path.basename(folderPath))}.vue`));
                            _f.sent();
                            if (!(otherString && otherString.length > 0)) return [3 /*break*/, 17];
                            return [4 /*yield*/, writeFile(path.join(destDir, 'content_util', "".concat(path.basename(folderPath), ".ts")), otherString, 'utf8')];
                        case 16:
                            _f.sent();
                            _f.label = 17;
                        case 17: return [3 /*break*/, 19];
                        case 18:
                            error_3 = _f.sent();
                            throw new Error("\u5904\u7406\u76EE\u5F55 ".concat(folderPath, " \u5931\u8D25: ").concat(error_3.message));
                        case 19: return [2 /*return*/];
                    }
                });
            });
        }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mkdir(path.join(destDir, 'content_util'), { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, processDirectory(srcDir)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// 使用示例
convertMiniProgram('C:/Users/19486/Desktop/小程序项目2025/shicaoshou/miniprogram', 'C:/Users/19486/Desktop/小程序项目2025/shicaoshou_covert/miniprogram', {
    convertTS: covertor_js_1.transformWxTsToVue3Setup,
    convertWXML: wxml2template_1.convertWXMLToVueTemplate,
})
    .then(function () { return console.log('转换完成'); })
    .catch(function (error) {
    console.error('转换失败:');
    console.error("[".concat(error.stack.split('\n')[0], "]"));
    process.exit(1);
});
