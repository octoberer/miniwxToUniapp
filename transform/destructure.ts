import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from "@babel/types";

export function transformDestructureToAssignment(code) {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
    });

    traverse(ast, {
        VariableDeclaration(path) {
            path.node.declarations.forEach((declarator) => {
                const { id, init } = declarator;
                // 仅处理对象或数组解构
                if (!t.isObjectPattern(id) && !t.isArrayPattern(id)) {
                    return;
                }
                // debugger
                // 检测 `init` 是否是 `||` 表达式
                const isLogicalOrExpression = t.isLogicalExpression(init) && init.operator === "||";

                // 仅当 `init` 是 `||` 表达式时才创建 `_temp`
                let tempVar = null as any;
                let sourceExpr = init;

                if (isLogicalOrExpression) {
                    tempVar = path.scope.generateUidIdentifier("temp");
                } else {
                    tempVar = init; // 直接使用原始数据源
                }

                // 仅当 `_temp` 存在时才声明变量
                const newDeclarations = [] as any[];
                if (isLogicalOrExpression) {
                    newDeclarations.push(
                        t.variableDeclaration("const", [
                            t.variableDeclarator(tempVar, sourceExpr),
                        ])
                    );
                }

                // 处理对象解构
                if (t.isObjectPattern(id)) {
                    id.properties.forEach((prop) => {
                        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                            const keyName = prop.key.name; // 原始属性名（对象的键）
                            let value = prop.value; // 解构的变量（可能是 Identifier 或 AssignmentPattern）

                            // 处理 `const { userBriefInfo: singleMachineBriefInfo } = userBriefInfo;`
                            let variableName;
                            if (t.isIdentifier(value)) {
                                variableName = value.name; // 变量名
                            } else if (t.isAssignmentPattern(value) && t.isIdentifier(value.left)) {
                                variableName = value.left.name;
                            } else {
                                return; // 跳过不支持的情况
                            }

                            // 提取默认值
                            let defaultValue = null;
                            if (t.isAssignmentPattern(value)) {
                                defaultValue = value.right;
                                value = value.left;
                            }

                            // 生成成员访问表达式 `_temp.keyName`
                            let accessExpr = t.memberExpression(tempVar, t.identifier(keyName));

                            // 处理默认值 `_temp.keyName !== undefined ? _temp.keyName : defaultValue`
                            if (defaultValue) {
                                accessExpr = t.conditionalExpression(
                                    t.binaryExpression("!==", accessExpr, t.identifier("undefined")),
                                    accessExpr,
                                    defaultValue
                                );
                            }

                            // 生成 `const singleMachineBriefInfo = _temp.userBriefInfo`
                            newDeclarations.push(
                                t.variableDeclaration("const", [
                                    t.variableDeclarator(t.identifier(variableName), accessExpr)
                                ])
                            );
                        }
                    });
                }
                else if (t.isArrayPattern(id)) {
                    // 处理数组解构
                    id.elements.forEach((element, index) => {
                        if (!element) return;
                        if (t.isIdentifier(element)) {
                            // 处理 `const [a, b] = arr;`
                            newDeclarations.push(
                                t.variableDeclaration("const", [
                                    t.variableDeclarator(element, t.memberExpression(tempVar, t.numericLiteral(index), true)),
                                ])
                            );
                        } else if (t.isAssignmentPattern(element)) {
                            // 处理 `const [a, b = 2] = arr;`
                            const variableName = element.left;
                            const defaultValue = element.right;
                            const rightExpression = t.conditionalExpression(
                                t.binaryExpression("!==", t.memberExpression(tempVar, t.numericLiteral(index), true), t.identifier("undefined")),
                                t.memberExpression(tempVar, t.numericLiteral(index), true),
                                defaultValue
                            );

                            newDeclarations.push(t.variableDeclaration("const", [t.variableDeclarator(variableName, rightExpression)]));
                        } else if (t.isRestElement(element)) {
                            // 处理 `const [...rest] = arr;`
                            const variableName = element.argument;
                            newDeclarations.push(
                                t.variableDeclaration("const", [
                                    t.variableDeclarator(variableName, t.callExpression(t.memberExpression(tempVar, t.identifier("slice")), [t.numericLiteral(index)])),
                                ])
                            );
                        }
                    });
                }

                // 替换当前变量声明为 `_temp` 变量的赋值和新的解构赋值
                path.replaceWithMultiple(newDeclarations);

            })
        },
        ObjectExpression(path) {
            path.node.properties.forEach((prop, index) => {
                // 处理简写属性
                if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && t.isIdentifier(prop.value) && prop.key.name === prop.value.name) {
                    path.node.properties[index] = t.objectProperty(
                        t.identifier(prop.key.name),
                        t.identifier(prop.key.name)
                    );
                }
            });
        }
    });
    debugger
    const temp = generate(ast).code;
    return temp
}