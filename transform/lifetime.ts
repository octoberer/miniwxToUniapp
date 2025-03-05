const pagelifecycle = [
    "onLoad",          // 页面加载时触发，参数为页面路径参数
    "onShow",          // 页面显示/切入前台时触发
    "onHide",          // 页面隐藏/切入后台时触发
    "onUnload",        // 页面卸载时触发
    "onPullDownRefresh", // 下拉刷新时触发
    "onReachBottom",   // 页面上拉触底时触发
    "onShareAppMessage", // 用户点击右上角分享时触发
]
const compLifecycle = [
    "created",       // 组件实例被创建时触发
    "attached",      // 组件实例进入页面节点树时触发
    "detached",      // 组件实例从页面节点树移除时触发
]
export const wxlifecycle = [...pagelifecycle, ...compLifecycle]