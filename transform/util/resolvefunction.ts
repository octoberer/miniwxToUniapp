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
    modifiedBody: t.BlockStatement,
    name: string,
    params: string,
    arr: functionStrType[]
}
export const replace_pending_arr = [] as replace_pending_type[]
const all_methods_name = [] as string[]
const addThisDataParamsKey = ['watch', 'computed']
export function resolvefunc(
    { propValue, propPath }: { propValue: t.ObjectMethod | t.ObjectProperty | t.ObjectExpression, propPath: any },
    stateProperties: statePropertiesType[],
    scope,
    arr: functionStrType[],
    keyName?: string
) {
    const processObjectMethod = (prop: t.ObjectMethod, name: string) => {
        const isAddThisDataParamsKey = addThisDataParamsKey.includes(keyName)
        if (isAddThisDataParamsKey) {
            addThisDataParams(propPath)
        }
        else {
            processParams(propPath);
        }

        const a = generate(prop).code
        const body = prop.body;
        // 收集该函数的内部变量
        const localVariables = collectLocalVariables(prop, scope, isAddThisDataParamsKey);
        // 替换代码
        const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope);
        const params = genParamsWithType(prop)
        replace_pending_arr.push({ modifiedBody, name, params, arr });
    };

    const processObjectProperty = (prop: t.ObjectProperty, name: string) => {
        const isAddThisDataParamsKey = addThisDataParamsKey.includes(keyName)
        if (isAddThisDataParamsKey) {
            addThisDataParams(propPath)
        }
        else {
            processParams(propPath);
        }
        if (t.isFunctionExpression(prop.value)) {
            const body = prop.value.body; // 获取对象属性值中的函数体

            const a = generate(prop.value).code
            const localVariables = collectLocalVariables(prop.value, scope, isAddThisDataParamsKey);
            const modifiedBody = transformFunction1(body, { stateProperties, localVariables }, scope);
            const params = genParamsWithType(prop.value)
            replace_pending_arr.push({ modifiedBody, name, params, arr });
        }
    };

    // 如果是对象字面量
    if (t.isObjectExpression(propValue)) {
        // a={ a:function(){}, "b":function(){},"e,f":function(){}, c(){}, }
        // 配置项里面的函数
        propValue.properties.forEach(prop => {
            if (t.isObjectMethod(prop)) {
                // c(){}
                if (t.isIdentifier(prop.key)) {
                    const name = prop.key.name;
                    if (keyName === 'methods') all_methods_name.push(name);
                    processObjectMethod(prop, name);
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
                    processObjectProperty(prop, name);
                }
            }
        });
    }
    // 兼容 page 里的生命周期和普通方法
    else if (t.isObjectMethod(propValue) && t.isIdentifier(propValue.key)) {
        // c(){}
        const name = propValue.key.name;
        if (keyName === 'methods') all_methods_name.push(name);
        processObjectMethod(propValue, name);
    }
    // 补充兼容一个isObjectProperty，而且键值是一个函数expression
    else if (t.isObjectProperty(propValue) && t.isFunctionExpression(propValue.value)) {
        //  "b":function(){},"e,f":function(){},a:function(){}
        let name = ''
        if (t.isStringLiteral(propValue.key)) {
            name = propValue.key.value;
        }
        else if (t.isIdentifier(propValue.key)) {
            name = propValue.key.name
        }
        if (keyName === 'methods') all_methods_name.push(name);
        processObjectProperty(propValue, name);
    }
}
function addThisDataParams(propPath: any) {

    let temp_propPath = propPath
    const core = (func_propPath: NodePath<t.ObjectMethod | t.FunctionExpression>) => {
        const paramNames = func_propPath.node.params
            .flatMap((param: t.Node) => {
                if (t.isIdentifier(param)) {
                    // 处理普通参数，如 `param1`
                    return [param.name];
                } else if (t.isObjectPattern(param)) {
                    // 处理对象解构参数，如 `{ allAssistant, currentworker }`
                    return param.properties.map((prop) => {
                        if (t.isObjectProperty(prop)) {
                            return (prop.key as t.Identifier).name; // 提取解构对象的属性名
                        }
                        return null;
                    }).filter((name) => name !== null);
                } else if (t.isArrayPattern(param)) {
                    // 处理数组解构参数，如 `[param1, param2]`
                    return param.elements.map((el) => {
                        if (t.isIdentifier(el)) {
                            return el.name;
                        }
                        return null;
                    }).filter((name) => name !== null);
                }
                return [];
            });

        paramNames.forEach(paramName => {
            transformParamReferences(func_propPath.get("body"), paramName)
        });
    }
    if (propPath.node.type === 'ObjectProperty') {
        propPath.get("value").traverse({
            ObjectMethod(ObjectMethodPath) {
                core(ObjectMethodPath)
            },
            FunctionExpression(funcPath) {
                core(funcPath)
            },
        });
    }
    else {
        core(temp_propPath)
    }

}
function processParams(propPath: any) {
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
        propPath.get("value").traverse({
            ObjectMethod(ObjectMethodPath) {
                processParams(ObjectMethodPath)
            },
            FunctionExpression(funcPath) {
                processParams(funcPath)
            },
        });
    }
    else {
        paramsPath.forEach(renameParam);
    }
}
function generateParamString(param: any): string {
    if (param.type === 'Identifier') {
        return param.name;
    } else if (param.type === 'ObjectPattern') {
        return `{ ${param.properties.map(p => p.key.name).join(', ')} }`;
    } else if (param.type === 'ArrayPattern') {
        return `[${param.elements.map(e => e.name).join(', ')}]`;
    } else if (param.type === 'AssignmentPattern') {
        return `${param.left.name} = ${param.right.value}`;
    } else {
        return JSON.stringify(param);
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
