import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from "@babel/types";
function extractstoreBindingsCode(code: string) {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
    });
    let storeBindings = ''
    traverse(ast, {
        ObjectExpression(path) {
            if (path.parent.type === "CallExpression") {
                const name = path.parent.callee.name
                if (name === "Component" || name === "ComponentWithStore" || name === "Page") {
                    path.node.properties.forEach((prop: t.Node) => {
                        if (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') {
                            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                                if (prop.key.name === 'storeBindings') {
                                    debugger
                                    // 处理 storeBindings
                                    if (prop.value.type === 'ObjectExpression') {
                                        storeBindings = `{${prop.value.properties.map(proper => generate(proper).code).join('\n')}}`
                                    }
                                    else if (prop.value.type === 'ArrayExpression') {
                                        storeBindings = `[${prop.value.elements.map(node => generate(node).code).join(',\n')}]`
                                    }

                                }
                            }
                        }
                    })
                }
            }
        }
    })
    return storeBindings
}
export function generatePiniaCode(code: string) {
    debugger
    const storeBindingsCode = extractstoreBindingsCode(code)
    const wrapperCode = `
    storeBindings:${storeBindingsCode};
  `;
    // 解析 storeBindings 的代码
    const ast = parse(wrapperCode, {
        sourceType: 'module',
        plugins: ['typescript'], // 支持 TypeScript 语法
    });

    let resultCode = '';
    // 整个文件里的，包含一个或者多个store
    let all_store_fields = []

    // 使用 traverse 遍历 AST
    traverse(ast, {
        enter(path) {
            // 检查是否是 storeBindings 的对象或数组
            if (path.isArrayExpression() || path.isObjectExpression()) {
                // 如果是数组，处理每个元素
                if (path.isArrayExpression()) {
                    path.node.elements.forEach((item) => {
                        if (item.type === 'ObjectExpression') {
                            processStoreBinding(item);
                        }
                    });
                }
                path.skip();
                // 如果是对象，直接处理该对象
                if (path.isObjectExpression()) {
                    processStoreBinding(path.node);
                }
            }
        },
    });

    return { resultCode, store_fields: all_store_fields };

    // 处理每个 storeBinding 的转换
    function processStoreBinding(item) {
        let storeName = '';
        let fields = [];
        let actions = [];

        item.properties.forEach((property) => {
            if (property.key.name === 'store') {
                storeName = property.value.object.name; // store 名称
            } else if (property.key.name === 'fields') {
                fields = property.value.elements.map((elem) => elem.value); // 获取字段
            } else if (property.key.name === 'actions') {
                actions = property.value.elements.map((elem) => elem.value); // 获取 actions
            }
        });
        all_store_fields.push(...fields)
        // 构建 Pinia 的 store 使用代码
        resultCode += `const ${storeName} = use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}();\n`;
        fields.length > 0 ? resultCode += `const { ${fields.join(', ')}} = ${storeName}; \n` : '';
        actions.length > 0 ? resultCode += `const { ${actions.join(', ')}} = ${storeName}; \n` : '';
    }
}

