import traverse from "@babel/traverse";
import { collectLocalVariables, localVariablesType } from "./collectLocalVariables";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { genParamsWithType } from "./genParamsWithType";
import { getType, statePropertiesType } from "../reactive";
export interface functionStrType {
    name: string,
    params: string,
    body: string,
}
interface replace_pending_type {
    modifiedBody: t.BlockStatement,
    name: string,
    params: string,
    arr: functionStrType[],
    localVariables: Map<string, localVariablesType>
}
export const replace_pending_arr = [] as replace_pending_type[]
const all_methods_name = [] as string[]
export function resolvefunc(propValue: t.Node, stateProperties: statePropertiesType[], scope, arr: functionStrType[], keyName?: string) {
    if (t.isObjectExpression(propValue)) {
        propValue.properties.forEach(prop => {
            if (t.isObjectMethod(prop)) {
                const localVariables = collectLocalVariables(prop, scope)
                if (t.isObjectMethod(prop)) {
                    // 阶段2: AST转换
                    // debugger
                    if (t.isIdentifier(prop.key)) {
                        const name = prop.key.name;
                        if (keyName == 'methods') {
                            all_methods_name.push(name)
                        }
                        const body = prop.body;
                        const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope)
                        replace_pending_arr.push({ modifiedBody, name, params: genParamsWithType(prop), arr, localVariables })
                    }
                    // else if (t.isStringLiteral(prop.key)) {
                    //     // 支持多个观察者（watcher）的情况，例如：watch: { "workingDeviceList,currentShowIds": function() {...} }
                    //     // 假设多个观察者名称用逗号分隔
                    //     const body = prop.body;
                    //     const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope)
                    //     // 这里将多个观察者的逻辑提取到 watchers 数组中
                    //     replace_pending_arr.push({ modifiedBody, name: prop.key.value, params: "", arr, localVariables })
                    // }
                }

            }
            else if (t.isObjectProperty(prop)) {
                // debugger
                if (t.isStringLiteral(prop.key) && t.isFunctionExpression(prop.value)) {
                    // 如果对象属性是字符串字面量，则根据实际需求进行处理
                    const key = prop.key.value;
                    if (keyName == 'methods') {
                        all_methods_name.push(key)
                    }
                    // 假设这里也可以处理类似 `observers: { "field1,field2": function() {...} }` 结构
                    const body = prop.value.body;  // 获取对象属性值中的函数体
                    const localVariables = collectLocalVariables(prop.value, scope);
                    const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope);
                    replace_pending_arr.push({ modifiedBody, name: key, params: "", arr, localVariables });
                }
            }
        });
    }
    // 兼容判断page里的生命周期和普通方法
    else if (t.isObjectMethod(propValue)) {
        if (t.isIdentifier(propValue.key)) {
            const localVariables = collectLocalVariables(propValue, scope)
            const name = propValue.key.name;
            if (keyName == 'methods') {
                all_methods_name.push(name)
            }
            const body = propValue.body;
            const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope)
            replace_pending_arr.push({ modifiedBody, name, params: genParamsWithType(propValue), arr, localVariables })
        }
    }
}

