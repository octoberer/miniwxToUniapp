import traverse, { NodePath } from "@babel/traverse";
import { collectLocalVariables, localVariablesType } from "./collectLocalVariables";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { genParamsWithType } from "./genParamsWithType";
import { getType, statePropertiesType } from "../reactive";
import { replaceEmitAccess, replaceSetData, replaceThisAccess, transformParamReferences } from "./raplace";
export interface functionStrType {
    name: string,
    params: string,
    body: string,
}
interface replace_pending_type {
    modifiedBody: t.Node,
    name: string,
    params: string,
    arr: functionStrType[]
}
export const replace_pending_arr = [] as replace_pending_type[]
const all_methods_name = [] as string[]
const addThisDataParamsKey = ['watch', 'computed']
export function resolvefunc(
    propPath: NodePath<t.ObjectMethod> | NodePath<t.ObjectProperty> | NodePath<t.ObjectExpression>,
    stateProperties: statePropertiesType[],
    arr: functionStrType[],
    keyName?: string
) {
    const currentNode = propPath.node
    const processObjectMethod = (objectMethodPath: NodePath<t.ObjectMethod>, name: string) => {
        const isAddThisDataParamsKey = addThisDataParamsKey.includes(keyName)
        if (isAddThisDataParamsKey) {
            renameAddThisDataToParamsRefer(objectMethodPath, keyName)
        }
        else {
            renameFunctionParamsRefer(objectMethodPath);
        }
        const prop = objectMethodPath.node
        const scope = objectMethodPath.scope
        const body = prop.body;
        // 收集该函数的内部变量
        const localVariables = collectLocalVariables(prop, scope, isAddThisDataParamsKey);
        // 替换代码
        const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope);
        const params = genParamsWithType(prop)
        replace_pending_arr.push({ modifiedBody, name, params, arr });
    };

    const processObjectProperty = (objectPropertyPath: NodePath<t.ObjectProperty>, name: string) => {
        const isAddThisDataParamsKey = addThisDataParamsKey.includes(keyName)
        if (isAddThisDataParamsKey) {
            renameAddThisDataToParamsRefer(objectPropertyPath, keyName)
        }
        else {
            renameFunctionParamsRefer(objectPropertyPath);
        }
        const prop = objectPropertyPath.node;
        const scope = objectPropertyPath.scope
        if (t.isFunctionExpression(prop.value)) {
            const body = prop.value.body; // 获取对象属性值中的函数体
            const localVariables = collectLocalVariables(prop.value, scope, isAddThisDataParamsKey);
            const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope);
            const params = genParamsWithType(prop.value)
            replace_pending_arr.push({ modifiedBody, name, params, arr });
        }
    };

    // 如果是对象字面量
    if (t.isObjectExpression(currentNode)) {
        // { a:function(){}, "b":function(){},"e,f":function(){}, c(){}, }
        // 配置项里面的函数
        propPath.get("properties").forEach((func_path: NodePath<t.ObjectMethod> | NodePath<t.ObjectProperty>) => {
            // prop是每一个函数
            const prop = func_path.node
            if (t.isObjectMethod(prop)) {
                // c(){}
                if (t.isIdentifier(prop.key)) {
                    const name = prop.key.name;
                    if (keyName === 'methods') all_methods_name.push(name);
                    processObjectMethod(func_path, name);
                }
            } else if (t.isObjectProperty(prop)) {
                // 键值是方法名，包括多个观察者属性
                //  "b":function(){},"e,f":function(){},a:function(){}
                if (t.isFunctionExpression(prop.value)) {
                    let name = ''
                    if (t.isStringLiteral(prop.key)) {
                        //  "b":function(){},"e,f":function(){}
                        name = prop.key.value;
                    }
                    else if (t.isIdentifier(prop.key)) {
                        // a:function(){}
                        name = prop.key.name
                    }
                    if (keyName === 'methods') all_methods_name.push(name);
                    processObjectProperty(func_path, name);
                }
            }
        });
    }
    // 兼容 page 里的生命周期和普通方法
    else if (t.isObjectMethod(currentNode)) {
        // c(){}
        if (t.isIdentifier(currentNode.key)) {
            const name = currentNode.key.name;
            if (keyName === 'methods') all_methods_name.push(name);
            processObjectMethod(propPath, name);
        }
    }
    // 补充兼容ObjectProperty，而且键值是一个函数expression
    else if (t.isObjectProperty(currentNode)) {
        //  "b":function(){},"e,f":function(){},a:function(){}
        if (t.isFunctionExpression(currentNode.value)) {
            let name = ''
            if (t.isStringLiteral(currentNode.key)) {
                name = currentNode.key.value;
            }
            else if (t.isIdentifier(currentNode.key)) {
                name = currentNode.key.name
            }
            if (keyName === 'methods') all_methods_name.push(name);
            processObjectProperty(propPath, name);
        }
    }
}
function renameAddThisDataToParamsRefer(propPath: NodePath<t.ObjectMethod | t.ObjectProperty>, keyName: string) {
    let temp_propPath = propPath
    const core = (func_propPath: NodePath<t.ObjectMethod | t.FunctionExpression>, raw_params_arr: string[]) => {
        const paramNames = func_propPath.node.params
            .flatMap((param: t.Node, index: number) => {
                if (t.isIdentifier(param)) {
                    // 处理普通参数，如 `param1`
                    return { name: raw_params_arr[index], aliasName: param.name };
                } else if (t.isObjectPattern(param)) {
                    // 处理对象解构参数，如 `{ allAssistant, currentworker }`
                    return param.properties.map((prop) => {
                        if (t.isObjectProperty(prop)) {
                            return { parObjectName: raw_params_arr[index], name: (prop.key as t.Identifier).name }; // 提取解构对象的属性名
                        }
                        return null;
                    }).filter((name) => name !== null);
                } else if (t.isArrayPattern(param)) {
                    // 处理数组解构参数，如 `[param1, param2]`
                    return param.elements.map((el) => {
                        if (t.isIdentifier(el)) {
                            return { parObjectName: raw_params_arr[index], name: el.name };
                        }
                        return null;
                    }).filter((name) => name !== null);
                }
                return [];
            });

        paramNames.forEach((param: { parObjectName: string, name: string }) => {
            // 比如观察的是item,参数是解构了item的属性，那么parObjectName就为item
            transformParamReferences(func_propPath.get("body"), param, keyName)
        });
    }
    if (propPath.node.type === 'ObjectProperty') {
        const valuePath = propPath.get("value")
        const code = generate(valuePath.node).code
        if (valuePath.isObjectMethod()) {
            const parObjectName = valuePath.node.key.name
            core(valuePath, [parObjectName])
        }
        else if (valuePath.isFunctionExpression()) {
            let raw_params_arr = []
            if (t.isIdentifier(valuePath.parent.key)) {
                raw_params_arr = valuePath.parent.key.name
            }
            else if (t.isStringLiteral(valuePath.parent.key)) {
                const fcunName = valuePath.parent.key.value
                raw_params_arr = fcunName.split(',').map((item: string) => item.trim())
            }
            core(valuePath, raw_params_arr)
        }
    }
    else {
        const parObjectName = temp_propPath.node.key.name
        core(temp_propPath, [parObjectName])
    }

}
function renameFunctionParamsRefer(propPath: NodePath<t.ObjectMethod | t.ObjectProperty>) {
    const renameParam = (paramPath: any) => {
        const handleIdentifier = (path) => {
            const paramName = path.node.name;

            // 此时还没有收集所有的数据初始定义，因为还有setData里的，所有这里即使判断是否矛盾，也没有用，因为可能setData里和参数同名，所以所有的参数都更改名字+"_"
            // const isConflict = stateProperties.some(s => s.name === paramName);
            // if (!isConflict) return;
            // 生成新名称并替换节点
            const newName = path.scope.generateUidIdentifier(`_${paramName}`);
            // 关键点：直接修改解构属性的值部分
            if (path.parentPath?.isObjectProperty()) {
                // 创建新属性节点 { a: _a }
                const newProperty = t.objectProperty(
                    path.parentPath.node.key, // 保留原属性名（如 a）
                    newName // 替换值为新名称
                );
                path.parentPath.replaceWith(newProperty);
            } else {
                // 普通标识符直接替换（如直接参数 a → _a）
                path.replaceWith(newName);
            }

            // 更新作用域内的所有引用
            path.scope.rename(paramName, newName.name);

            const a = generate(propPath.node).code;

        };

        // 处理不同类型的参数
        if (paramPath.isIdentifier()) {
            handleIdentifier(paramPath);
        } else if (paramPath.isObjectPattern()) {
            paramPath.get("properties").forEach(prop => {
                if (prop.isObjectProperty()) {
                    // 关键修复：处理 value 而非 key
                    const valuePath = prop.get("value");
                    renameParam(valuePath);
                } else if (prop.isRestElement()) { // 修复变量名错误（原 propPath→prop）
                    renameParam(prop.get("argument"));
                }
            });
        } else if (paramPath.isArrayPattern()) {
            paramPath.get("elements").forEach(el => {
                if (el.isIdentifier() || el.isPattern()) {
                    renameParam(el);
                }
            });
        } else if (paramPath.isAssignmentPattern()) {
            renameParam(paramPath.get("left"));
        } else if (paramPath.isRestElement()) {
            renameParam(paramPath.get("argument"));
        }
    };
    // 如果是一个propPath.node是ObjectMethod或者函数表达式，就可以直接取参数
    let paramsPath = propPath.get("params")
    if (!Array.isArray(paramsPath)) {
        // 如果不是，就是对象表达式，要获取其键值的ObjectMethod或者函数表达式部分
        const valuePath = propPath.get("value")
        renameFunctionParamsRefer(valuePath)
    }
    else {
        paramsPath.forEach(renameParam);
    }
}
function transformFunction1(body, { stateProperties, localVariables }, scope) {
    return replaceSetData(body, stateProperties, localVariables, scope);
}
export function transformFunction2({ modifiedBody, name, params, arr }: replace_pending_type, stateProperties: statePropertiesType[], scope) {
    const modifiedBody_2 = replaceThisAccess(modifiedBody, stateProperties, scope, all_methods_name);
    const modifiedBody_3 = replaceEmitAccess(modifiedBody_2, stateProperties, scope)
    arr.push({
        name: name,
        params,
        body: generate(modifiedBody_3).code
    })
}
