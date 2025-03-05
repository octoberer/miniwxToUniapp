import traverse from "@babel/traverse";
import * as t from "@babel/types";
export interface localVariablesType {
    name: string,
    type: string,
    location: 'param' | 'declaration'
}

// 类型推断工具函数
const inferType = (node: t.Node) => {
    if (!node) return 'unknown';

    if (t.isNumericLiteral(node)) return 'number';
    if (t.isStringLiteral(node)) return 'string';
    if (t.isBooleanLiteral(node)) return 'boolean';
    if (t.isNullLiteral(node)) return 'null';
    if (t.isIdentifier(node)) return 'unknown'; // 指向其他变量
    if (t.isObjectExpression(node)) return 'object';
    if (t.isArrayExpression(node)) return 'array';
    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) return 'array';
    if (t.isMemberExpression(node)) return 'unknown'; // 对象成员访问
    if (t.isCallExpression(node)) return 'array'; // 函数调用结果

    return 'unknown';
};
export function collectLocalVariables(prop: t.ObjectMethod | t.FunctionExpression, scope: any) {
    // 阶段1: 收集局部变量（名称 + 类型）
    const localVariables = new Map<string, localVariablesType>(); // 改为 Map 结构存储类型信息
    prop.params.forEach((param: t.Node) => {
        if (t.isIdentifier(param)) {
            const paramName = param.name;
            let type = 'unknown';
            type = inferType(param);
            localVariables.set(paramName, {
                name: paramName,
                type: type,
                location: 'param' // 标记来源是参数
            });
        }
    });

    // 收集内部变量声明（含初始化类型）
    traverse(prop.body, {
        VariableDeclarator(path) {
            const id = path.node.id;
            const init = path.node.init;

            if (t.isIdentifier(id)) {
                const varName = id.name;
                const type = inferType(init); // 基于初始化值推断类型

                localVariables.set(varName, {
                    name: varName,
                    type: type,
                    location: 'declaration' // 标记来源是变量声明
                });
            }
        }
    }, scope);
    return localVariables
}