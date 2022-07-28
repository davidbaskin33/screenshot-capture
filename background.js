
// chrome.storage.sync.clear()

chrome.storage.sync.get((config) => {
  if (!config.method) {
    chrome.storage.sync.set({method: 'crop'})
  }
  if (!config.format) {
    chrome.storage.sync.set({format: 'png'})
  }
  if (!config.save) {
    chrome.storage.sync.set({save: 'file'})
  }
  if (config.dpr === undefined) {
    chrome.storage.sync.set({dpr: true})
  }
  // v1.9 -> v2.0
  if (config.save === 'clipboard') {
    config.save = 'url'
    chrome.storage.sync.set({save: 'url'})
  }
})

function inject (tab) {
  chrome.tabs.sendMessage(tab.id, {message: 'init'}, (res) => {
    if (res) {
      clearTimeout(timeout)
    }
  })

  var timeout = setTimeout(() => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {message: 'init'})
    }, 100)
  }, 100)
}

chrome.action.onClicked.addListener((tab) => {
  inject(tab)
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'take-screenshot') {
    chrome.tabs.query({ active: true }, (tab) => {
      inject(tab)
    })
  }
})

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'capture') {
    chrome.storage.sync.get((config) => {

      chrome.tabs.query({ active: true }, (tab) => {

        chrome.tabs.captureVisibleTab(tab.windowId, {format: config.format}, (image) => {
          // image is base64

          res({message: 'image', image: image})
        })
      })
    })
  }
  else if (req.message === 'active') {
    if (req.active) {
      chrome.storage.sync.get((config) => {
        if (config.method === 'view') {
          chrome.action.setTitle({tabId: sender.tab.id, title: 'Capture Viewport'})
          chrome.action.setBadgeText({tabId: sender.tab.id, text: '⬒'})
        }
        // else if (config.method === 'full') {
        //   chrome.action.setTitle({tabId: sender.tab.id, title: 'Capture Document'})
        //   chrome.action.setBadgeText({tabId: sender.tab.id, text: '⬛'})
        // }
        else if (config.method === 'crop') {
          chrome.action.setTitle({tabId: sender.tab.id, title: 'Crop and Save'})
          chrome.action.setBadgeText({tabId: sender.tab.id, text: '◩'})
        }
        else if (config.method === 'wait') {
          chrome.action.setTitle({tabId: sender.tab.id, title: 'Crop and Wait'})
          chrome.action.setBadgeText({tabId: sender.tab.id, text: '◪'})
        }
      })
    }
    else {
      chrome.action.setTitle({tabId: sender.tab.id, title: 'Screenshot Capture'})
      chrome.action.setBadgeText({tabId: sender.tab.id, text: ''})
    }
  }
  return true
})


