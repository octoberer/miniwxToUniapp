import { generateMethods } from "./transform/method";
import { generateComputed } from "./transform/computed";
import { transformDestructureToAssignment } from "./transform/destructure";
import { applyFinalReplacements } from "./transform/finalRegexReplacement";
import { generateLifecycle } from "./transform/lifecircle";
import { transformNet } from "./transform/net";
import { parseWechatData } from "./transform/reactive";
import { generatePiniaCode } from "./transform/store";
import { generateWatchers } from "./transform/watch";
import { removeComponentAndImports } from "./transform/extractOtherStringsWithAST";
export function transformWxTsToVue3Setup(inputCode: string) {
  let transformedCode = transformDestructureToAssignment(inputCode);
  transformedCode = transformNet(transformedCode);
  const { resultCode: piniaStoreCode, store_fields } = generatePiniaCode(transformedCode);
  const { reactiveData, lifecycle, computed, watchers, methods } =
    parseWechatData(transformedCode, store_fields);
  const computedPropertiesCode = generateComputed(computed);
  const watchersCode = generateWatchers(watchers);
  const lifecycleHooksCode = generateLifecycle(lifecycle);
  const methodsCode = generateMethods(methods);
  debugger
  const otherString = removeComponentAndImports(inputCode)
  const combinedCode = `
    ${piniaStoreCode}
    ${reactiveData}
    ${computedPropertiesCode}
    ${watchersCode}
    ${methodsCode}
    ${lifecycleHooksCode ? lifecycleHooksCode : ''}
    
  `;
  const outputVueCode = applyFinalReplacements(combinedCode.replace(/wx\./g, "uni."));
  return { outputVueCode, otherString };
}
// console.log(transformWxTsToVue3Setup(`
// // components/common/custom-date-picker/custom-date-picker.ts
// Page({
  
// })
// `))

