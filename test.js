
const { convertWXMLToVueTemplate } = require("./wxml2template.js")
describe('convertWXMLToVueTemplate', () => {
    test('动态类转换', () => {
        const input = `<view class="header {{isActive ? 'active' : ''}} {{hasError ? 'error'}}"></view>`;
        const expected = `<view class="header" :class="[isActive ? 'active' : '', hasError ? 'error' ]"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('混合静态动态样式', () => {
        const input = `<view style="color: red; width: {{width}}rpx; height: {{height}}px;"></view>`;
        const expected = `<view :style="{ color: 'red', width: \`\${width}px\`, height: \`\${height}px\` }"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('纯动态样式对象', () => {
        const input = `<view style="{{styleObject}}"></view>`;
        const expected = `<view :style="styleObject"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('自定义组件转换', () => {
        const input = `<custom-image srcName="home" customclass="icon" />`;
        const expected = `<image :src="'/static/image/' + 'home' + '.png'" class="icon"/>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('带动态参数的组件', () => {
        const input = `<custom-image customclass="{{cls}}" srcName="{{img}}" />`;
        const expected = `<image :src="'/static/image/' + (img) + '.png'" class="cls"/>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('循环转换（block语法）', () => {
        const input = `<block wx:for="{{list}}" wx:key="id"><view>{{item.name}}</view></block>`;
        const expected = `<template v-for="(item, index) in list" :key="id"><view>{{item.name}}</view></template>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('普通元素循环', () => {
        const input = `<view wx:for="{{items}}" wx:for-item="product">{{product.id}}</view>`;
        const expected = `<view v-for="(product, index) in items">{{product.id}}</view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('条件渲染', () => {
        const input = `<view wx:if="{{show}}">内容</view><view wx:else>其他</view>`;
        const expected = `<view v-if="show">内容</view><view v-else>其他</view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('事件绑定转换', () => {
        const input = `<button bind:tap="handleTap" catch:submit="preventSubmit">按钮</button>`;
        const expected = `<button @tap="handleTap" @submit.stop="preventSubmit">按钮</button>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('复杂数据绑定', () => {
        const input = `<input value="{{value || 'default'}}" data-info="{{ {a:1} }}"/>`;
        const expected = `<input :value="value || 'default'" :data-info=" {a:1} "/>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('样式类名转换', () => {
        const input = `<view class="font-16 color-rgba-255-0-0-5 round-10"></view>`;
        const expected = `<view class="text-[16px] text-[rgba(255,0,0,0.5)] rounded-[10px]"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('rpx单位转换', () => {
        const input = `<view style="width: 200rpx; margin: 10rpx 20rpx;"></view>`;
        const expected = `<view :style="{ width: '100px', margin: '5px 10px' }"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('自闭合标签处理', () => {
        const input = `<image src="test.jpg"/><view></view>`;
        const expected = `<image src="test.jpg" /><view></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('运算符转换', () => {
        const input = `<view wx:if="{{a == 1}}"></view>`;
        const expected = `<view v-if="a === 1"></view>`;
        expect(convertWXMLToVueTemplate(input)).toBe(expected);
    });

    test('多根节点处理', () => {
        const input = `<view>1</view><view>2</view>`;
        const output = convertWXMLToVueTemplate(input);
        expect(output).toContain(`<view>1</view><view>2</view>`);
    });
});