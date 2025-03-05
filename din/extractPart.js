import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { wxlifecycle } from './lifetime';

export function extractParts(code) {
    const preprocessedCode = code;
    const ast = parse(preprocessedCode, {
        sourceType: 'module',
        plugins: ['typescript'], // 支持 JSX 和 TypeScript
        strictMode: false // 禁用严格模式
    });

    const extractedParts = {
        data: null,
        properties: null,
        observers: null,
        methods: null,
        lifetimes: null,
        pageLifetimes: null,
        computed: null,
        storeBindings: null
    };

    traverse(ast, {
        ObjectExpression(path) {
            const obj = path.node.properties;
            const parent = path.parent;
            if (parent.type === 'CallExpression' && parent.callee.name === 'Page') {
                obj.forEach(prop => {
                    if (prop.key.name === 'data') {
                        extractedParts.data = generate(prop.value).code;
                    }
                    else if (prop.key.name === 'storeBindings') {
                        extractedParts.storeBindings = generate(prop.value).code;
                    }
                    else if (prop.key.name === 'computed') {

                        extractedParts.computed = extractMethods(prop.value);
                    }
                    else if (prop.key.name === 'watch') {
                        extractedParts.observers = extractMethods(prop.value);
                    }
                    else if (wxlifecycle.includes(prop.key.name)) {
                        // 处理 ObjectMethod（ES6 简写方法）的情况
                        if (prop.type === 'ObjectMethod') {
                            if (!extractedParts.lifetimes) {
                                extractedParts.lifetimes = []
                            }
                            extractedParts.lifetimes.push(generate(prop).code);
                        } else {
                            if (!extractedParts.lifetimes) {
                                extractedParts.lifetimes = []
                            }
                            // 处理普通函数表达式的情况
                            extractedParts.lifetimes.push(generate(prop.value).code);
                        }
                    } else if (
                        // 处理普通函数或箭头函数
                        (prop.type === 'ObjectProperty' &&
                            (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')) ||
                        // 处理 ES6 简写方法
                        prop.type === 'ObjectMethod'
                    ) {
                        if (!extractedParts.methods) {
                            extractedParts.methods = {}
                        }
                        extractedParts.methods[prop.key.name] = generate(prop).code;
                    }
                });
            } else if (parent.type === 'CallExpression' && (parent.callee.name === 'Component' || parent.callee.name === 'ComponentWithStore')) {
                obj.forEach(prop => {
                    if (prop.key.name === 'data') {
                        extractedParts.data = generate(prop.value).code;
                    } else if (prop.key.name === 'properties') {
                        extractedParts.properties = generate(prop.value).code;
                    } else if (prop.key.name === 'observers') {
                        // debugger
                        extractedParts.observers = extractMethods(prop.value);
                    } else if (prop.key.name === 'methods') {
                        extractedParts.methods = extractMethods(prop.value);
                    } else if (prop.key.name === 'lifetimes' || prop.key.name === 'pageLifetimes') {
                        if (!extractedParts.lifetimes) {
                            extractedParts.lifetimes = []
                        }
                        extractedParts.lifetimes.push(...extractLifetimes(prop.value));
                    }
                });
            }
        }
    });
    console.log('extractedParts', extractedParts);
    return extractedParts;
}

function extractMethods(node) {
    const methods = [];
    node.properties.forEach(prop => {
        if (prop.type === 'ObjectMethod') {
            methods.push(generate(prop).code)
        } else {
            // 处理普通函数表达式的情况
            methods.push(generate(prop.value).code)
        }
    });
    return `{${methods.join(',')}}`;
}
function extractLifetimes(node) {
    const lifetimes = [];
    node.properties.forEach(prop => {
        if (prop.type === 'ObjectMethod') {
            lifetimes.push(generate(prop).code)
        } else {
            // 处理普通函数表达式的情况
            lifetimes.push(generate(prop.value).code)
        }
    });
    return lifetimes
}
