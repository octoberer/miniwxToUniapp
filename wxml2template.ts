export function convertWXML(wxmlContent: string) {
    if (wxmlContent) {
        // 1. 转换所有数字类（如 h-10, w-20, m-15, font-8 等）为 TailwindCSS 自定义类并加 px 单位
        let convertedTemplate = wxmlContent.replace(/([a-zA-Z]+)-(\d+)/g, (match, p1, p2) => {
            if (p1.startsWith('font')) {
                return `text-[${p2}px]`;  // font-8 => text-[8px]
            }
            return `${p1}-[${p2}px]`;  // h-10 => h-[10px]
        });

        // 2. 检查并添加 flex 类到 flex-row 和 flex-col
        convertedTemplate = convertedTemplate.replace(/(flex-(row|col))/g, (match, p1) => {
            return `flex ${p1}`;  // flex-row 或 flex-col 转为 flex flex-row 或 flex flex-col
        });

        // 3. 转换事件绑定（bindtap, bindinput, bindchange 等）为 Vue 3 的事件语法
        convertedTemplate = convertedTemplate.replace(/bind([a-zA-Z]+)="([^"]+)"/g, (match, event, handler) => {
            const vueEvent = event === 'tap' ? 'click' :
                event === 'input' ? 'input' :
                    event === 'change' ? 'change' :
                        event === 'blur' ? 'blur' :
                            event === 'focus' ? 'focus' : event;
            return `@${vueEvent}="${handler}"`;
        });

        // 4. 转换插值语法（{{message}}）为 Vue 3 的插值语法
        convertedTemplate = convertedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, p1) => `{{ ${p1} }}`);

        // 5. 将 custom-image 组件替换为 <img> 标签，并处理 src 和 custom_class
        convertedTemplate = convertedTemplate.replace(/<custom-image\s+([^>]+)>/g, (match, attributes) => {
            // 处理 src
            attributes = attributes.replace(/src="([^"]+)"/g, (match, p1) => {
                return `src="/static/image/${p1.split('/').pop()}"`; // 保留文件名，添加 /static/image/
            });

            // 处理 custom_class
            attributes = attributes.replace(/custom_class="([^"]+)"/g, (match, p1) => {
                return `class="${p1}"`; // 转换为 class
            });

            return `<img ${attributes} />`;  // 转换为 <img> 标签
        });
        return convertedTemplate
    } else {
        alert('请输入 WXML 代码');
    }
}