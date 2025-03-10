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

// 变量信息结构
interface LocalVariableInfo {
    name: string;
    type: string;
    location: "param" | "declaration";
}

/**
 * 递归处理解构参数，提取变量名
 */
function extractDestructuredParams(
    param: t.Node,
    localVariables: Map<string, LocalVariableInfo>
) {
    if (t.isObjectPattern(param)) {
        // 处理对象解构 { a, b }
        param.properties.forEach((prop) => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
                const paramName = prop.value.name;
                localVariables.set(paramName, {
                    name: paramName,
                    type: "unknown", // 无法直接推断类型
                    location: "param",
                });
            }
        });
    } else if (t.isArrayPattern(param)) {
        // 处理数组解构 [x, y]
        param.elements.forEach((element) => {
            if (t.isIdentifier(element)) {
                const paramName = element.name;
                localVariables.set(paramName, {
                    name: paramName,
                    type: "unknown",
                    location: "param",
                });
            }
        });
    }
}

/**
 * 收集局部变量（支持解构参数）
 */
export function collectLocalVariables(
    prop: t.ObjectMethod | t.FunctionExpression,
    scope: any,
    isAddThisDataParamsKey: boolean
): Map<string, LocalVariableInfo> {
    const localVariables = new Map<string, LocalVariableInfo>();
    if (!isAddThisDataParamsKey) {
        // 处理函数参数（包括解构）
        prop.params.forEach((param) => {
            if (t.isIdentifier(param)) {
                // 普通参数
                const paramName = param.name;
                localVariables.set(paramName, {
                    name: paramName,
                    type: inferType(param),
                    location: "param",
                });
            } else {
                // 处理解构参数
                extractDestructuredParams(param, localVariables);
            }
        });
    }

    // 处理函数内部变量
    traverse(
        prop.body,
        {
            VariableDeclarator(path) {
                const id = path.node.id;
                const init = path.node.init;

                if (t.isIdentifier(id)) {
                    // 变量声明 (let x = 10)
                    localVariables.set(id.name, {
                        name: id.name,
                        type: inferType(init),
                        location: "declaration",
                    });
                } else {
                    // 变量解构声明 (let { a, b } = obj)
                    extractDestructuredParams(id, localVariables);
                }
            },
        },
        scope
    );

    return localVariables;
}
