import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { wxlifecycle } from "./lifetime";
import { functionStrType, replace_pending_arr, resolvefunc, transformFunction2 } from "./util/resolvefunction";

let scope = null
export interface statePropertiesType { name: string, type: "ref" | 'reactive', var_type: string, value?: string, is_property?: boolean, is_store?: boolean }

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
function resolveData(propValue: t.ObjectExpression) {
    const arr = [] as statePropertiesType[]
    propValue.properties.forEach((dataProp: t.Node | null | undefined) => {
        // 过滤非 ObjectProperty 和非 Identifier 的属性
        if (!t.isObjectProperty(dataProp) || !t.isIdentifier(dataProp.key)) {
            return;
        }

        const name = dataProp.key.name;
        const value = dataProp.value;
        const var_type = getType(value)

        // 根据 value 的类型，确定是 ref 还是 reactive
        const isBasicType = t.isLiteral(value) || t.isUnaryExpression(value) || t.isIdentifier(value) || t.isArrayExpression(value);
        const isComplexType = t.isObjectExpression(value) || t.isFunctionExpression(value);

        if (isBasicType) {
            arr.push({ name, type: "ref", var_type, value: generate(value).code });
        } else if (isComplexType) {
            arr.push({ name, type: "reactive", var_type, value: generate(value).code });
        } else {
            // 处理未分类的类型
            console.warn(`Unhandled type for property "${name}":`, value.type);
        }
    });
    return arr
}
export function parseWechatData(code: string, store_fields: string[]) {
    const stateProperties = store_fields.map(store_field => ({ name: store_field, type: 'reactive', var_type: 'string', is_store: true })) as statePropertiesType[];

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
        ObjectExpression(path: { scope: null; parent: { type: string; callee: { name: any; }; }; node: { properties: t.Node[]; }; }) {
            scope = path.scope
            if (path.parent.type === "CallExpression") {
                const name = path.parent.callee.name
                if (name === "Component" || name === "ComponentWithStore" || name === "Page") {
                    path.node.properties.forEach((prop: t.Node) => {
                        if (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') {
                            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                                if (t.isIdentifier(prop.key)) {
                                    const propName = prop.key.name;
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
                                        resolvefunc(propValue, stateProperties, scope, methods, 'methods')
                                    }
                                    else if (prop.key.name === 'lifetimes' || prop.key.name === 'pageLifetimes') {
                                        //处理 lifetimes 或 pageLifetimes，放到 lifecycle 数组
                                        resolvefunc(propValue, stateProperties, scope, lifecycle)

                                    } else if (prop.key.name === 'storeBindings') {

                                        // 处理 storeBindings
                                        if (prop.value.type === 'ObjectExpression') {
                                            storeBindings = `{${prop.value.properties.map(proper => generate(proper).code).join('\n')}}`
                                        }
                                        else if (prop.value.type === 'ArrayExpression') {
                                            storeBindings = `[${prop.value.elements.map(node => generate(node).code).join(',\n')}]`
                                        }

                                    } else if (prop.key.name === 'computed') {
                                        // 补充，处理 computed（计算属性）
                                        resolvefunc(propValue, stateProperties, scope, computed)

                                    } else if (prop.key.name === 'watch' || prop.key.name === 'observers') {

                                        // 补充，处理 watch 或 observers
                                        resolvefunc(propValue, stateProperties, scope, watchers)
                                    }
                                }

                            }
                            else if (t.isIdentifier(prop.key) && wxlifecycle.includes(prop.key.name)) {
                                // 补充，处理生命周期函数，放到 lifecycle 数组
                                resolvefunc(prop, stateProperties, scope, lifecycle)
                            }
                            else if (
                                prop.type === 'ObjectMethod'
                            ) {
                                resolvefunc(prop, stateProperties, scope, methods, 'methods')
                            }
                        }
                    });
                }
            }

        },

    });

    for (let replace_pending_task of replace_pending_arr) {
        transformFunction2(replace_pending_task, stateProperties, scope)
    }
    // 生成 Vue 3 data 代码

    const dataDeclarations = stateProperties.filter(data => !data.is_property && !data.is_store)
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
        `;
    return { reactiveData, lifecycle, storeBindings, computed, watchers, methods };
}


