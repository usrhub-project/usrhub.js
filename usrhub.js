var Request = require('request');
let W3CWebSocket = require('websocket').w3cwebsocket
//var {Socket} = require('phoenix');
import { Socket } from 'phoenix'


var BASE_URL = "https://usrhub.com";

var _token = null;
var _account_id;

var _socket;
var _callbacks = {};
var _hub_channel;
const ANON_USER = () => {name: "ANON"}

const start = ({secret_key, user}) => {
  if(!secret_key) {
    throw new Error("Secret key is required in order to connect to usrhub.com")
  }

  user = user || ANON_USER
  _request("POST", "/api/auth", {secret_key})
    .then(data => {
      _token = data.token;
      _connectSocket();
    });
};


const _connectSocket = () => {
  let server = BASE_URL.replace("http", "ws")
  _socket = new Socket(server + "/socket", {transport: W3CWebSocket, params: {token: token, user: user}})
  _socket.connect()

  _socket.onError( (e) => {
    if (e.message == "received bad response code from server 403") {
      //dispatch("SIGNED_OUT")
    }
    console.log("there was an error with the connection!")
  })

  _socket.onClose( (e) => {
    console.log("the connection was dropped")
    if (_callbacks.disconnect) _callbacks.disconnect()
  })


  _hub_channel = _socket.channel("hub:1", {})
  _hub_channel.join()
    .receive("ok", resp => {
      console.log("Joined successfully", resp)
    })
    .receive("error", resp => { console.log("Unable to join", resp) })

  payload = {data: "Hello from React on thinkpad"}
  _hub_channel.push("shout", payload)

  _hub_channel.on("shout", payload => {
    console.log(payload)
  })
};

const join = (hub_name) => {
  _socket.join(hub_name)
}

const _request = (method, url, json) => {
  let uri = BASE_URL + url;

  let options = {method, uri, json};

  if (_token) {
    options.headers = {authtoken: _token};
  }

  return new Promise((done, reject) => {
    Request(options, (error, response, body) => {
      if (response.statusCode < 300) {
        done(body);
      }
      reject({error, response, body});
    });
  });
};

export default ({secret_key, usr, hub, func}) => {
  if(!secret_key) {
    throw new Error("Secret key is required")
  }
  //get application token by secret_key, get_user_id
  //join channel wwith app_id + hub_name

  const socket = new Socket("wss://usrhub.com/socket")
  let state = { x: 0, y: 0 }
  
  // configure the event handlers
  socket.onOpen(event => console.log('Connected.'))
  socket.onError(event => console.log('Cannot connect.'))
  socket.onClose(event => console.log('Goodbye.'))

  socket.connect()
  
  const chan = socket.channel(hub.name, { usr })

  // join the channel and listen for admittance
  chan.join()
    .receive('ignore', () => console.log('Access denied.'))
    .receive('ok', () => {
      console.log('Access granted.')
    }) //Get initial state?
    .receive('timeout', () => console.log('Must be a MongoDB.'))

  // add some channel-level event handlers
  chan.onError(event => console.log('Channel blew up.'))
  chan.onClose(event => console.log('Channel closed.'))

  const ping = (payload) => {
    chan.push('ping', {body: payload, usr}, 10000)
      .receive('ok', (msg) => {
        state = msg.body
        console.log(msg.body + ' from ' + msg.usr.name)
      })
      .receive('error', (reasons) => console.log('flop', reasons))
      .receive('timeout', () => console.log('slow much?'))
  }

  const test = () => {
    return state
  }
 
  const call = (lambda, payload) => {
    chan.push(lambda, payload)
      .receive('ok', (payload) => {
        state = payload
      })
      .receive('error', (reasons) => console.log('flop', reasons))
      .receive('timeout', () => console.log('slow much?'))
  }

  chan.on('shout', lambda => {
    func && func(lambda)
  })

  // a function to shut it all down
  const close = () => socket.disconnect()
 
  return { ping, close, test, call }
}

//module.exports =  { start, join }

