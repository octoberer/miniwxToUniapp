import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * 清理代码中的 Component 和 import 语句
 * @param code 原始代码
 * @returns 清理后的代码
 */
export function removeComponentAndImports(code: string): string {
    // 1. 生成 AST
    const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators'],
    });

    // 2. 遍历并移除目标节点
    traverse(ast, {
        // 移除 import 语句
        ImportDeclaration(path) {
            path.remove();
        },

        // 移除 Component 定义
        CallExpression(path) {
            if (isComponentCall(path.node)) {
                path.remove();
            }
        },
        // 新增处理 require 语句的逻辑
        VariableDeclaration(path) {
            const hasRequire = path.node.declarations.some(declarator => {
                return (
                    declarator.init && // 检查是否存在初始化表达式
                    declarator.init.type === 'CallExpression' && // 是否为函数调用
                    declarator.init.callee.type === 'Identifier' && // 调用的标识符
                    declarator.init.callee.name === 'require' // 标识符名称为 'require'
                );
            });

            // 如果存在 require 调用，则移除整个变量声明
            if (hasRequire) {
                path.remove();
            }
        },
        // 删除所有注释
        enter(path) {
            path.node.leadingComments = null;
            path.node.innerComments = null;
            path.node.trailingComments = null;
        }
    });

    // 3. 生成清理后的代码
    return generate(ast).code;
}

// 判断是否是 Component() 调用
function isComponentCall(node: t.Node): boolean {
    return (
        t.isCallExpression(node) &&
        (t.isIdentifier(node.callee, { name: 'Component' }) || t.isIdentifier(node.callee, { name: 'Page' }) || t.isIdentifier(node.callee, { name: 'ComponentWithStore' }))
    );
}