
function convertDynamicClassToVue(wxml) {
    return wxml.replace(/class="([^"]*)"/g, (match, content) => {
        const staticClasses = [];
        const dynamicClasses = [];
        // 使用正则分割静态和动态部分
        const parts = content.split(/({{.*?}})/g);
        parts.forEach(part => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                const expr = part.slice(2, -2).trim();
                dynamicClasses.push(expr);
            } else if (part.trim()) {
                // 处理多个静态类名（可能有空格分隔）
                part.split(/\s+/).forEach(cls => {
                    if (cls) staticClasses.push(cls);
                });
            }
        });
        // 构建结果
        let result = '';
        if (staticClasses.length > 0) {
            result += `class="${staticClasses.join(' ')}"`;
        }
        if (dynamicClasses.length > 0) {
            // 动态部分转为数组语法
            result += `${result ? ' ' : ''}:class="[${dynamicClasses.join(', ')}]"`;
        }
        return result || 'class=""'; // 避免空属性
    });
}
function convertDynamicStyleToVue(wxml) {
    return wxml.replace(/style="([^"]*)"/g, (match, content) => {
        // 处理纯动态表达式（如 style="{{styleObj}}"）
        const fullDynamicMatch = content.match(/^{{\s*(.*?)\s*}}$/); // 允许空白字符
        if (fullDynamicMatch) {
            return `:style="${fullDynamicMatch[1].trim()}"`;
        }
        const styleProps = [];
        const declarations = content.split(';');
        declarations.forEach(decl => {
            decl = decl.trim();
            if (!decl) return;
            const [prop, value] = decl.split(':').map(s => s.trim());
            if (!prop || !value) return;

            // 转换属性名为驼峰式
            const vueProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            // 处理动态值
            let vueValue;
            if (/{{.*?}}/.test(value)) {
                // 替换 {{expr}} 为 ${expr}，并包裹模板字符串
                vueValue = `\`${value.replace(/{{(.*?)}}/g, (_, expr) => `\${${expr.trim()}}`)}\``;
            } else {
                vueValue = `'${value}'`; // 静态值
            }
            styleProps.push(`${vueProp}: ${vueValue}`);
        });

        return styleProps.length > 0
            ? `:style="{ ${styleProps.join(', ')} }"`
            : '';
    });
}