function transformFunction1(body, { stateProperties, localVariables }, scope) {
    return replaceSetData(body, stateProperties, localVariables, scope);
}
export function transformFunction2({ modifiedBody, name, params, arr, localVariables }: replace_pending_type, stateProperties: statePropertiesType[], scope) {
    // const varConfig = stateProperties.reduce((acc, curr) => {
    //     acc[curr.name] = {
    //         isProperty: curr.is_property,
    //         type: curr.type
    //     };
    //     return acc;
    // }, {});
    // const localVariables_set = new Set(localVariables.keys())
    // 1. 替换 this.setData 和 this.data.xxx
    const modifiedBody_2 = replaceThisAccess(modifiedBody, stateProperties, scope);
    // 2. 替换其他因为没有this.data，而没有转化的变量
    // const modifiedBody_3 = replaceVariableAccess(modifiedBody_2, {
    //     localVariables: localVariables_set,
    //     varConfig
    // }, scope);
    arr.push({
        name: name,
        params,
        body: generate(modifiedBody_2).code
    })
}
function replaceThisAccess(body: t.BlockStatement, stateProperties: any[], scope: any) {
    // 转换data,properties,store_field
    traverse(body, {
        // 处理 this.data.xxx 的访问
        MemberExpression(path) {
            const { object, property } = path.node;
            if (
                t.isThisExpression(path.node.object) &&
                t.isIdentifier(path.node.property, { name: "data" }) &&
                t.isMemberExpression(path.parentPath.node)
            ) {
                // debugger
                // 获取 this.data.xxx 中的 xxx 属性名（例如 list）
                const targetProp = path.parentPath.node.property.name;
                const correspondingState = stateProperties.find(state => state.name === targetProp);

                if (correspondingState && !correspondingState.is_property) {
                    if (correspondingState.type === "ref") {
                        // 替换为 ref 的访问方式：xxx.value
                        path.parentPath.replaceWith(
                            t.memberExpression(
                                t.identifier(targetProp), // 创建 xxx 标识符
                                t.identifier("value")     // 添加 .value 属性
                            )
                        );

                    } else {
                        // 替换整个 this.data.xxx 为 xxx.value
                        path.parentPath.replaceWith(
                            t.identifier(targetProp)
                        );
                    }
                }
                else if (correspondingState && correspondingState.is_property) {
                    path.parentPath.replaceWith(
                        t.memberExpression(
                            t.identifier("props"),
                            t.identifier(targetProp), // 创建 xxx 标识符
                        )
                    );
                }
            }
            // 处理 XXX.store.YYY
            else if (t.isMemberExpression(object) && t.isIdentifier(object.property, { name: "store" })) {
                if (t.isIdentifier(object.object)) {
                    path.replaceWith(t.identifier(property.name));
                }
            }

            // 处理 XXXStore.YYY
            else if (t.isIdentifier(object) && object.name.endsWith("Store")) {
                path.replaceWith(t.identifier(property.name));
            }
            // this.[methods]
            else if (
                t.isThisExpression(path.node.object) &&
                path.node.property &&
                t.isIdentifier(path.node.property) &&
                all_methods_name.includes(path.node.property.name)
            ) {
                // debugger
                path.replaceWith(t.identifier(property.name));
            }
        },
        VariableDeclarator(path) {
            // debugger
            const isDataName = stateProperties.find(state => state.name === path.node.id.name)
            if (t.isIdentifier(path.node.id) &&
                isDataName &&
                path.scope.hasBinding(path.node.id.name)) {
                // 生成唯一变量名（带作用域感知）
                const newName = path.scope.generateUidIdentifier('_' + path.node.id.name);

                // 重命名所有引用
                path.scope.rename(path.node.id.name, newName.name);
            }
        },
        // 处理函数内部的函数参数的替换（支持解构）
        Function(path) {
            debugger
            const processIdentifier = (paramPath) => {
                if (paramPath.isIdentifier()) {
                    const paramName = paramPath.node.name;
                    const isConflict = stateProperties.some(
                        (state) => state.name === paramName
                    );

                    // 检查冲突且当前作用域存在该绑定
                    if (isConflict && paramPath.scope.hasBinding(paramName)) {
                        const newName = paramPath.scope.generateUidIdentifier("_" + paramName);
                        paramPath.scope.rename(paramName, newName.name);
                    }
                }
            };

            const renameParam = (paramPath) => {
                if (paramPath.isIdentifier()) {
                    processIdentifier(paramPath);
                } else if (paramPath.isObjectPattern()) {
                    // 处理对象解构参数（如 { a }）
                    paramPath.get("properties").forEach((propPath) => {
                        if (propPath.isObjectProperty()) {
                            // 处理解构的 value（如 { a: b } 中的 b）
                            renameParam(propPath.get("value"));
                        } else if (propPath.isRestElement()) {
                            // 处理剩余参数（如 ...rest）
                            renameParam(propPath.get("argument"));
                        }
                    });
                } else if (paramPath.isArrayPattern()) {
                    // 处理数组解构参数（如 [a, b]）
                    paramPath.get("elements").forEach((elementPath) => {
                        if (elementPath.isIdentifier() || elementPath.isPattern()) {
                            renameParam(elementPath);
                        }
                    });
                } else if (paramPath.isAssignmentPattern()) {
                    // 处理默认值参数（如 a = 1）
                    renameParam(paramPath.get("left"));
                }
            };

            // 遍历所有参数并处理
            path.get("params").forEach((paramPath) => {
                renameParam(paramPath);
            });
        }
    }, scope);

    return body;
}
// 核心AST转换函数
function replaceVariableAccess(body: t.Node, { localVariables, varConfig }, scope: any) {
    traverse(body, {
        Identifier(path) {
            const { node } = path;
            // 排除对象解构键名（{ a: b } 这种情况，a 不是变量）
            if (path.parentPath.isObjectProperty({ key: node })) return;

            if (localVariables.has(node.name)) return;
            if (!varConfig[node.name]) return;
            // 检查是否已经被替换为 xxx.value
            if (
                path.parentPath.isMemberExpression() &&
                path.parent.property.name === 'value' &&
                path.parent.object === node
            ) {
                // 如果已经是 xxx.value，跳过
                return;
            }

            // 处理 props 变量
            if (varConfig[node.name].isProperty) {
                // 场景1：直接使用的变量（如 item → props.item）
                if (!path.parentPath.isMemberExpression()) {
                    path.replaceWith(
                        t.memberExpression(t.identifier('props'), node)
                    );
                    return;
                }

                // 场景2：作为成员表达式基对象（如 item.id → props.item.id）
                if (path.parentPath.isMemberExpression() &&
                    path.parent.object === node) {
                    path.replaceWith(
                        t.memberExpression(t.identifier('props'), node)
                    );
                }
            }
            if ((!varConfig[node.name]) || varConfig[node.name].type !== 'ref') return;
            // 处理赋值左侧（如 b = 5 → b.value = 5）
            if (path.parentPath.isAssignmentExpression({ left: node })) {
                path.replaceWith(t.memberExpression(node, t.identifier('value')));
                return;
            }

            // 处理普通引用（如 b+2 → b.value+2）
            else if (!path.parentPath.isMemberExpression()) {
                path.replaceWith(t.memberExpression(node, t.identifier('value')));
            }
        }
    }, scope);

    return body;
}
// 替换 this.setData 和 this.data.xxx
function replaceSetData(body: t.BlockStatement, stateProperties: any[], localVariables: Map<string, localVariablesType>, scope: any) {
    traverse(body, {
        // 处理 this.setData 的调用
        CallExpression(path) {
            // 处理 this.setData 调用
            // debugger
            if (t.isMemberExpression(path.node.callee) &&
                t.isThisExpression(path.node.callee.object) &&
                t.isIdentifier(path.node.callee.property, { name: "setData" })) {

                handleSetDataCall(path, stateProperties, localVariables);
            }
        },
        BinaryExpression(path) {
            // 检查是否是 `==` 操作符
            if (path.node.operator === '==') {
                // 替换成 `===`
                path.node.operator = '===';
            }
        }
    }, scope);

    return body;
}

