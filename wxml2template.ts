export function convertWXMLToVueTemplate(wxml: string) {
    // 1. 替换自定义组件（优化属性顺序无关匹配）
    wxml = wxml.replace(/<custom-image\s+([^>]*)\b(srcName)="([^"]+)"([^>]*)\b(customclass)="([^"]+)"([^>]*)>/gi,
        (_, prefix, srcKey, srcVal, mid, clsKey, clsVal, suffix) => {
            const dynamicSrc = srcVal.includes('{') ? `(${srcVal})` : `'${srcVal}'`;
            return `<image ${prefix}${mid}${suffix} :src="'/static/image/' + ${dynamicSrc} + '.png'" class="${clsVal}"/>`;
        })
        .replace(/<custom-image\s+([^>]*)\b(customclass)="([^"]+)"([^>]*)\b(srcName)="([^"]+)"([^>]*)>/gi,
            (_, prefix, clsKey, clsVal, mid, srcKey, srcVal, suffix) => {
                const dynamicSrc = srcVal.includes('{') ? `(${srcVal})` : `'${srcVal}'`;
                return `<image ${prefix}${mid}${suffix} :src="'/static/image/' + ${dynamicSrc} + '.png'" class="${clsVal}"/>`;
            });

    // 2. 转换条件渲染和循环（添加key处理）
    wxml = wxml
        // 处理 wx:for（替换 block）
        .replace(/<block\s+wx:for="{{(.*?)}}"\s*(wx:key=".*?")?>/g, (_, list, keyAttr) => {
            const key = keyAttr ? ` ${keyAttr.replace('wx:key', ':key')}` : '';
            return `<template v-for="(item, index) in ${list}"${key}>`;
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

    // 3. 处理数据绑定（增强复杂表达式处理）
    wxml = wxml
        .replace(/(\S+?)="{{{(.*?)}}}"/g, ':$1="$2"') // 处理 {{{}}} 语法
        .replace(/(\S+?)="{{(.*?)}}"/g, (_, name, value) => {
            // 处理字面量对象/数组
            if (/^(\[.*\]|\{.*\})$/.test(value)) {
                return `:${name}="${value}"`;
            }
            return `:${name}="${value.replace(/"/g, "'")}"`;
        });

    // 4. 转换事件绑定（添加事件名映射）
    wxml = wxml
        .replace(/\bbind:([a-zA-Z0-9]+)/g, '@$1')  // 处理 bind:tap、bind:change 这些事件
        .replace(/\bcatch:([a-zA-Z0-9]+)/g, '@$1.stop') // 处理 catch:xxx 事件，Vue 里用 .stop 修饰符
        .replace(/\bbind([a-zA-Z0-9]+)/g, '@$1'); // 处理 bindchild2parXxx 这种自定义事件

    // 5. 处理样式和类绑定（优化动态类处理）
    wxml = wxml
        .replace(/class="{{(.*?)}}"/g, (_, exp) => {
            // 处理三元表达式
            if (exp.includes('?')) {
                return `:class="${exp}"`;
            }
            // 处理普通表达式
            return `:class="${exp}"`;
        })
        .replace(/style="([^"]*)"/g, (_, content) => {
            if (content.includes('{{')) {
                const styleExpr = content.replace(/{{|}}/g, '')
                    .replace(/(\w+):/g, "'$1': ")
                    .replace(/;/g, ',');
                return `:style="{ ${styleExpr} }"`;
            }
            return `style="${content}"`;
        });

    // 6. 单位转换（rpx转px）
    wxml = wxml.replace(/(\d+)rpx/g, (_, num) => `${num * 2}px`); // 假设2倍换算

    // 7. 处理Vant组件
    wxml = wxml
        // .replace(/van-(\w+)/g, 'Van$1')
        .replace(/custom-class="(.*?)"/g, 'class="$1"')
    // .replace(/show="{{(.*?)}}"/g, (_, exp) => `v-show="${exp}"`);

    // 8. 处理自闭合标签（扩展标签列表）
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
        // 圆角半径转换（round-* → rounded-[*rpx]）
        { regex: /\bround-(\d+)\b/g, replacement: 'rounded-[$1rpx]' },

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

        // 尺寸转换（w/h-数字 → w/h-[数字rpx]）
        {
            regex: /\b(w|h)-([1-9]\d*)\b/g,
            replacement: '$1-[$2rpx]'
        },

        // 边距/间距转换（m/p方向-数字 → m/p方向-[数字rpx]）
        {
            regex: /\b(m|p)(t|r|b|l|x|y)?-([1-9]\d*)\b/g,
            replacement: '$1$2-[$3rpx]'
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
