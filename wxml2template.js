"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertWXMLToVueTemplate = void 0;
function convertWXMLToVueTemplate(wxml) {
    // 1. 替换自定义组件（优化属性顺序无关匹配）
    wxml = wxml.replace(/<custom-image\s+([^>]*)\b(srcName)="([^"]+)"([^>]*)\b(customclass)="([^"]+)"([^>]*)>/gi, function (_, prefix, srcKey, srcVal, mid, clsKey, clsVal, suffix) {
        var dynamicSrc = srcVal.includes('{') ? "(".concat(srcVal, ")") : "'".concat(srcVal, "'");
        return "<image ".concat(prefix).concat(mid).concat(suffix, " :src=\"'/static/image/' + ").concat(dynamicSrc, " + '.png'\" class=\"").concat(clsVal, "\"/>");
    });
    // 2. 转换条件渲染和循环（添加key处理）
    wxml = wxml
        // 处理 wx:for（替换 block）
        .replace(/<block\s+wx:for="{{(.*?)}}"\s*(wx:key=".*?")?>/g, function (_, list, keyAttr) {
        var key = keyAttr ? " ".concat(keyAttr.replace('wx:key', ':key')) : '';
        return "<template v-for=\"(item, index) in ".concat(list, "\"").concat(key, ">");
    })
        .replace(/<\/block>/g, '</template>')
        // 处理 wx:if，如果 wx:if 在 <block> 上，就换成 <template>
        .replace(/<block\s+wx:if="{{(.*?)}}"\s*>/g, '<template v-if="$1">')
        .replace(/<\/block>/g, '</template>')
        // 处理普通 wx:if
        .replace(/wx:if="{{(.*?)}}"/g, 'v-if="$1"')
        .replace(/wx:elif="{{(.*?)}}"/g, 'v-else-if="$1"')
        .replace(/wx:else/g, 'v-else');
    // 处理 <template v-for="(item, index) in XXX">，并添加 :key="index"
    wxml = wxml.replace(/<template v-for="(.*?) in (.*?)">/g, function (m, item, list) {
        return "<template v-for=\"".concat(item, " in ").concat(list, "\" :key=\"index\">");
    });
    // 3. 处理数据绑定（增强复杂表达式处理）
    wxml = wxml
        .replace(/(\S+?)="{{{(.*?)}}}"/g, ':$1="$2"') // 处理 {{{}}} 语法
        .replace(/(\S+?)="{{(.*?)}}"/g, function (_, name, value) {
        // 处理字面量对象/数组
        if (/^(\[.*\]|\{.*\})$/.test(value)) {
            return ":".concat(name, "=\"").concat(value, "\"");
        }
        return ":".concat(name, "=\"").concat(value.replace(/"/g, "'"), "\"");
    });
    // 4. 转换事件绑定（添加事件名映射）
    wxml = wxml
        .replace(/\bbind:([a-zA-Z0-9]+)/g, '@$1') // 处理 bind:tap、bind:change 这些事件
        .replace(/\bcatch:([a-zA-Z0-9]+)/g, '@$1.stop') // 处理 catch:xxx 事件，Vue 里用 .stop 修饰符
        .replace(/\bbind([a-zA-Z0-9]+)/g, '@$1'); // 处理 bindchild2parXxx 这种自定义事件
    // 5. 处理样式和类绑定（优化动态类处理）
    wxml = wxml
        .replace(/class="{{(.*?)}}"/g, function (_, exp) {
        // 处理三元表达式
        if (exp.includes('?')) {
            return ":class=\"".concat(exp, "\"");
        }
        // 处理普通表达式
        return ":class=\"".concat(exp, "\"");
    })
        .replace(/style="([^"]*)"/g, function (_, content) {
        if (content.includes('{{')) {
            var styleExpr = content.replace(/{{|}}/g, '')
                .replace(/(\w+):/g, "'$1': ")
                .replace(/;/g, ',');
            return ":style=\"{ ".concat(styleExpr, " }\"");
        }
        return "style=\"".concat(content, "\"");
    });
    // 6. 单位转换（rpx转px）
    wxml = wxml.replace(/(\d+)rpx/g, function (_, num) { return "".concat(num * 2, "px"); }); // 假设2倍换算
    // 7. 处理Vant组件
    wxml = wxml
        // .replace(/van-(\w+)/g, 'Van$1')
        .replace(/custom-class="(.*?)"/g, 'class="$1"');
    // .replace(/show="{{(.*?)}}"/g, (_, exp) => `v-show="${exp}"`);
    // 8. 处理自闭合标签（扩展标签列表）
    var selfClosingTags = ['image', 'input', 'img'];
    wxml = wxml.replace(/<(\w+)([^>]*?)\s*\/?>/g, function (m, tag, attrs) {
        // 如果是自闭合标签，转换为 <tag ... />
        if (selfClosingTags.includes(tag)) {
            // 返回自闭合标签
            return "<".concat(tag).concat(attrs, " />");
        }
        // 如果不是自闭合标签，保留原样
        return m;
    })
        // 删除结束标签
        .replace(/<\/(\w+)>/g, function (m, tag) {
        return selfClosingTags.includes(tag) ? '' : m; // 删除自闭合标签的结束部分
    });
    // 7. 其他样式处理
    wxml = wxml
        .replace(/font-(\d+)/g, 'text-[$1px]')
        .replace(/([wh])-(\d+)/g, '$1-[$2px]')
        .replace(/flex-(row|col)/g, 'flex $&');
    // 9. 处理特殊插值表达式（如url参数）
    wxml = wxml.replace(/="([^"]*)\{\{(.*?)\}\}([^"]*)"/g, function (_, prefix, exp, suffix) {
        return "=\"".concat(prefix, "${").concat(exp, "}").concat(suffix, "\"");
    });
    // const customTagRegex = /<([a-z][a-z0-9-]*)\s/g;
    // wxml = wxml.replace(customTagRegex, (match, tagName) => {
    //     // 跳过内置标签，如 <view>, <text> 等
    //     const builtInTags = ['view', 'text', 'image', 'button', 'input', 'form', 'swiper', 'swiper-item', 'navigator'];
    //     if (builtInTags.includes(tagName)) {
    //         return match; // 如果是内置标签，不做处理
    //     }
    //     // 转换为大驼峰形式
    //     const pascalCase = tagName
    //         .split('-')
    //         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    //         .join('');
    //     return `<${pascalCase} `; // 返回替换后的标签
    // });
    return wxml;
}
exports.convertWXMLToVueTemplate = convertWXMLToVueTemplate;
