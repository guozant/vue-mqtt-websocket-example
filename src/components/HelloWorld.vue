<template>
  <div class="websocket-view" style="text-align: left;">
    <div>
      <div>
        <label>host:</label>
        <input v-model="host">
      </div>
      <div>
        <label>port:</label>
        <input v-model.number="port">
      </div>
      <div>
        <label>clientID:</label>
        <input v-model="clientId">
      </div>
    </div>
    <br>
    <div>
      <button
        type="success"
        size="small"
        :icon="loading ? 'loading': 'check'"
        :disabled="loading || client.connected"
        :plain="true"
        @keyup.enter.native="mqttConnect"
        @click="mqttConnect">
        connect
      </button>
      <button
        class="close-btn"
        type="danger"
        icon="close"
        size="small"
        :plain="true"
        :loading="loading && client.connected"
        :disabled="!loading && !client.connected"
        @keyup.enter.native="disconnectSwitch"
        @click="disconnectSwitch">
       disconnect
      </button>
      <div class="connect-state">currentState:
        <span :style="client.connected ? 'color: #42d885' : ''">{{ getStatus }}</span>
      </div>
    </div>
    <br>

    <div>
      <label>topic:</label>
      <input v-model="subTopic">
      <label>qoS:</label>
      <select v-model.number="subQos">
        <option :value="0"></option>
        <option :value="1"></option>
        <option :value="2"></option>
      </select>
      <button
        type="success"
        icon="check"
        size="small"
        :plain="true"
        @keyup.enter.native="mqttSubscribe"
        @click="mqttSubscribe">
        subscribe
      </button>

    </div>
    <br>

    <div>发送：
      <label>topic:</label>
      <input v-model="publishTopic">
      <label>messages:</label>
      <input v-model="publishMessage">
      <label>qoS:</label>
      <select v-model.number="publishQos" style="display: block;">
        <option :value="0"></option>
        <option :value="1"></option>
        <option :value="2"></option>
      </select>
      <button
        type="success"
        icon="check"
        size="small"
        :plain="true"
        @click="mqttPublish"
        @keyup.enter.native="mqttPublish">
        send
      </button>
    </div>
    <br>

    <div>
      显示发送方信息：
      {{publishedMessages}}

    </div>
    <br>

    <div>
      显示接收方信息：
      {{receivedMessages}}

    </div>

  </div>
</template>


