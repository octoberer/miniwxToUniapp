export function generateLifecycle(arr) {
    if ((!arr) || arr.length == 0) {
        return ''
    }
    // 定义生命周期映射表
    const lifecycleMapping = {
        onLoad: 'onMounted',         // onLoad -> onMounted
        onShow: 'onShow',         // onShow -> onMounted
        onHide: 'onBeforeUnmount',   // onHide -> onBeforeUnmount
        onUnload: 'onUnmounted',     // onUnload -> onUnmounted
        onPullDownRefresh: 'onUpdated', // onPullDownRefresh -> onUpdated
        onReachBottom: 'onUpdated',     // onReachBottom -> onUpdated
        onShareAppMessage: 'onMounted', // onShareAppMessage -> onMounted
        show: 'onShow',
        created: 'onCreated',        // created -> onCreated
        attached: 'onMounted',       // attached -> onMounted
        detached: 'onUnmounted',     // detached -> onUnmounted
    };
    // 正则匹配生命周期函数，如 onLoad, onShow 等
    return arr.map(method_obj => {
        const { name, params, body } = method_obj
        const vue3LifecycleName = lifecycleMapping[name] || name;
        // 如果name不符合vue3规范，就进行转换，补充……
        return `${vue3LifecycleName}((${params}) => ${body})`
    }).join('\n')
}
