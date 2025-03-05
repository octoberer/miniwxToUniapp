
export function generateMethods(method_arr) {
  // 将输入字符串包装在一个完整的代码块中
  const methodFunctions = method_arr.map(method_obj => {
    const { name, params, body } = method_obj
    if (body.includes('await')) {
      return `async function ${name}(${params}) ${body}`;
    } else {
      return `function ${name}(${params}) ${body}`;
    }
  })
  // 返回转换后的 Vue 3 方法代码
  return methodFunctions.join('\n');
}