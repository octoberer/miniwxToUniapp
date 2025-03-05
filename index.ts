import { transformWxTsToVue3Setup } from "./ts2script";

debugger
transformWxTsToVue3Setup(`
   import IndexStore from "../../../store/index";
import { ComponentWithStore } from "mobx-miniprogram-bindings";
import { query } from "../../../net/graphql/request";
import { getUserBriefInfo } from "../../../net/graphql/index/query";
import maintainPendingListStore from "../../../store/maintainPendingList";
import { addWsBindFunc } from "../../../net/websocket/websocket";
import { getWebsocketData } from "../../../store/websocket";
import { addUserCredit } from "../../../net/graphql/common/query";
import { isRightResponse } from "../../../utils/util";
import { machineBaseInfoType, machineBriefInfoType } from "../../../store/machineType";

ComponentWithStore({
  storeBindings: [{
    store: IndexStore.store,
    fields: ["machineBaseList", 'machineBriefInfoList', "needUpdateMachineFlag"],
    actions: []
  }, {
    store: maintainPendingListStore.store,
    fields: ["needUpdateMaintainPendingFlag", "needUpdateMaintainFinishedFlag"],
    actions: []
  }],
  properties: {
    // 多设备跳转到某个设备的传值
    machineId: {
      type: String
    },
    // 表示该组件是被哪个页面引用的 operate-device-page|home-page
    type: {
      type: String
    },
  },
  data: {
    deviceInforshow: false,
    shareBoardShow: false,
    percent: 0,
    operationALLEfficiency: '-',
    oneRecordInfor: [{ name: '时长', value: '2h30min', unit: '' },
    { name: '面积', value: 100 || '0', unit: '亩' },
    { name: '耗电量', value: 2, unit: '度' },
    { name: '自动回正', value: 3, unit: '次' }],
    isFirstPercent: true,
    trackArr: [],
    modelLoading: true,
    hasOpened: false,
    currentMachineId: undefined as string | undefined,
    singleMachineBriefInfo: undefined as machineBriefInfoType | undefined
  },
  observers: {
    percent(percent: number) {
      this.setData({
        deviceInforshow: percent == 100,
        shareBoardShow: percent === 0 && this.data.hasOpened,
      })
      if (percent === 100 && this.data.isFirstPercent) {
        this.data.isFirstPercent = false
        let count = -1
        // const timelyData = getWebsocketData("realTimeDataOfWork")
        // this.data.trackArr = []
        // let id = setInterval(() => {
        //   if (count == 9) {
        //     clearInterval(id)
        //   }
        //   count++
        //   const temp = timelyData[count]
        //   console.log('timelyData', temp)
        //   if (temp) {
        //     this.setData({ timelyData: temp, trackArr: [...this.data.trackArr, temp.operationRecordsTrackMap] })
        //   }
        // }, 1000)
      }
      else if (percent < 100) {
        this.data.isFirstPercent = true
      }
    },
    "singleMachineBriefInfo,operationALLEfficiency": function (singleMachineBriefInfo, operationALLEfficiency) {
      const { assistantSum, operationALLArea = 0, maintenanceOrderNumber } = singleMachineBriefInfo || {}
      this.setData({
        infor: [{ name: '协作者', value: assistantSum || '0', unit: '位' },
        { name: '平均效率', value: operationALLEfficiency || '-', unit: '亩/h' },
        { name: '累计面积', value: operationALLArea || '0', unit: '亩' }],
        maintenanceOrderNumber
      })
    },
    // 持续作业的动态数据
    timelyData(timelyData) {
      const { operationRecordsUsedOil, operationArea, operationRecordsAutoRectifyTime } = timelyData || {}
      this.setData({
        deviceOperateInfor: [{ name: '作业面积(m³)', value: operationArea || '0' }, {}, { name: '作业效率(亩/h)', value: operationRecordsUsedOil || 0 }, {}, { name: '自动回正(次)', value: operationRecordsAutoRectifyTime || 0 }]
      })
    },
    trackArr(trackArr) {
      console.log('trackArr', trackArr)
      let trackData = trackArr
      const points = trackData.map(item => ({
        latitude: item[0],
        longitude: item[1],
      }))
      let markers = points.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
        width: 15, height: 15,
        iconPath: '/assets/image/pic_location_circle.png'
      }));

      let polyline = [{
        points, // 轨迹线由多个点组成
        color: "#000000", // 轨迹线颜色
        width: 2, // 轨迹线宽度
      }];
      this.setData({
        markers: markers,
        polyline: polyline,
        latitude: trackArr[0][0],
        longitude: trackArr[0][1],
        points: points
      });
    },
    shareBoardShow(shareBoardShow) {
      // 结束一次记录加十分积分
      if (shareBoardShow) {
        addUserCreditFunc(1).then(() => {
          this.setData({
            realShareBoardShow: true
          })
        })
      }
    },
  },
  methods: {
    getProgress({ detail }: CustomEvent) {
      const { percent, hasOpened } = detail
      this.data.hasOpened = hasOpened
      this.setData({
        percent
      })
    },
    getIconSrc({ detail }: CustomEvent) {
      const { iconSrc } = detail
      if (iconSrc === 'homepage_lock_large') {
        this.setData({
          deviceMoving: true
        })
      }
      else if (iconSrc === 'homepage_unlock_large') {
        this.setData({
          deviceMoving: false
        })
      }
    },
    hiddenShareBoardPopup() {
      this.setData({ realShareBoardShow: false })
    },
    getFinishLoad() {
      console.log('getFinishLoad')
    },
    updateOneDeviceInfor(machineBaseList: machineBaseInfoType[], machineBriefInfoList: machineBriefInfoType[], machineId: string) {
      let uniqueMachineId = machineId
      if ((this.data.type == "operate-device-page" && uniqueMachineId)) {
        // 通过id找到该条数据
        const singleMachineBaseInfo = (machineBaseList || []).filter(({ machineId }: { machineId: string }) => machineId === uniqueMachineId)[0]
        const { operationALLEfficiency } = (machineBriefInfoList || []).filter(({ machineId }) => machineId === uniqueMachineId)[0] || {}
        this.getSingleDeviceInfor({ singleMachineBaseInfo, operationALLEfficiency, uniqueMachineId })
      }
      else if (this.data.type == "home-page" && machineBaseList && machineBaseList.length > 0) {
        if (!uniqueMachineId) {
          uniqueMachineId = machineBaseList[0].machineId
        }
        const singleMachineBaseInfo = machineBaseList[0]
        console.log('singleMachineBaseInfo', singleMachineBaseInfo)
        const { operationALLEfficiency } = machineBriefInfoList[0]
        this.getSingleDeviceInfor({ singleMachineBaseInfo, operationALLEfficiency, uniqueMachineId })
      }
    },
    getSingleDeviceInfor({ singleMachineBaseInfo, operationALLEfficiency, uniqueMachineId }: {
      singleMachineBaseInfo: machineBaseInfoType,
      operationALLEfficiency: string,
      uniqueMachineId: string
    }) {
      this.setData({
        singleMachineBaseInfo,
        operationALLEfficiency,
        currentMachineId: uniqueMachineId
      })
      query(getUserBriefInfo(uniqueMachineId), ({ userBriefInfo }) => {
        const { userBriefInfo: singleMachineBriefInfo } = userBriefInfo
        this.setData({
          singleMachineBriefInfo
        })
      })
    },
  },
  pageLifetimes: {
    show() {
      console.log('show')
      const { machineId } = this.data
      const { machineBaseList, machineBriefInfoList } = IndexStore.store
      this.updateOneDeviceInfor(machineBaseList, machineBriefInfoList, machineId)
    }
  },
  lifetimes: {
    attached() {
      console.log('attached')
      const { machineId } = this.data
      const { machineBaseList, machineBriefInfoList } = IndexStore.store
      this.updateOneDeviceInfor(machineBaseList, machineBriefInfoList, machineId)
    }
  }
})
export function addUserCreditFunc(type: 1 | 2) {
  return new Promise((resolve, reject) => {
    query(addUserCredit(type), ({ addUserCredit }) => {
      const { code, message } = addUserCredit
      if (isRightResponse(code)) {
        resolve(message)
      }
      else {
        // wx.showToast({ title: message, icon: 'none' })
        reject(message)
      }
    })
  })
}

  `);
// transformWxTsToVue3Setup(`Component({data:{singleMachineBaseInfo:{}},getSingleDeviceInfor({ singleMachineBaseInfo, operationALLEfficiency, uniqueMachineId }: {
//       singleMachineBaseInfo: machineBaseInfoType,
//       operationALLEfficiency: string,
//       uniqueMachineId: string
//     }) {
     
// }})`)