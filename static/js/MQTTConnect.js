export default {
  client: {},
  options: {
    host: '',
    port: 8083,
    username: '',
    isSSL: false,
    password: '',
    keepalive: 60,
    clean: true,
    clientId: '',
    subQos: 0,
    publishQos: 0,
    publishMessage: 'Hello world!',
    subTopic: '/World',
    publishTopic: '/World',
    publishRetain: false,
    receivedMessages: [],
    publishedMessages: [],
    subscriptions: [],
  },
}



// WEBPACK FOOTER //
// ./src/common/MQTTConnect.js