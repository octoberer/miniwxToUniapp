import traverse, { NodePath } from "@babel/traverse";
import { localVariablesType } from "./collectLocalVariables";
import * as t from "@babel/types";
import { getType, statePropertiesType } from "../reactive";
import generate from "@babel/generator";
export function replaceThisAccess(body: t.Node, stateProperties: statePropertiesType[], scope: any, all_methods_name: string[]) {
    // 转换data,properties,store_field

    traverse(body, {
        // 处理 this.data.xxx 的访问
        MemberExpression(path: NodePath<t.MemberExpression>) {
            const { object, property } = path.node;
            if (
                t.isThisExpression(path.node.object) &&
                t.isIdentifier(path.node.property, { name: "data" }) &&
                t.isMemberExpression(path.parentPath.node)
            ) {
                // 
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

                    if (t.isAssignmentExpression(path.parentPath.parentPath.node)) {
                        // 如果是修改prop的操作，那么应该增加一个同名的state，并改成state赋值
                        const potentialPropName = getpropDataName(targetProp)
                        const correspondingState_data = stateProperties.find(state => state.name === potentialPropName && !state.is_property);
                        if (correspondingState.type === "ref") {
                            // 替换为 ref 的访问方式：xxx.value
                            path.parentPath.replaceWith(
                                t.memberExpression(
                                    t.identifier(potentialPropName), // 创建 xxx 标识符
                                    t.identifier("value")     // 添加 .value 属性
                                )
                            );
                            if (!correspondingState_data) {
                                stateProperties.push({ name: potentialPropName, type: "ref", var_type: correspondingState.var_type?.toLowerCase(), value: `props.${targetProp}` })
                            }
                        } else {
                            // 替换整个 this.data.xxx 为 xxx
                            path.parentPath.replaceWith(
                                t.identifier(potentialPropName)
                            );
                            if (!correspondingState_data) {
                                stateProperties.push({ name: potentialPropName, type: "reactive", var_type: correspondingState.var_type?.toLowerCase(), value: `props.${targetProp}` })
                            }
                        }
                    }
                    else {
                        path.parentPath.replaceWith(
                            t.memberExpression(
                                t.identifier("props"),
                                t.identifier(targetProp), // 创建 xxx 标识符
                            )
                        );
                    }

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
                // 
                path.replaceWith(t.identifier(property.name));
            }
        },
        VariableDeclarator(path) {
            // 
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
        },
    }, scope);

    return body;
}
export const transformParamReferences = (
    path: any,
    param: { parObjectName: string, name: string, aliasName?: string },
    keyName?: string
) => {
    path.traverse({
        Identifier(childPath) {
            const { node, parent } = childPath;
            if (node.name !== param.name && node.name !== param.aliasName) {
                return
            }
            // 排除以下情况：
            // 1. 对象属性名（如 obj.prop）
            // 2. 声明语句中的标识符（变量声明、函数参数声明等）
            if (
                (t.isMemberExpression(parent) && parent.property === node) ||
                t.isDeclaration(parent)
            ) {
                return;
            }
            // 如果是对象属性的 key，并且它属于 this.setData({ ... })
            if (t.isObjectProperty(parent) && parent.key === node) {
                const grandParent = childPath.findParent(p => t.isCallExpression(p));
                if (
                    grandParent &&
                    t.isMemberExpression(grandParent.node.callee) &&
                    t.isThisExpression(grandParent.node.callee.object) &&
                    t.isIdentifier(grandParent.node.callee.property, { name: "setData" })
                ) {
                    return; // 跳过替换
                }
                else if (t.isObjectProperty(parent) && !parent.computed) {
                    return
                }
            }

            let binding = childPath.scope.getBinding(param.name);
            // 获取绑定信息
            if (param.aliasName) {
                binding = childPath.scope.getBinding(param.aliasName);
            }
            // 核心逻辑：仅处理来自参数的绑定
            if (binding?.kind === 'param') {
                // 构造 this.data.paramName
                let memberExpr = t.memberExpression(
                    t.memberExpression(t.thisExpression(), t.identifier('data')),
                    t.identifier(param.name)
                );
                if (param.parObjectName && keyName === 'watch') {
                    memberExpr = t.memberExpression(
                        t.memberExpression(
                            t.memberExpression(
                                t.thisExpression(), // this
                                t.identifier('data') // this.data
                            ),
                            t.identifier(param.parObjectName) // this.data.item
                        ),
                        t.identifier(param.name) // this.data.item.XX
                    );
                }

                const a = generate(memberExpr).code
                console.log(a)
                // 替换标识符

                childPath.replaceWith(memberExpr);
                childPath.skip(); // 防止重复处理
            }
        }
    });
};
export function replaceEmitAccess(body: t.Node, stateProperties: statePropertiesType[], scope: any) {
    // 转换this.triggerEvent
    traverse(body, {
        CallExpression(path) {
            if (
                t.isMemberExpression(path.node.callee) &&
                t.isThisExpression(path.node.callee.object) &&
                t.isIdentifier(path.node.callee.property, { name: "triggerEvent" })
            ) {
                const eventName = path.node.arguments[0]; // 事件名
                const data = path.node.arguments[1]; // 数据
                let extractedData = ''
                if (t.isStringLiteral(eventName)) {
                    // console.log(`找到事件：${eventName.value}`);
                    if (data) {
                        extractedData = generate(data).code;
                    }
                    // 生成 Vue 代码
                    const vueEmitCode = `emit("${eventName.value}", ${extractedData});`;
                    path.replaceWith(t.expressionStatement(t.identifier(vueEmitCode)));
                    stateProperties.push({ name: eventName.value, type: 'ref', var_type: 'null', is_emit: true })
                }
            }
        },

        BinaryExpression(path) {
            // 检查是否是 `==` 操作符
            if (path.node.operator === '==') {
                // 替换成 `===`
                path.node.operator = '===';
            }
            else if (path.node.operator === '!=') {
                // 替换成 `===`
                path.node.operator = '!==';
            }
        }
    }, scope);

    return body;
}
// 替换 this.setData 和 this.emit
export function replaceSetData(body: t.Node, stateProperties: statePropertiesType[], localVariables: Map<string, localVariablesType>, scope: any) {
    traverse(body, {
        // 处理 this.setData 的调用
        CallExpression(path) {
            // 处理 this.setData 调用
            // 
            if (t.isMemberExpression(path.node.callee) &&
                t.isThisExpression(path.node.callee.object) &&
                t.isIdentifier(path.node.callee.property, { name: "setData" })) {

                handleSetDataCall(path, stateProperties, localVariables);
            }
        },

    }, scope);

    return body;
}

function handleSetDataCall(path, stateProperties: statePropertiesType[], localVariables: Map<string, localVariablesType>) {
    const updates = path.node.arguments[0];
    if (!t.isObjectExpression(updates)) return;
    const statements = [] as t.Statement[];
    // 
    covertSetData(updates, statements, { stateProperties, localVariables })
    path.replaceWithMultiple(statements as never[]);
}
function covertSetData(updates: t.ObjectExpression, statements: t.Statement[], { stateProperties, localVariables }: { stateProperties: statePropertiesType[], localVariables: Map<string, localVariablesType> }) {
    updates.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            const propName = prop.key.name
            if (t.isIdentifier(prop.value)) {
                // 如果是变量，就找这个变量是否在data定义或者在localVariables
                let target = stateProperties.find(p => p.name === propName && (!p.is_emit));
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

export const getpropDataName = (name: string) => {
    return `internal${name.slice(0, 1).toUpperCase() + name.slice(1)}`
}