
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
            return node.name; // 简单标识符（如 param）
        case 'ObjectPattern':
            // 对象解构（如 { prop1, prop2 }）
            return `{ ${node.properties.map(p => generateParameterPattern(p.key)).join(', ')} }`;
        case 'ArrayPattern':
            // 数组解构（如 [elem1, elem2]）
            return `[ ${node.elements.map(e => generateParameterPattern(e)).join(', ')} ]`;
        default:
            throw new Error(`Unsupported parameter type: ${node.type}`);
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