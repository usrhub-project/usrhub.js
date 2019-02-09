import { Socket } from 'phoenix'

export default ({secret_key, usr, hub, func}) => {
  if(!secret_key) {
    throw new Error("Secret key is required")
  }
  //get application token by secret_key, get_user_id
  //join channel wwith app_id + hub_name

  const socket = new Socket("wss://usrhub.com/socket")
  let state = { count: 0 }
  
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
    chan.push('ping', {body: payload, usr}, 20000)
      .receive('ok', (msg) => {
        console.log(msg.body + ' from ' + msg.usr.name)
      })
      .receive('error', (reasons) => console.log('flop', reasons))
      .receive('timeout', () => console.log('slow much?'))
  }

  const dispatch = (lambda, payload) => {
    chan.push(lambda, payload)
      .receive('ok', (payload) => {
        state = payload
      })
      .receive('error', (reasons) => console.log('flop', reasons))
      .receive('timeout', () => console.log('slow much?'))
  }


  const on = (name, f) => {
    chan.on(name, lambda => {
      console.log("incomming lambda " + name)
      f && f(lambda)
    })
  }

  // a function to shut it all down
  const close = () => socket.disconnect()
 
  return { ping, close, state, dispatch, on }
}

const createStorage = () => {
  console.log("Creting store with hub ")

  let state = 0;


  return [state, null]
}

export const useHubState = createStorage();
export const trigger = (f) => makeTrigger(f); 