// const a = convertWXMLToVueTemplate(`<view class="flex-row justify-between">
//   <view class="w-339 round-40 flex-row color-darkText bg-backgroundGray px-15 gap-10 py-12 items-center">
//     <custom-image srcName="icon_notice" customclass="w-17 h-17" />
//     <custom-scroll-message parMessages="{{[1,2,3,4]}}" pageShowFlag="{{pageShowFlag}}"></custom-scroll-message>
//   </view>
// </view>
// <view class="mt-20 flex-row justify-between items-center">
//   <view class="flex items-center gap-5">
//     <text class="font-20 font-machineType color-disabledBlack leading-none" style="line-height: 0.8;">{{singleMachineBaseInfo.machineType}}</text>
//     <view class="font-17 font-semibold color-darkText leading-none">{{singleMachineBaseInfo.machineName}}</view>
//   </view>
//   <custom-navigator customclass="relative" url="/pages/index/maintenance-pending-tasks/maintenance-pending-tasks?machineId={{currentMachineId}}">
//     <custom-image srcName="button_notice" customclass="w-30 h-30" />
//     <block wx:if="{{maintenanceOrderNumber>0}}">
//       <text class="badge">{{maintenanceOrderNumber>99?'99+':maintenanceOrderNumber}}</text>
//     </block>
//   </custom-navigator>
// </view>
// <view class="mt-15 relative h-330 mx-_18">
//   <block wx:if="{{!deviceInforshow}}">
//     <view class="{{deviceMoving?'hidden':''}}">
//       <view class="w-full h-280 round-8 absolute ">
//         <battery-gauge-canvas />
//       </view>
//       <view class="w-full absolute top-0 left-0">
//         <image src="http://192.168.2.119:3000/public/system/img/小铁.png" class="w-320 h-182 absolute left-center top-140" style="z-index: 100;"></image>
//       </view>
//       <view class="w-320 h-100 absolute bottom-0 left-center" style="border-radius:100%;background: linear-gradient(180deg, #F9FCFF 17.65%, #DBEAF9 100%);"></view>
//     </view>
//     <view class="{{deviceMoving?'':'hidden'}} w-full h-full">
//       <custom-device-model bindgetFinishLoad="getFinishLoad" percent="{{percent}}"></custom-device-model>
//     </view>
//   </block>
//   <van-transition show="{{ deviceInforshow }}" custom-class="block">
//     <view class="py-28 pl-20">
//       <view class="gap-5 flex-col">
//         <view class="flex-row gap-7 items-center">
//           <custom-image srcName="njxz_electricity" customclass="w-16 h-16" mode="" />
//           <view class="progress-bar-wrapper">
//             <custom-image srcName="powerdata" customclass="w-75 h-15" mode="" />
//             <view class="progress-bar"></view>
//           </view>
//           <view class="font-12 font-bold color-darkText">{{timelyData.machineResidualElectricity}}</view>
//         </view>
//         <text class="font-12 color-darkText font-bold">电量</text>
//       </view>
//       <view class="mt-10 flex-col gap-10">
//         <block wx:for="{{[{name:'行进速度',value:timelyData.operationRecordsMowingRate||'-',unit:'m/s'},{name:'割草效率',value:timelyData.operationRecordsMowingEfficiency||'-',unit:'亩/h'},{name:'割草高度',value:timelyData.operationRecordsMowingHigh||'-',unit:'cm'}]}}">
//           <view class="gap-8 flex-col">
//             <text class="font-12 color-grayText">{{item.name}}</text>
//             <view class="flex-row gap-10 items-center">
//               <text class="font-20 font-semibold color-darkText">{{item.value}}</text>
//               <text class="font-12 color-darkText">{{item.unit}}</text>
//             </view>
//           </view>
//         </block>
//       </view>
//     </view>
//   </van-transition>
// </view>
// <view class="mt-30 ">
//   <Slide-unlock-button bindchild2parProgress="getProgress" bindchild2parIconSrc="getIconSrc"></Slide-unlock-button>
// </view>
// <view wx:if="{{!deviceInforshow}}" class="mt-15 round-8">
//   <view class="pt-25 bg-rgba-255-255-255-6 round-8 relative w-339" style="box-shadow: 2px 3px 8px 0px #E7E7E7;">
//     <view class="flex-row justify-center gap-38 ">
//       <block wx:for="{{infor}}">
//         <view class="flex-col items-start gap-6" style="min-width: 120rpx;">
//           <text class="font-12 color-grayText">{{item.name}}</text>
//           <view class="flex-row justify-end items-center gap-8"><text class="font-20 color-darkText">{{item.value||0}}</text><text class="font-10 color-darkText">{{item.unit}}</text>
//           </view>
//         </view>
//       </block>
//     </view>
//     <view class="absolute bottom-52 h-1 left-0 w-full bg-separatorBlack10 lineYhalf"></view>
//     <view class="mt-32 pb-15">
//       <view class="flex-row justify-between items-center px-46">
//         <scan-device-wrapper>
//           <view class="flex-row items-center gap-10">
//             <custom-image customclass="w-22 h-22" srcName="rygl_add-car" />
//             <text class="font-14 font-normal color-darkText">{{'新增设备'}}</text>
//           </view>
//         </scan-device-wrapper>
//         <view class="w-1 bg-separatorBlack10 h-20 lineXhalf" />
//         <custom-navigator customclass="flex-row items-center gap-10" url='/operate-device/pages/single-operate-record/single-operate-record?machineId={{currentMachineId}}'>
//           <custom-image customclass="w-22 h-22" srcName="njxz_record" />
//           <text class="font-14 font-normal color-darkText leading-none">作业记录</text>
//         </custom-navigator>
//       </view>
//     </view>
//   </view>
// </view>
// <view class="mt-20 round-8" wx:else>
//   <view class="map-cloak-wrapper">
//     <map style="width: 100%;height: 300rpx; border-radius: 16rpx;" id="myMap" latitude="{{latitude}}" longitude="{{longitude}}" scale="15" markers="{{markers}}" polyline="{{polyline}}" include-points="{{points}}" bindregionchange="regionChange">
//       <custom-navigator url="/operate-device/pages/manipulate_device/manipulate_device">
//         <view class="flex-row justify-end gap-5 items-center pt-12 mr-9">
//           <custom-image srcName="njxz_operation" customclass="w-20 h-20" />
//           <view class="color-grayText font-12">操作农机</view>
//           <custom-image srcName="right-arrow" customclass="w-15 h-15" />
//         </view>
//       </custom-navigator>
//     </map>
//     <view class="map-cloak">
//       <block wx:for="{{deviceOperateInfor}}">
//         <view class="item" wx:if="{{item.name}}">
//           <text class="name color-grayText">{{item.name}}</text>
//           <text class="font-25 font-semibold color-darkText">{{item.value}}</text>
//         </view>
//         <view class="item" wx:else>
//           <view class="line"></view>
//         </view>
//       </block>
//     </view>
//   </view>
// </view>
// <van-popup show="{{ realShareBoardShow }}" custom-style="background:transparent">
//   <view class="pt-20">
//     <view class="flex-col justify-between gap-40 items-center">
//       <view class="w-290 round-8 bg-FFF px-25 pt-30 relative">
//         <image src="/assets/image/pic_share_star.png" class="w-147 h-147 absolute right-_20 top-_40"></image>
//         <text class="font-17 font-bold color-000">恭喜您完成一次作业</text>
//         <view class="mt-8 py-7 w-90 bg-FFEEC1 color-F7650D flex justify-center items-center round-40"><text>积分+10</text></view>
//         <view class="mt-15 w-full" style="box-shadow: 2px 3px 8px 0px #F1F1F1;">
//           <image class="w-240 h-120 round-4" src="https://img.yzcdn.cn/vant/cat.jpeg"></image>
//           <view style="border-radius: 20rpx 20rpx 8rpx 8rpx;" class="h-60 bg-FFF px-14 py-12 justify-between flex">
//             <block wx:for="{{oneRecordInfor}}">
//               <view class="flex-col items-center justify-between items-center">
//                 <text class="color-grayText font-10">{{item.name}}</text>
//                 <view class="flex gap-3 items-center">
//                   <text class="font-12 font-bold">{{item.value}}</text>
//                   <text class="font-10 color-darkText">{{item.unit}}</text>
//                 </view>
//               </view>
//             </block>
//           </view>
//         </view>
//         <view class="mt-25 flex gap-10 h-43 mb-20">
//           <custom-navigator class="flex round-4 w-87 items-center justify-center color-darkText border" url="/pages/index/operation-record-detail/operation-record-detail?operationRecordsRecordsId={{operationRecordsRecordsId}}">详情</custom-navigator>
//           <button class="flex round-4 font-14 font-semibold  flex-1 items-center justify-center color-FFF bg-darkText" open-type="share">分享赢积分</button>
//         </view>
//       </view>
//       <custom-image customclass="w-30 h-30" srcName="icon_close_white" bind:tap="hiddenShareBoardPopup" />
//     </view>
//   </view>
// </van-popup>

// <!-- <block wx:if="{{deviceInforshow}}">
//   <view style="transform:translateY(-{{270*2}}rpx);">
//     <image src="/assets/image/pic_devicemodel.png" class="w-235 h-270 absolute right-12 bottom-_270" />
//   </view>
// </block> -->`)
// console.log(a)
// console.log(a)
// 1. 转变计算属性
// 2. 转变watch写法
// 2. 转变状态变量
// 3. 转变方法定义
// 4. 转变网络请求方法
// 5. 转变store状态管理
// 6. 转变this.setData
// 7. 转变微信下程序独有的wx.showToast
// 8. 转变生命周期
// 删除const {XXX}=this.data
// 删除this.Xxxx方法
// 删除const {XXX}=….store
// 删除YYYStore.store.XXX的前缀YYYStore.store.