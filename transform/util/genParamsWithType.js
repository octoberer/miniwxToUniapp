
export function genParamsWithType(prop) {
    return prop.params
        .map(param => {
            // 生成参数名称/解构模式
            const pattern = generateParameterPattern(param);
            // 处理可选标记
            const optional = param.optional ? '?' : '';
            // 解析类型注解
            const typeText = param.typeAnnotation
                ? getTypeText(param.typeAnnotation)
                : 'any'; // 无类型标注时默认为any
            return `${pattern}${optional}: ${typeText}`;
        })
        .join(', ');
}


// 生成参数模式（处理解构语法）
function generateParameterPattern(node) {
    switch (node.type) {
        case 'Identifier':
            return node.name;
        case 'ObjectPattern':
            return `{ ${node.properties.map(p => {
                if (p.shorthand) {
                    if (p.value?.type === 'AssignmentPattern') {
                        const left = generateParameterPattern(p.value.left);
                        const right = generateDefaultValue(p.value.right);
                        return `${left} = ${right}`;
                    } else {
                        return generateParameterPattern(p.key);
                    }
                } else {
                    const key = generateParameterPattern(p.key);
                    const value = generateParameterPattern(p.value);
                    return `${key}: ${value}`;
                }
            }).join(', ')} }`;
        case 'ArrayPattern':
            return `[ ${node.elements.map(e => generateParameterPattern(e)).join(', ')} ]`;

        case 'AssignmentPattern': {

            const left = generateParameterPattern(node.left);
            const right = generateDefaultValue(node.right);
            return `${left} = ${right}`;
        }
        default:
            throw new Error(`Unsupported parameter type: ${node.type}`);
    }
}

function generateDefaultValue(node) {
    switch (node.type) {
        case 'ObjectExpression':
            return '{}';
        case 'ArrayExpression':
            return '[]';
        case 'Literal':
            return JSON.stringify(node.value);
        case 'Identifier':
            return node.name;
        default:
            return '...'; // 简化为占位符，实际需根据AST扩展
    }
}
// 类型解析（根据类型注解生成类型文本）
function getTypeText(typeNode) {
    switch (typeNode.type) {
        case 'TSTypeAnnotation':
            return getTypeText(typeNode.typeAnnotation);
        case 'TSStringKeyword':
            return 'string';
        case 'TSNumberKeyword':
            return 'number';
        case 'TSBooleanKeyword':
            return 'boolean';
        case 'TSArrayType':
            const elemType = getTypeText(typeNode.elementType);
            return `${elemType}[]`;
        case 'TSUnionType':
            return typeNode.types.map(t => getTypeText(t)).join(' | ');
        case 'TSTypeReference':
            if (typeNode.typeName.name === 'Array' && typeNode.typeParams) {
                const elemType = getTypeText(typeNode.typeParams[0]);
                return `${elemType}[]`;
            }
            return typeNode.typeName.name;
        case 'TSObjectKeyword':
            return 'object';
        case 'TSLiteralType':
            return JSON.stringify(typeNode.literal.value);
        // 处理嵌套对象类型（如 { prop1: number; prop2: string }）
        case 'TSTypeLiteral':
            const members = typeNode.members.map(m => {
                const key = m.key.name;
                const optional = m.optional ? '?' : '';
                const type = getTypeText(m.typeAnnotation);
                return `${key}${optional}: ${type}`;
            });
            return `{ ${members.join('; ')} }`;
        default:
            return 'any'; // 未知类型回退
    }
}