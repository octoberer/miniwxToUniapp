export function generateComputed(computed_arr) {
  if (!computed_arr) {
    return ''
  }
  computed_arr.map(computed => {
    return `const ${computed.name} = computed(() => ${computed.body})`
  })

  return computed_arr.join(";\n");

}