<script>
  /*
   * https://www.npmjs.com/package/mqtt
   * MQTT.js 2.13.0版本中
   * 连接中： 网络不可达时 ==> 尝试重连 ==> 触发 reconnect ==> 无限重连
   * 使用IP地址连接时： IP地址格式错误 ==> 未能捕捉到WS库的校验报错 ==> 不会触发任何事件 ==> 连接状态锁死
   *   以上两条 ==> 用户期望可以手动终止，客户端也应该超时终止
   * 发布时： 非法发布(非法主题) ==> 服务器断开连接 ==> 客户端触发 reconnect ==> 回调函数error值为空
   * 其中 Qos, Topic, Message等必须是Number, String/Buffer, String/Buffer ==> 防止因为ElementUI 下拉选择切换
   * 导致Qos变为String ==> 强制类型转换相关值后再发送 or 使用vue绑定修饰符
   * */
  import mqtt from 'mqtt'
  import MQTTConnect from '../../static/js/MQTTConnect'
  import { Toast } from 'mint-ui'

  export default {
    data () {
      return {
        retryTimes: 0,
        loading: false,
        sending: false,
        host: window.location.hostname,
        port: 8083,
        username: '',
        isSSL: false,
        password: '',
        keepalive: 60,
        clean: true,
        clientId: `mqttjs_${Math.random().toString(16).substr(2, 10)}`,
        subQos: 0,
        publishQos: 0,
        publishMessage: 'Hello world!',
        subTopic: '/World',
        publishTopic: '/World',
        publishRetain: false,
        receivedMessages: [],
        publishedMessages: [],
        subscriptions: [],
        client: {}
      }
    },
    computed: {
      getStatus () {
        if (this.client.connected) {
          return 'connected'
        }
        if (this.loading) {
          return 'connecting'
        }
        return 'disconnected'
      },
      supportWebSocket () {
        return window.WebSocket
      }
    },
    methods: {
      now () {
        // return dateformat(new Date(), 'yyyy-mm-dd hh:MM:ss')
      },
      handleSSL () {
        this.port = this.isSSL ? 8084 : 8083
      },
      disconnectSwitch () {
        // connecting
        if (this.loading && !this.client.connected) {
          this.loading = false
          this.client.end()
          this.client = {}
        } else {
          this.mqttDisconnect()
        }
      },
      mqttConnect () {
        if (!this.supportWebSocket) {
          Toast({
            message: 'notSupport',
            duration: 2000
          })
          return
        }
        // prevent the connect from keyboard event
        if (this.client.connected || this.loading) {
          return
        }
        this.loading = true
        this.retryTimes = 0
        const options = {
          keepalive: this.keepalive,
          username: this.username,
          password: this.password,
          clientId: this.clientId,
          clean: this.clean,
          connectTimeout: 4000
        }
        const protocol = this.isSSL ? 'wss' : 'ws'
        this.client = mqtt.connect(`${protocol}://${this.host}:${this.port}/mqtt`, options)
        this.client.on('connect', () => {
          this.loading = false
        })
        this.client.on('reconnect', () => {
          if (this.retryTimes > 1) {
            if (this.sending) {
              Toast({
                message: 'connectError',
                duration: 2000
              })
            } else {
              Toast({
                message: 'connectFailure',
                duration: 2000
              })
            }
            this.retryTimes = 0
            this.sending = false
            this.loading = false
            this.client.end()
            this.client = {}
          }
          // trigger by sending illegal topic
          if (this.sending) {
            Toast({
              message: 'connectError',
              duration: 2000
            })
          }
          this.retryTimes += 1
        })
        this.client.on('error', (error) => {
          Toast({
            message: error,
            duration: 2000
          })
          // to prevent reconnect
          this.retryTimes = 0
        })
        this.client.on('message', (topic, message, packet) => {
          this.receivedMessages.unshift({
            topic,
            message: message.toString(),
            qos: packet.qos,
            time: this.now()
          })
        })
      },
      mqttDisconnect () {
        if (this.client.connected) {
          this.client.end()
          this.client.on('close', () => {
            this.loading = false
            this.reset()
            this.client = {}
          })
        } else {
          Toast({
            message: 'connectLeave',
            duration: 2000
          })
        }
      },
      mqttSubscribe () {
        if (this.client.connected) {
          this.subscriptions.forEach((x, index) => {
            if (x.topic === this.subTopic) {
              this.subscriptions.splice(index, index + 1)
            }
          })
          this.client.subscribe(this.subTopic,
            { qos: this.subQos },
            (error) => {
              if (error) {
                Toast({
                  message: 'error',
                  duration: 2000
                })
              } else {
                this.subscriptions.unshift({
                  topic: this.subTopic,
                  qos: this.subQos,
                  time: this.now()
                })
                Toast({
                  message: 'subscribeSuccess',
                  duration: 2000
                })
              }
            })
        } else {
          Toast({
            message: 'connectLeave',
            duration: 2000
          })
        }
      },
      mqttPublish () {
        if (this.client.connected) {
          const options = { qos: this.publishQos,
            retain: this.publishRetain }
          // to mark which trigger the reconnect
          this.sending = true
          this.client.publish(this.publishTopic,
            this.publishMessage, options, (error) => {
              if (error) {
                Toast({
                  message: 'error',
                  duration: 2000
                })
              } else {
                this.publishedMessages.unshift({
                  message: this.publishMessage,
                  topic: this.publishTopic,
                  qos: this.publishQos,
                  time: this.now()
                })
                Toast({
                  message: 'messageSendOut',
                  duration: 2000
                })
              }
            })
        } else {
          Toast({
            message: 'connectLeave',
            duration: 2000
          })
        }
      },
      mqttCacheScuscribe (topic) {
        if (!this.client.connected) {
          Toast({
            message: 'connectLeave',
            duration: 2000
          })
          return
        }
        this.client.unsubscribe(topic, (error) => {
          if (error) {
            Toast({
              message: 'unsubscribeFailure',
              duration: 2000
            })
            return
          }
          this.subscriptions.forEach((element, index) => {
            if (element.topic === topic) {
              this.subscriptions.splice(index, 1)
              // clear message which in this topic
            }
          })
        })
      },
      reset () {
        this.subscriptions = []
        this.receivedMessages = []
        this.publishedMessages = []
        this.publishMessage = 'Hello world!'
        this.subTopic = '/World'
        this.publishTopic = '/World'
      },
      clearMessage (received = true) {
        if (received) {
          this.receivedMessages = []
        } else {
          this.publishedMessages = []
        }
      },
      loadConnect () {
        if (MQTTConnect.client && MQTTConnect.client.connected) {
          this.client = MQTTConnect.client
          Object.keys(MQTTConnect.options).forEach((item) => {
            this[item] = MQTTConnect.options[item]
          })
        }
      },
      stashConnect () {
        MQTTConnect.client = this.client
        Object.keys(MQTTConnect.options).forEach((item) => {
          MQTTConnect.options[item] = this[item]
        })
      }
    },
    created () {
      this.loadConnect()
    },
    beforeRouteLeave (to, from, next) {
      if (this.client.connected) {
        this.stashConnect()
      }
      next()
    }
  }
</script>

<style>
  .websocket-view {
  .el-select {
    width: 100%;
  }
  .refresh-btn {
    font-size: 12px;
    margin-left: 8px;
    cursor: pointer;
  }
  .connect-state {
    display: inline-block;
  }
  .el-table {
    margin-top: 5px;
    /* 增加内边距 */
    border-width: 0 !important;
  }
  .el-card {
    margin-top: 24px;
  }
  .el-input,
  .el-checkbox {
    margin: 5px 0 20px;
  }
  .el-button {
    display: inline-block;
    width: 100px;
  &.unsubscribe {
     width: auto;
   }
  }
  }

</style>
