import { generateMethods } from "./transform/method";
import { generateComputed } from "./transform/computed";
import { transformDestructureToAssignment } from "./transform/destructure";
import { applyFinalReplacements } from "./transform/finalRegexReplacement";
import { generateLifecycle } from "./transform/lifecircle";
import { transformNet } from "./transform/net";
import { parseWechatData } from "./transform/reactive";
import { generatePiniaCode } from "./transform/store";
import { generateWatchers } from "./transform/watch";
export function transformWxTsToVue3Setup(inputCode: string) {
  let transformedCode = transformDestructureToAssignment(inputCode);
  transformedCode = transformNet(transformedCode);
  const { resultCode: piniaStoreCode, store_fields } = generatePiniaCode(transformedCode);
  const { reactiveData, lifecycle, computed, watchers, methods } =
    parseWechatData(transformedCode, store_fields);
  const computedPropertiesCode = generateComputed(computed);
  const watchersCode = generateWatchers(watchers);
  const lifecycleHooksCode = generateLifecycle(lifecycle);
  const methodsCode = generateMethods(methods);

  const combinedCode = `
    ${piniaStoreCode}
    ${reactiveData}
    ${computedPropertiesCode}
    ${watchersCode}
    ${methodsCode}
    // Lifecycle hooks
    ${lifecycleHooksCode ? lifecycleHooksCode : ''}
  `;

  let outputVueCode = `
    <script setup lang="ts">
    ${combinedCode}
    </script>
  `;

  outputVueCode = outputVueCode.replace(/wx\./g, "uni.");
  debugger;
  outputVueCode = applyFinalReplacements(outputVueCode);
  console.log(outputVueCode);

  return outputVueCode;
}



// 1. 转变计算属性
// 2. 转变watch写法
// 2. 转变状态变量
// 3. 转变方法定义
// 4. 转变网络请求方法
// 5. 转变store状态管理
// 6. 转变this.setData
// 7. 转变微信下程序独有的wx.showToast
// 8. 转变生命周期
// 删除const {XXX}=this.data
// 删除this.Xxxx方法
// 删除const {XXX}=….store
// 删除YYYStore.store.XXX的前缀YYYStore.store.