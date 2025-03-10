import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { wxlifecycle } from "./lifetime";
import { functionStrType, replace_pending_arr, resolvefunc, transformFunction2 } from "./util/resolvefunction";

let scope = null
export interface statePropertiesType { name: string, type: "ref" | 'reactive', var_type: string, value?: string, is_property?: boolean, is_store?: boolean, is_emit?: boolean }

export function getType(value: t.Node) {
    // 根据 value 的具体类型，确定 var_type
    let var_type: string;
    if (t.isStringLiteral(value)) {
        var_type = "string";
    } else if (t.isNumericLiteral(value)) {
        var_type = "number";
    } else if (t.isBooleanLiteral(value)) {
        var_type = "boolean";
    } else if (t.isNullLiteral(value)) {
        var_type = "null";
    } else if (t.isObjectExpression(value)) {
        var_type = "object";
    } else if (t.isArrayExpression(value)) {
        var_type = "array";
    } else if (t.isFunctionExpression(value) || t.isArrowFunctionExpression(value)) {
        var_type = "function";
    } else if (t.isIdentifier(value)) {
        var_type = "identifier"; // 可能是变量引用
    } else if (t.isUnaryExpression(value)) {
        var_type = "unary"; // 例如 +1, -1, !true
    } else {
        var_type = "unknown"; // 未知类型
    }
    return var_type
}
// 判断当前函数是否在组件或页面定义内
function isInsideComponentOrPage(path) {
    const parent = path.findParent((p) => p.isCallExpression());
    // 判断是否是组件或页面的调用表达式
    return parent && t.isCallExpression(parent.node) &&
        (t.isIdentifier(parent.node.callee) && ["Component", "Page", "ComponentWithStore"].includes(parent.node.callee.name));
}
function resolveData(propValue: t.ObjectExpression) {
    const arr = [] as statePropertiesType[];
    propValue.properties.forEach((dataProp: t.Node | null | undefined) => {
        if (!t.isObjectProperty(dataProp) || !t.isIdentifier(dataProp.key)) {
            return;
        }

        const name = dataProp.key.name;
        const value = dataProp.value;

        // 处理类型断言（TypeScript 的 as 语法）
        let var_type = "";
        if (t.isTSAsExpression(value)) {
            // 使用 generator 从类型注解节点生成类型字符串
            var_type = generate(value.typeAnnotation).code;
        } else {
            // 没有类型断言时使用类型推断
            var_type = getType(value);
        }

        // 根据 value 的实际类型判断 ref/reactive
        const actualValue = t.isTSAsExpression(value) ? value.expression : value;

        const isBasicType = t.isLiteral(actualValue) ||
            t.isUnaryExpression(actualValue) ||
            t.isIdentifier(actualValue) ||
            t.isArrayExpression(actualValue);

        const isComplexType = t.isObjectExpression(actualValue) ||
            t.isFunctionExpression(actualValue);

        if (isBasicType) {
            arr.push({
                name,
                type: "ref",
                var_type,
                value: generate(actualValue).code
            });
        } else if (isComplexType) {
            arr.push({
                name,
                type: "reactive",
                var_type,
                value: generate(actualValue).code
            });
        } else {
            console.warn(`Unhandled type for property "${name}":`, actualValue.type);
        }
    });
    return arr;
}
export function parseWechatData(code: string, store_fields: string[]) {
    const stateProperties = store_fields.map(store_field => ({ name: store_field, type: 'reactive', var_type: 'string', is_store: true })) as statePropertiesType[];
    const extractedFunctions: string[] = [];
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "classProperties", "decorators-legacy"],
    });

    // 初始化所有需要使用的数组和变量
    const methods = [] as functionStrType[];
    const lifecycle = [] as functionStrType[];
    let storeBindings = "";
    const computed = [] as functionStrType[];
    const watchers = [] as functionStrType[];
    traverse(ast, {
        ObjectExpression(path) {
            scope = path.scope
            if (path.parent.type === "CallExpression") {
                const name = path.parent.callee.name
                if (name === "Component" || name === "ComponentWithStore" || name === "Page") {
                    path.get("properties").forEach((propPath) => {
                        const prop = propPath.node

                        const temp = generate(prop).code
                        if (prop.type === 'ObjectProperty') {
                            // 配置项A：B
                            let propName = ''
                            if (t.isIdentifier(prop.key)) {
                                propName = prop.key.name
                            }
                            else if (t.isStringLiteral(prop.key)) {
                                propName = prop.key.value
                            }
                            if (t.isObjectExpression(prop.value)) {
                                // 类似data:{}里的{}
                                const propValue = prop.value;
                                if (propName === "properties") {
                                    // 处理 props 定义
                                    if (t.isObjectExpression(propValue)) {
                                        propValue.properties.forEach(p => {
                                            if (t.isObjectProperty(p)) {
                                                if (t.isIdentifier(p.key) && (t.isObjectExpression(p.value))) {
                                                    const name = p.key.name;
                                                    const valueProp = p.value.properties.find((p) => {
                                                        if (t.isObjectProperty(p) && t.isIdentifier(p.key)) {
                                                            return p.key.name === "value"
                                                        }
                                                    });
                                                    const typeProp = p.value.properties.find(prop => {
                                                        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                                                            return prop.key.name === "type"
                                                        }
                                                    }
                                                    );
                                                    if (!(typeProp && t.isObjectProperty(typeProp))) {
                                                        return
                                                    }
                                                    const typeValue = generate(typeProp.value).code;

                                                    if (valueProp && t.isObjectProperty(valueProp)) {
                                                        // 如果存在 value 属性，处理它的值
                                                        const value = valueProp.value;
                                                        // 判断 value 是否为对象类型
                                                        if (t.isObjectExpression(value)) {
                                                            // 如果是对象，使用 reactive
                                                            stateProperties.push({ name, type: "reactive", var_type: typeValue, value: generate(value).code, is_property: true });
                                                        } else {
                                                            // 如果不是对象，使用 ref
                                                            stateProperties.push({ name, type: "ref", var_type: typeValue, value: generate(value).code, is_property: true });
                                                        }
                                                    }
                                                    else {
                                                        if (['Object', 'Array'].includes(typeValue)) {
                                                            stateProperties.push({ name, type: "reactive", var_type: typeValue, is_property: true });
                                                        }
                                                        else {
                                                            stateProperties.push({ name, type: "ref", var_type: typeValue, is_property: true });
                                                        }
                                                    }
                                                }
                                            }
                                        });

                                    }
                                } else if (propName === "data") {
                                    // 处理 data 定义
                                    if (t.isObjectExpression(propValue)) {
                                        stateProperties.push(...resolveData(propValue))
                                    }
                                }
                                else if (propName === "methods") {
                                    // 处理剩余代码的data替换
                                    resolvefunc({ propValue: propValue, propPath }, stateProperties, scope, methods, 'methods')
                                }
                                else if (propName === 'lifetimes' || propName === 'pageLifetimes') {
                                    //处理 lifetimes 或 pageLifetimes，放到 lifecycle 数组
                                    resolvefunc({ propValue: propValue, propPath }, stateProperties, scope, lifecycle)

                                } else if (propName === 'computed') {

                                    // 补充，处理 computed（计算属性）
                                    resolvefunc({ propValue: propValue, propPath }, stateProperties, scope, computed, 'computed')

                                } else if (propName === 'watch' || propName === 'observers') {

                                    // 补充，处理 watch 或 observers
                                    resolvefunc({ propValue: propValue, propPath }, stateProperties, scope, watchers, 'watch')
                                }
                            }
                            else if (t.isFunctionExpression(prop.value)) {
                                // 普通方法a:function(){}中的function(){}
                                resolvefunc({ propValue: prop, propPath }, stateProperties, scope, methods, 'methods')
                            }
                        }
                        else if (prop.type === 'ObjectMethod') {
                            let propName = prop.key.name
                            if (wxlifecycle.includes(propName)) {
                                debugger
                                // 补充，处理生命周期函数，放到 lifecycle 数组
                                resolvefunc({ propValue: prop, propPath }, stateProperties, scope, lifecycle)
                            }
                            else {
                                // 除了生命周期的普通函数
                                resolvefunc({ propValue: prop, propPath }, stateProperties, scope, methods, 'methods')
                            }
                        }
                    });
                }
            }

        },
        // 匹配函数声明
        FunctionDeclaration(path) {
            // 获取带有 export 的函数代码
            function getExportedCode(path) {
                let functionCode = path.toString();
                // 检查函数是否有 export
                const isExported = path.findParent((p) => p.isExportDeclaration());
                if (isExported) {
                    functionCode = `export ${functionCode}`;
                }
                return functionCode;
            }
            // 判断该函数是否在组件或页面定义外
            if (!isInsideComponentOrPage(path)) {
                const functionCode = getExportedCode(path);
                extractedFunctions.push(functionCode);
            }

        },

    });

    for (let replace_pending_task of replace_pending_arr) {
        transformFunction2(replace_pending_task, stateProperties, scope)
    }

    const dataDeclarations = stateProperties.filter(data => !data.is_property && !data.is_store && !data.is_emit)
        .map(data => {
            if (data.type === "ref") {
                const type_string = data.var_type == 'unknown' || '' ? '' : data.var_type == 'array' ? '<any[]>' : `<${data.var_type}>`
                const default_value = `${data.value === "" ? '""' : data.value ? data.value : data.var_type == 'string' ? '""' : data.var_type == 'number' ? '0' : data.var_type == 'array' ? '[]' : null}`
                return `const ${data.name} = ref${type_string}(${default_value});`;
            } else {
                return `const ${data.name} = reactive(${data.value ? data.value : '{}'});`;
            }
        })
        .join("\n");
    const propertiesDeclarations = stateProperties.filter(prop => prop.is_property)
    const emit = stateProperties.filter(prop => prop.is_emit)
    const emitDeclarations = emit.length > 0 ? `const emit= defineEmits([${emit.map(prop => '"' + prop.name + '"').join(',')}]);` : ""
    const propertiesDeclarations_str = propertiesDeclarations.length > 0 ? `const props = defineProps({\n  ${propertiesDeclarations
        .map((prop) => {
            if (prop.value) {
                return `${prop.name}: {
                    type: ${prop.var_type},
                    default: ${prop.value}
                  }`
            }
            else {
                return `${prop.name}: ${prop.var_type}`
            }
        })
        .join(",\n  ")}\n});` : '';

    const reactiveData = `
        ${dataDeclarations}
        ${propertiesDeclarations_str}
        ${emitDeclarations}
        `;
    return { reactiveData, lifecycle, storeBindings, computed, watchers, methods, extractedFunctions };
}