function handleSetDataCall(path, stateProperties: statePropertiesType[], localVariables: Map<string, localVariablesType>) {
    const updates = path.node.arguments[0];
    if (!t.isObjectExpression(updates)) return;
    const statements = [] as t.Statement[];
    // debugger
    covertSetData(updates, statements, { stateProperties, localVariables })
    path.replaceWithMultiple(statements as never[]);
}
function covertSetData(updates: t.ObjectExpression, statements: t.Statement[], { stateProperties, localVariables }: { stateProperties: statePropertiesType[], localVariables: Map<string, localVariablesType> }) {
    updates.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            const propName = prop.key.name
            if (t.isIdentifier(prop.value)) {
                // 如果是变量，就找这个变量是否在data定义或者在localVariables
                let target = stateProperties.find(p => p.name === propName);
                if (!target) {
                    // 如果没有找到，则把这个没定义在data里的添加到 stateProperties 中
                    const localVariable = localVariables.get(prop.value.name);
                    if (localVariable) {
                        target = {
                            name: propName,
                            type: localVariable?.type == 'object' ? "reactive" : 'ref',
                            is_property: false,
                            var_type: localVariable?.type ? localVariable?.type : 'null'
                        }
                        stateProperties.push(target);
                    }
                    else {
                        // 理论上不会出现这种情况
                    }
                }
                if (t.isExpression(prop.value)) {
                    statements.push(
                        t.expressionStatement(
                            t.assignmentExpression(
                                "=",
                                t.memberExpression(
                                    t.memberExpression(
                                        t.thisExpression(),    // this
                                        t.identifier("data")   // .data
                                    ),
                                    t.identifier(propName)   // .propName
                                ),
                                prop.value
                            )
                        )
                    )
                }
            }
            else if (t.isObjectExpression(prop.value)) {
                let target = stateProperties.find(p => p.name === propName);
                if (!target) {
                    target = {
                        name: propName,
                        type: "reactive",
                        is_property: false,
                        var_type: ""
                    }
                    stateProperties.push(target);
                }
                prop.value.properties.forEach(subProp => {
                    if (t.isObjectProperty(subProp) && t.isExpression(subProp.value)) {
                        statements.push(
                            t.expressionStatement(
                                t.assignmentExpression(
                                    "=",
                                    t.memberExpression(
                                        t.memberExpression(
                                            t.memberExpression(
                                                t.thisExpression(),    // this
                                                t.identifier("data")   // .data
                                            ),
                                            t.identifier(propName)   // .propName
                                        ),
                                        subProp.key
                                    ),
                                    subProp.value
                                )
                            )
                        );
                    }
                });
            }
            else {
                // 可能是member,this.data.XX
                let target = stateProperties.find(p => p.name === propName);
                if (!target) {
                    target = {
                        name: propName,
                        type: t.isObjectProperty(prop.value) ? "reactive" : "ref",
                        is_property: false,
                        var_type: getType(prop.value)
                    }
                    stateProperties.push(target);
                }
                if (t.isExpression(prop.value)) {
                    statements.push(
                        t.expressionStatement(
                            t.assignmentExpression(
                                "=",
                                t.memberExpression(
                                    t.memberExpression(
                                        t.thisExpression(),    // this
                                        t.identifier("data")   // .data
                                    ),
                                    t.identifier(propName)   // .propName
                                ),
                                prop.value
                            )
                        )
                    )
                }
            }
        }
    });

}