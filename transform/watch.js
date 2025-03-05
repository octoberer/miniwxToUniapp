
export function generateWatchers(watch_arr) {
  // 生成 Vue 3 的 watch 代码
  const watchProperties = watch_arr.map(watch_obj => {
    const { name, body } = watch_obj
    // const watchNames = name.split(',')
    // const newVars = watchNames.map((name) => `new_${name}`);
    // const oldVars = watchNames.map((name) => `old_${name}`);
    // if (watchNames.length == 1) {
    //   const vueWatch = `watch(${watchNames[0]}, (${newVars[0]}, ${oldVars[0]}) => \n${body}\n);`;
    //   return vueWatch;
    // }
    // else {
    //   const vueWatch = `watch([${watchNames.join(", ")}], ([${newVars.join(", ")}], [${oldVars.join(", ")}]) => \n${body}\n);`;
    //   return vueWatch;
    // }
    return `watchEffect(()=>\n${body}\n)`
  })

  // 返回所有 watch 属性的转换结果
  return watchProperties.join("\n");

}
