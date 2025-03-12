"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertWXMLToVueTemplate = void 0;
function convertDynamicClassToVue(wxml) {
    return wxml.replace(/class="([^"]*)"/g, function (match, content) {
        var staticClasses = [];
        var dynamicClasses = [];
        // 使用正则分割静态和动态部分
        var parts = content.split(/({{.*?}})/g);
        parts.forEach(function (part) {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                var expr = part.slice(2, -2).trim();
                dynamicClasses.push(expr);
            }
            else if (part.trim()) {
                // 处理多个静态类名（可能有空格分隔）
                part.split(/\s+/).forEach(function (cls) {
                    if (cls)
                        staticClasses.push(cls);
                });
            }
        });
        // 构建结果
        var result = '';
        if (staticClasses.length > 0) {
            result += "class=\"".concat(staticClasses.join(' '), "\"");
        }
        if (dynamicClasses.length > 0) {
            // 动态部分转为数组语法
            result += "".concat(result ? ' ' : '', ":class=\"[").concat(dynamicClasses.join(', '), "]\"");
        }
        return result || 'class=""'; // 避免空属性
    });
}
function convertDynamicStyleToVue(wxml) {
    return wxml.replace(/style="([^"]*)"/g, function (match, content) {
        // 处理纯动态表达式（如 style="{{styleObj}}"）
        var fullDynamicMatch = content.match(/^{{(.*)}}$/);
        if (fullDynamicMatch) {
            return ":style=\"".concat(fullDynamicMatch[1].trim(), "\"");
        }
        var styleProps = [];
        var declarations = content.split(';');
        declarations.forEach(function (decl) {
            decl = decl.trim();
            if (!decl)
                return;
            var _a = decl.split(':').map(function (s) { return s.trim(); }), prop = _a[0], value = _a[1];
            if (!prop || !value)
                return;
            // 转换属性名为驼峰式
            var vueProp = prop.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
            // 处理动态值
            var vueValue;
            if (/{{.*?}}/.test(value)) {
                // 替换 {{expr}} 为 ${expr}，并包裹模板字符串
                vueValue = "`".concat(value.replace(/{{(.*?)}}/g, function (_, expr) { return "${".concat(expr.trim(), "}"); }), "`");
            }
            else {
                vueValue = "'".concat(value, "'"); // 静态值
            }
            styleProps.push("".concat(vueProp, ": ").concat(vueValue));
        });
        return styleProps.length > 0
            ? ":style=\"{ ".concat(styleProps.join(', '), " }\"")
            : '';
    });
}
function convertWXMLToVueTemplate(wxml) {
    //替换自定义组件（优化属性顺序无关匹配）
    wxml = wxml.replace(/<custom-image\s+([^>]*)\b(srcName)="([^"]+)"([^>]*)\b(customclass)="([^"]+)"([^>]*)>/gi, function (_, prefix, srcKey, srcVal, mid, clsKey, clsVal, suffix) {
        var dynamicSrc = srcVal.includes('{') ? "(".concat(srcVal, ")") : "'".concat(srcVal, "'");
        return "<image ".concat(prefix).concat(mid).concat(suffix, " :src=\"'/static/image/' + ").concat(dynamicSrc, " + '.png'\" class=\"").concat(clsVal, "\"/>");
    })
        .replace(/<custom-image\s+([^>]*)\b(customclass)="([^"]+)"([^>]*)\b(srcName)="([^"]+)"([^>]*)>/gi, function (_, prefix, clsKey, clsVal, mid, srcKey, srcVal, suffix) {
        var dynamicSrc = srcVal.includes('{') ? "(".concat(srcVal, ")") : "'".concat(srcVal, "'");
        return "<image ".concat(prefix).concat(mid).concat(suffix, " :src=\"'/static/image/' + ").concat(dynamicSrc, " + '.png'\" class=\"").concat(clsVal, "\"/>");
    });
    wxml = wxml.replace('</custom-image>', '');
    // 转换条件渲染和循环（修正版）
    wxml = wxml
        // 处理 <block wx:for> 转换为 <template v-for>（保留原有逻辑）
        .replace(/<block\s+wx:for="{{(.*?)}}"\s*(wx:for-index="(.*?)")?\s*(wx:for-item="(.*?)")?\s*(wx:key=".*?")?>/g, function (_, list, ___, forIndex, __, forItem, keyAttr) {
        var index = forIndex || 'index';
        var item = forItem || 'item';
        var key = keyAttr ? " ".concat(keyAttr.replace('wx:key', 'key')) : '';
        return "<template v-for=\"(".concat(item, ", ").concat(index, ") in ").concat(list, "\"").concat(key, ">");
    })
        .replace(/<\/block>/g, '</template>')
        // 新增：处理普通元素上的 wx:for（重要修正！）
        .replace(/<(\w+)([^>]*) wx:for="{{(.*?)}}"( wx:for-index="(.*?)")?( wx:for-item="(.*?)")?( wx:key="{{?(.*?)?}}")?/g, function (match, tag, attrs, list, _, forIndex, __, forItem, ___, keyExpr) {
        var index = forIndex || 'index';
        var item = forItem || 'item';
        var key = keyExpr ? " :key=\"".concat(keyExpr, "\"") : '';
        // 把 wx:for 相关属性从原始属性中移除
        var cleanAttrs = attrs.replace(/ (wx:for(-index|-item|-key)?)="[^"]*"/g, '');
        return "<".concat(tag).concat(cleanAttrs, " v-for=\"(").concat(item, ", ").concat(index, ") in ").concat(list, "\"").concat(key);
    })
        // 处理 wx:if 在 block 上的情况（保留）
        .replace(/<block\s+wx:if="{{(.*?)}}"\s*>/g, '<template v-if="$1">')
        .replace(/<\/block>/g, '</template>')
        // 处理普通 wx:if（保留）
        .replace(/wx:if="{{(.*?)}}"/g, 'v-if="$1"')
        .replace(/wx:elif="{{(.*?)}}"/g, 'v-else-if="$1"')
        .replace(/wx:else/g, 'v-else')
        // 新增：清理残留的 wx: 属性（重要补充！）
        .replace(/ :?wx:(for|key|if|elif|else)/g, '');
    // 处理 <template v-for="(item, index) in XXX">，如果没有key则添加 :key="index"
    wxml = wxml.replace(/<template v-for="(.*?) in (.*?)"(.*?)>/g, function (m, item, list, rest) {
        // 检查是否已经存在 :key
        if (rest.includes(":key")) {
            // 如果已经存在 :key，则保持原样
            return m;
        }
        else {
            // 如果没有 :key，则添加 :key="index"
            return "<template v-for=\"".concat(item, " in ").concat(list, "\" :key=\"index\"").concat(rest, ">");
        }
    });
    //处理数据绑定（增强复杂表达式处理）
    wxml = wxml
        .replace(/(\S+?)="{{(.*?)}}"/g, function (_, name, value) {
        if (/(^v-|^:|class$|style$|^key$)/.test(name))
            return "".concat(name, "=\"").concat(value, "\"");
        ;
        // 处理字面量对象/数组
        if (/^(\[.*\]|\{.*\})$/.test(value)) {
            return ":".concat(name, "=\"").concat(value, "\"");
        }
        return ":".concat(name, "=\"").concat(value.replace(/"/g, "'"), "\"");
    });
    // 转换事件绑定（添加事件名映射）
    wxml = wxml
        .replace(/\bbind:([a-zA-Z0-9]+)/g, '@$1') // 处理 bind:tap、bind:change 这些事件
        .replace(/\bcatch:([a-zA-Z0-9]+)/g, '@$1.stop') // 处理 catch:xxx 事件，Vue 里用 .stop 修饰符
        .replace(/\bbind([a-zA-Z0-9]+)/g, '@$1'); // 处理 bindchild2parXxx 这种自定义事件
    // 处理样式和类绑定（优化动态类处理）
    wxml = convertDynamicClassToVue(wxml);
    wxml = convertDynamicStyleToVue(wxml);
    //单位转换（rpx转px）
    wxml = wxml.replace(/(\d+)rpx/g, function (_, num) { return "".concat(num / 2, "px"); }); // 假设2倍换算
    // 处理自闭合标签（扩展标签列表）
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
        .replace(/flex-(row|col)/g, 'flex $&');
    // 按顺序应用这些正则替换
    var replacements = [
        // 圆角半径转换（round-* → rounded-[*px]）
        { regex: /\bround-(\d+)\b/g, replacement: 'rounded-[$1px]' },
        // RGBA文字颜色（color-rgba-* → text-[rgba(*)]）
        {
            regex: /\bcolor-rgba-(\d+)-(\d+)-(\d+)-(\d+)\b/g,
            replacement: 'text-[rgba($1,$2,$3,0.$4)]'
        },
        // 十六进制颜色（color-FFF → text-[#FFF]）
        {
            regex: /\bcolor-([A-Fa-f0-9]{3,6})\b/g,
            replacement: 'text-[#$1]'
        },
        // 尺寸转换（w/h-数字 → w/h-[数字px]）
        {
            regex: /\b(w|h)-([1-9]\d*)\b/g,
            replacement: '$1-[$2px]'
        },
        // 边距/间距转换（m/p方向-数字 → m/p方向-[数字px]）
        {
            regex: /\b(m|p)(t|r|b|l|x|y)?-([1-9]\d*)\b/g,
            replacement: '$1$2-[$3px]'
        },
        // 字体大小（font-数字 → text-[数字px]）
        {
            regex: /\bfont-(\d+)\b/g,
            replacement: 'text-[$1px]'
        },
        // 边框宽度（border-1 → border，border-数字 → border-[数字px]）
        { regex: /\bborder-1\b/g, replacement: 'border' },
        {
            regex: /\bborder-([1-9]\d*)\b/g,
            replacement: 'border-[$1px]'
        },
        // RGBA边框颜色（border-rgba-* → border-[rgba(*)]）
        {
            regex: /\bborder-rgba-(\d+)-(\d+)-(\d+)-(\d+)\b/g,
            replacement: 'border-[rgba($1,$2,$3,0.$4)]'
        },
        // 间距（gap-数字 → gap-[数字px]）
        {
            regex: /\bgap-(\d+)\b/g,
            replacement: 'gap-[$1px]'
        },
        // zindex（z-数字 → z-[数字]）
        {
            regex: /\bz-(\d+)\b/g,
            replacement: 'z-[$1]'
        }, {
            regex: /\bh-min-full\b/g,
            replacement: ''
        }
    ];
    replacements.forEach(function (_a) {
        var regex = _a.regex, replacement = _a.replacement;
        wxml = wxml.replace(regex, replacement);
    });
    // 9. 处理特殊插值表达式（如url参数）
    wxml = wxml.replace(/="([^"]*)\{\{(.*?)\}\}([^"]*)"/g, function (_, prefix, exp, suffix) {
        return "=\"".concat(prefix, "${").concat(exp, "}").concat(suffix, "\"");
    });
    wxml = wxml.replace("color", "text");
    wxml = wxml.replace(/==/g, '===');
    // 替换 != 为 !==
    wxml = wxml.replace(/!=/g, '!==');
    return wxml;
}
exports.convertWXMLToVueTemplate = convertWXMLToVueTemplate;
