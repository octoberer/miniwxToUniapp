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
                        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                            if (prop.key.name === 'storeBindings') {
                                // 处理 storeBindings
                                if (prop.value.type === 'ObjectExpression') {
                                    storeBindings = `{${prop.value.properties.map(proper => generate(proper).code).join(',\n')}}`
                                }
                                else if (prop.value.type === 'ArrayExpression') {
                                    storeBindings = `[${prop.value.elements.map(node => generate(node).code).join(',\n')}]`
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
    const storeBindingsCode = extractstoreBindingsCode(code)
    if (!storeBindingsCode || storeBindingsCode.length == 0) {
        return { resultCode: '', store_fields: [] }
    }
    const wrapperCode = `
    const storeBindings =${storeBindingsCode};
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
        ObjectExpression(path: any) {
            // 如果是数组，处理每个元素
            processStoreBinding(path.node);
            path.skip();
        },
        ArrayExpression(path: any) {
            path.node.elements.forEach((item: t.ObjectExpression) => {
                if (item.type === 'ObjectExpression') {
                    processStoreBinding(item);
                }
            });
            path.skip();
        }
    });

    return { resultCode, store_fields: all_store_fields };

    // 处理每个 storeBinding 的转换
    function processStoreBinding(item: t.ObjectExpression) {
        let storeName = '';
        let fields = [];
        let actions = [];

        item.properties.forEach((property: t.ObjectProperty) => {
            if (t.isIdentifier(property.key)) {
                if (property.key.name === 'store') {
                    // 补充
                    if (t.isMemberExpression(property.value) && t.isIdentifier(property.value.object)) {
                        storeName = property.value.object.name; // store 名称
                    }
                    else if (t.isIdentifier(property.value)) {
                        // 如果 store 是 Identifier，如 assistantStore
                        storeName = property.value.name;  // 获取 store 的标识符
                    }
                    else {
                        // 补充处理其他情况（如可能的其他类型）
                        throw new Error('Unsupported store value type');
                    }
                } else if (property.key.name === 'fields') {
                    if (t.isArrayExpression(property.value)) {
                        fields = property.value.elements.map((elem: t.StringLiteral) => elem.value); // 获取字段
                    }
                    else if (t.isObjectExpression(property.value)) {
                        fields = property.value.properties.map((elem: t.ObjectProperty) => { if (t.isStringLiteral(elem.value) && t.isIdentifier(elem.key)) return `${elem.key.name}: ${elem.value.value}` });
                    }
                } else if (property.key.name === 'actions') {
                    if (t.isArrayExpression(property.value)) {
                        actions = property.value.elements.map((elem: t.StringLiteral) => elem.value); // 获取字段
                    }
                    else if (t.isObjectExpression(property.value)) {
                        actions = property.value.properties.map((elem: t.ObjectProperty) => { if (t.isStringLiteral(elem.value) && t.isIdentifier(elem.key)) return `${elem.key.name}: ${elem.value.value}` });
                    }
                }
            }
        });
        all_store_fields.push(...fields)
        // 构建 Pinia 的 store 使用代码
        resultCode += `const ${storeName} = use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}();\n`;
        fields.length > 0 ? resultCode += `const { ${fields.join(', ')}} = ${storeName}; \n` : '';
        actions.length > 0 ? resultCode += `const { ${actions.join(', ')}} = ${storeName}; \n` : '';
    }
}