export function convertWXMLToVueTemplate(wxml: string) {

    //替换自定义组件（优化属性顺序无关匹配）
    wxml = wxml.replace(/<custom-image\s+([^>]*)\b(srcName)="([^"]+)"([^>]*)\b(customclass)="([^"]+)"([^>]*)>/gi,
        (_, prefix, srcKey, srcVal, mid, clsKey, clsVal, suffix) => {
            const dynamicSrc = srcVal.includes('{') ? `(${srcVal})` : `'${srcVal}'`;
            return `<image ${prefix.trim()}${mid.trim()}${suffix.trim()} :src="'/static/image/' + ${dynamicSrc} + '.png'" class="${clsVal}"/>`;
        })
        .replace(/<custom-image\s+([^>]*)\b(customclass)="([^"]+)"([^>]*)\b(srcName)="([^"]+)"([^>]*)>/gi,
            (_, prefix, clsKey, clsVal, mid, srcKey, srcVal, suffix) => {
                const dynamicSrc = srcVal.includes('{') ? `(${srcVal})` : `'${srcVal}'`;
                return `<image ${prefix.trim()}${mid.trim()}${suffix.trim()} :src="'/static/image/' + ${dynamicSrc} + '.png'" class="${clsVal}"/>`;
            });
    wxml = wxml.replace('</custom-image>', '')
    // 转换条件渲染和循环（修正版）
    wxml = wxml
        // 处理 <block wx:for> 转换为 <template v-for>（保留原有逻辑）
        .replace(/<block\s+wx:for="{{(.*?)}}"\s*(wx:for-index="(.*?)")?\s*(wx:for-item="(.*?)")?\s*(wx:key=".*?")?>/g, (_, list, ___, forIndex, __, forItem, keyAttr) => {
            const index = forIndex || 'index';
            const item = forItem || 'item';
            const key = keyAttr ? ` ${keyAttr.replace('wx:key', 'key')}` : '';
            return `<template v-for="(${item}, ${index}) in ${list}"${key}>`;
        })
        .replace(/<\/block>/g, '</template>')

        // 新增：处理普通元素上的 wx:for（重要修正！）
        .replace(/<(\w+)([^>]*) wx:for="{{(.*?)}}"( wx:for-index="(.*?)")?( wx:for-item="(.*?)")?( wx:key="{{?(.*?)?}}")?/g,
            (match, tag, attrs, list, _, forIndex, __, forItem, ___, keyExpr) => {
                const index = forIndex || 'index';
                const item = forItem || 'item';
                const key = keyExpr ? ` :key="${keyExpr}"` : '';
                // 把 wx:for 相关属性从原始属性中移除
                const cleanAttrs = attrs.replace(/ (wx:for(-index|-item|-key)?)="[^"]*"/g, '');
                return `<${tag}${cleanAttrs} v-for="(${item}, ${index}) in ${list}"${key}`;
            }
        )

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
    wxml = wxml.replace(/<template v-for="(.*?) in (.*?)"(.*?)>/g, (m, item, list, rest) => {
        // 检查是否已经存在 :key
        if (rest.includes(":key")) {
            // 如果已经存在 :key，则保持原样
            return m;
        } else {
            // 如果没有 :key，则添加 :key="index"
            return `<template v-for="${item} in ${list}" :key="index"${rest}>`;
        }
    });

    //处理数据绑定（增强复杂表达式处理）
    wxml = wxml
        .replace(/(\S+?)="{{(.*?)}}"/g, (_, name, value) => {
            if (/(^v-|^:|class$|style$|^key$)/.test(name)) return `${name}="${value}"`;;
            // 处理字面量对象/数组
            if (/^(\[.*\]|\{.*\})$/.test(value)) {
                return `:${name}="${value}"`;
            }
            return `:${name}="${value.replace(/"/g, "'")}"`;
        });


    // 转换事件绑定（添加事件名映射）
    wxml = wxml
        .replace(/\bbind:([a-zA-Z0-9]+)/g, '@$1')  // 处理 bind:tap、bind:change 这些事件
        .replace(/\bcatch:([a-zA-Z0-9]+)/g, '@$1.stop') // 处理 catch:xxx 事件，Vue 里用 .stop 修饰符
        .replace(/\bbind([a-zA-Z0-9]+)/g, '@$1'); // 处理 bindchild2parXxx 这种自定义事件

    // 处理样式和类绑定（优化动态类处理）
    wxml = convertDynamicClassToVue(wxml)
    wxml = convertDynamicStyleToVue(wxml)

    //单位转换（rpx转px）
    wxml = wxml.replace(/(\d+)rpx/g, (_, num) => `${num / 2}px`); // 假设2倍换算


    // 处理自闭合标签（扩展标签列表）
    const selfClosingTags = ['image', 'input', 'img'];
    wxml = wxml.replace(/<(\w+)([^>]*?)\s*\/?>/g, (m, tag, attrs) => {
        // 如果是自闭合标签，转换为 <tag ... />
        if (selfClosingTags.includes(tag)) {
            // 返回自闭合标签
            return `<${tag}${attrs} />`;
        }
        // 如果不是自闭合标签，保留原样
        return m;
    })
        // 删除结束标签
        .replace(/<\/(\w+)>/g, (m, tag) => {
            return selfClosingTags.includes(tag) ? '' : m; // 删除自闭合标签的结束部分
        });

    // 7. 其他样式处理
    wxml = wxml
        .replace(/flex-(row|col)/g, 'flex $&');
    // 按顺序应用这些正则替换
    const replacements = [
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
    replacements.forEach(({ regex, replacement }) => {
        wxml = wxml.replace(regex, replacement);
    });
    // 9. 处理特殊插值表达式（如url参数）
    wxml = wxml.replace(/="([^"]*)\{\{(.*?)\}\}([^"]*)"/g, (_, prefix, exp, suffix) => {
        return `="${prefix}\${${exp}}${suffix}"`;
    });
    wxml = wxml.replace("color", "text")
    wxml = wxml.replace(/==/g, '===');
    // 替换 != 为 !==
    wxml = wxml.replace(/!=/g, '!==');

    return wxml;
}
