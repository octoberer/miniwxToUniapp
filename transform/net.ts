import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
export function transformNet(code) {
    // 解析代码为 AST
    const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'], // 启用 TypeScript 插件
    });

    // 遍历 AST，进行转换
    traverse(ast, {
        CallExpression(path) {
            // 检查是否是 query 的调用
            if (path.node.callee.name === 'query') {
                const [apiCall, callback, catchCallback] = path.node.arguments;
                let newCall = {};

                // 确保 apiCall 存在并且有正确的结构
                if (apiCall && apiCall.type === 'CallExpression' && apiCall.callee) {
                    // 创建新的 sendRequest 语句
                    if (apiCall.arguments[0]) {
                        newCall = {
                            type: 'CallExpression',
                            callee: {
                                type: 'Identifier',
                                name: 'sendRequest',
                            },
                            arguments: [
                                {
                                    type: 'ObjectExpression',
                                    properties: [
                                        {
                                            type: 'ObjectProperty',
                                            key: {
                                                type: 'Identifier',
                                                name: 'url',
                                            },
                                            value: {
                                                type: 'StringLiteral',
                                                value: apiCall.callee.name, // 使用 apiRequest 或实际请求的名称
                                            },
                                        },
                                        {
                                            type: 'ObjectProperty',
                                            key: {
                                                type: 'Identifier',
                                                name: 'data',
                                            },
                                            value: apiCall.arguments[0], // 参数传递
                                        },
                                    ],
                                },
                            ],
                        }
                    } else {
                        newCall = {
                            type: 'CallExpression',
                            callee: {
                                type: 'Identifier',
                                name: 'sendRequest',
                            },
                            arguments: [
                                {
                                    type: 'ObjectExpression',
                                    properties: [
                                        {
                                            type: 'ObjectProperty',
                                            key: {
                                                type: 'Identifier',
                                                name: 'url',
                                            },
                                            value: {
                                                type: 'StringLiteral',
                                                value: apiCall.callee.name, // 使用 apiRequest 或实际请求的名称
                                            },
                                        }
                                    ],
                                },
                            ],
                        }
                    }
                } else if (apiCall && apiCall.type === 'Identifier') {
                    // 处理 apiCall 是 Identifier 的情况
                    newCall = {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'sendRequest',
                        },
                        arguments: [
                            {
                                type: 'ObjectExpression',
                                properties: [
                                    {
                                        type: 'ObjectProperty',
                                        key: {
                                            type: 'Identifier',
                                            name: 'url',
                                        },
                                        value: {
                                            type: 'StringLiteral',
                                            value: apiCall.name, // 这里使用 apiCall.name，得到标识符名称
                                        },
                                    }
                                ],
                            },
                        ],
                    }
                } else {
                    // 如果 apiCall 不符合预期结构，打印调试信息（此处可以省略）
                    console.error('Invalid apiCall structure:', apiCall);
                }

                // 创建 then 方法，并传入回调
                const thenMethod = {
                    type: 'CallExpression',
                    callee: {
                        type: 'MemberExpression',
                        object: newCall,
                        property: {
                            type: 'Identifier',
                            name: 'then',
                        },
                    },
                    arguments: [
                        callback,
                    ],
                };

                // 如果存在 catchCallback，添加 catch 方法
                if (catchCallback) {
                    const catchMethod = {
                        type: 'CallExpression',
                        callee: {
                            type: 'MemberExpression',
                            object: newCall,
                            property: {
                                type: 'Identifier',
                                name: 'catch',
                            },
                        },
                        arguments: [
                            catchCallback,
                        ],
                    };

                    // 将 catch 方法链接到 then 方法后
                    thenMethod.arguments.push(catchMethod);
                }

                // 替换原来的 query 调用
                path.replaceWith(thenMethod);
            }
        }
    });

    // 生成新的代码
    const newCode = generate(ast, { /* options */ }).code;
    return newCode;
}
