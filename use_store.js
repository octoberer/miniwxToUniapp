import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

// const traverse = traverseModule.default;
// const generate = generateModule.default;

let scope = null
export function convertMobXToPinia(code) {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
    });

    let storeName = null;
    const stateProperties = [];
    const actions = [];
    const otherFunctions = [];

    traverse(ast, {
        VariableDeclarator(path) {
            if (
                t.isCallExpression(path.node.init) &&
                t.isIdentifier(path.node.init.callee, { name: "observable" }) &&
                t.isObjectExpression(path.node.init.arguments[0])
            ) {
                scope = path.scope
                storeName = path.node.id.name;
                path.node.init.arguments[0].properties.forEach(prop => {
                    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                        const propName = prop.key.name;
                        const propValue = prop.value;

                        // 判断是基本类型还是对象/数组
                        const isBasicType = t.isLiteral(propValue) || t.isUnaryExpression(propValue);
                        const isComplexType = t.isObjectExpression(propValue) || t.isArrayExpression(propValue);

                        if (isBasicType) {
                            stateProperties.push({
                                name: propName,
                                type: "ref",
                                value: generate(propValue).code,
                            });
                        } else if (isComplexType) {
                            stateProperties.push({
                                name: propName,
                                type: "reactive",
                                value: generate(propValue).code,
                            });
                        } else {
                            stateProperties.push({
                                name: propName,
                                type: "ref",
                                value: generate(propValue).code,
                            });
                        }

                    }
                });
            }
        },

        FunctionDeclaration(path) {
            const actionCall = path.node.body.body.find(
                node => node.type === 'ExpressionStatement' &&
                    node.expression.type === 'CallExpression' &&
                    node.expression.callee?.callee?.name === 'action'
            );
            scope = path.scope
            debugger
            // 如果找到 'action' 调用，直接取出其内部的代码
            if (actionCall) {
                // 'action' 内部的逻辑
                // const innerStatement = actionCall.expression.callee.arguments[0].body.body;
                const actionFunction = actionCall.expression.callee.arguments[0]
                // 替换函数体中的 store 访问
                const modifiedBody = replaceStoreAccess(actionFunction.body, storeName, stateProperties);
                // 将 'action' 包裹的逻辑提取出来
                // path.node.body.body = innerStatement;
                debugger
                actions.push({
                    name: path.node.id.name,
                    body: generate(modifiedBody).code,
                    params: path.node.params.map(param => generate(param).code).join(", "),
                });
            }
            else {
                // 替换普通函数中的 store 访问
                const modifiedBody = replaceStoreAccess(path.node.body, storeName, stateProperties);
                // 保存普通函数
                otherFunctions.push({
                    name: path.node.id.name,
                    params: path.node.params.map(param => generate(param).code).join(", "),
                    body: generate(modifiedBody).code,
                });
            }
        },
    });

    // 生成 Pinia 代码
    const stateDeclarations = stateProperties
        .map(prop => {
            if (prop.type === "ref") {
                return `const ${prop.name} = ref(${prop.value});`;
            } else {
                return `const ${prop.name} = reactive(${prop.value});`;
            }
        })
        .join("\n  ");

    const actionDeclarations = actions
        .map(action => {
            return `function ${action.name}(${action.params}) {\n    ${action.body}\n  }`;
        })
        .join("\n\n  ");

    const returnObject = stateProperties
        .map(prop => {
            return `${prop.name}: ${prop.name}`
        })
        .concat(actions.map(action => `${action.name}: ${action.name}`))
        .join(",\n    ");

    const piniaCode = `
        export const use${storeName.charAt(0).toUpperCase() + storeName.slice(1)} = defineStore('${storeName}', () => {
        ${stateDeclarations}

        ${actionDeclarations}

        return {
            ${returnObject}
        };})`
    // 生成独立导出的普通函数
    const otherFunctionExports = otherFunctions
        .map(func => `export function ${func.name}(${func.params}) {\n  ${func.body}\n}`)
        .join("\n\n");

    // 最终输出代码
    return `${piniaCode}\n\n${otherFunctionExports}`;
}
// 替换函数体中的 store 访问
function replaceStoreAccess(body, storeName, stateProperties) {
    traverse(body, {
        MemberExpression(path) {
            if (
                t.isIdentifier(path.node.object, { name: storeName }) &&
                t.isIdentifier(path.node.property)
            ) {
                const propName = path.node.property.name;
                const correspondingState = stateProperties.find(state => state.name === propName);
                if (correspondingState) {
                    if (correspondingState.type === "ref") {
                        path.replaceWith(t.memberExpression(t.identifier(propName), t.identifier("value")));
                    } else {
                        path.replaceWith(t.identifier(propName));
                    }
                }
            }
        },
    }, scope);
    return body;
}
// 测试代码
const mobxCode = `
import { observable, action } from "mobx-miniprogram";
const store = observable({
  allAssistant: [] as any[],
  needUpdateAssistantFlag: true
});
function updateAssistant(newAssistants: any) {
  action(() => {
    store.allAssistant = newAssistants || [];
    store.needUpdateAssistantFlag = false;
  })();
}
export default { store, updateAssistant };
`;

// console.log(convertMobXToPinia(mobxCode));

