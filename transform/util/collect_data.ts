import { Expression, ObjectLiteralExpression, Project, SyntaxKind, ts } from "ts-morph";

/**
 * 从微信小程序代码中提取 this.setData 的参数对象
 * @param code 输入的完整 TS 文件内容
 * @returns 包含所有 setData 参数的合并对象
 */
export function collectAllSetData(code: string) {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("temp.ts", code);

    const results = {};

    // 查找所有的 this.setData() 调用
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.CallExpression)) {
            const callExpr = node.asKind(SyntaxKind.CallExpression);
            if(callExpr){
                const methodExpr = callExpr.getExpression();

                // 匹配 this.setData 的调用形式
                if (methodExpr.getText() === "this.setData") {
                    const args = callExpr.getArguments();
                    if (args.length > 0) {
                        const firstArg = args[0];
    
                        // 处理对象字面量参数
                        if (firstArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
                            const objLiteral = firstArg.asKind(SyntaxKind.ObjectLiteralExpression);
                            if(objLiteral){
                                mergeObjectLiterals(objLiteral, results);
                            }
                            
                        }
                    }
                }
            }
            
        }
    });

    return results;
}

/**
 * 递归合并对象字面量属性
 */
function mergeObjectLiterals(
    objLiteral: ObjectLiteralExpression,
    output: { [x: string]: string; }
) {
    for (const prop of objLiteral.getProperties()) {
        if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const propAssignment = prop.asKind(SyntaxKind.PropertyAssignment);
            if (propAssignment) {
                const propName = propAssignment.getName();
                const initializer = propAssignment.getInitializer();

                // 处理不同类型的初始值
                if (initializer) {
                    output[propName] = parseInitializer(initializer);
                }
            }
            
        }
         // 新增处理简写属性 { appointmentAMFlag }
    else if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
        const shorthandProp = prop.asKind(SyntaxKind.ShorthandPropertyAssignment);
        if (shorthandProp) {
            const propName = shorthandProp.getName();
            output[propName] = ''
        }
        
      }
    }
}

/**
 * 解析不同类型的初始值
 */
function parseInitializer(initializer: Expression<ts.Expression>) {
    // 处理嵌套对象
    if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const nestedObj = {};
        mergeObjectLiterals(
            initializer.asKind(SyntaxKind.ObjectLiteralExpression)!,
            nestedObj
        );
        return nestedObj;
    }

    // 处理数组
    if (initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
        return initializer
            .asKind(SyntaxKind.ArrayLiteralExpression)!
            .getElements()
            .map((el: any) => parseInitializer(el));
    }

    // 处理基本字面量
    switch (initializer.getKind()) {
        case SyntaxKind.StringLiteral:
            return initializer.asKind(SyntaxKind.StringLiteral)!.getLiteralValue();
        case SyntaxKind.NumericLiteral:
            return initializer.asKind(SyntaxKind.NumericLiteral)!.getLiteralValue();
        case SyntaxKind.TrueKeyword:
            return true;
        case SyntaxKind.FalseKeyword:
            return false;
        case SyntaxKind.NullKeyword:
            return null;
        default:
            // 无法解析的复杂表达式返回原始字符串
            return initializer.getText();
    }
}

// 使用示例
// const wxCode = `
// Page({
//   data: {
//     baseInfo: { name: 'Alice' }
//   },
  
//   update() {
//     this.setData({
//       age: 30,
//       "baseInfo.age": 25, // 微信特殊语法
//       scores: [90, 85],
//       extra: {
//         hobbies: ['reading']
//       }
//     });
//   }
// });
// `;

// 解析得到合并后的数据对象
// const parsedData = parseSetDataWithAST(wxCode);
/* 结果:
{
  age: 30,
  "baseInfo.age": 25,
  scores: [90, 85],
  extra: {
    hobbies: ["reading"]
  }
}
*/

// 生成 Vue3 代码
// const vue3Code = generateVue3ReactiveCode(parsedData);
/* 输出:
const age = ref(30);
const baseInfo.age = ref(25); // 需要手动处理微信特殊语法
const scores = reactive([
  90,
  85
]);
const extra = reactive({
  hobbies: reactive([
    "reading"
  ])
});
*/