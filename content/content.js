
let jcrop, selection;

const overlay = ((active) => (state) => {
  active = typeof state === 'boolean' ? state : state === null ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  chrome.runtime.sendMessage({message: 'active', active})
})(false)

const image = (done) => {
  const image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/images/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

const init = (done) => {
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      selection = e
      capture()
    },
    onChange: (e) => {
      selection = e
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null
      }, 100)
    }
  }, function ready () {
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: `url(${chrome.runtime.getURL('/images/Jcrop.gif')})`
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }

    done && done()
  })
}

const crop = (image, area, dpr, preserve, format, done) => {
  const top = area.y * dpr
  const left = area.x * dpr
  const width = area.w * dpr
  const height = area.h * dpr
  const w = (dpr !== 1 && preserve) ? width : area.w
  const h = (dpr !== 1 && preserve) ? height : area.h

  let canvas = null
  if (!canvas) {
    canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
  }
  canvas.width = w
  canvas.height = h

  const img = new Image()
  img.onload = () => {
    const context = canvas.getContext('2d')
    context.drawImage(img,
      left, top,
      width, height,
      0, 0,
      w, h
    )

    const cropped = canvas.toDataURL(`image/${format}`)
    done(cropped)
  }
  img.src = image
}

const capture = (force) => {
  chrome.storage.sync.get((config) => {
    if (selection && (config.method === 'crop' || (config.method === 'wait' && force))) {
      const area = selection;
      setTimeout(() => {
        chrome.runtime.sendMessage({
          message: 'capture', area: selection, dpr: devicePixelRatio
        }, (res) => {
          crop(res.image, area, devicePixelRatio, config.dpr, config.format, (cropped) => {
            overlay(false)
            selection = null
            save(cropped, config.format, config.save)
          })          
        })
      }, 50)
      jcrop.release()
    }
    else if (config.method === 'view') {
      chrome.runtime.sendMessage({
        message: 'capture',
        area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
      }, (res) => {
        if (devicePixelRatio !== 1 && !config.dpr) {
          crop(res.image, area, devicePixelRatio, config.dpr, config.format, (cropped) => {
            overlay(false)
            save(cropped, config.format, config.save)
          })
        }
        else {
          overlay(false)
          save(res.image, config.format, config.save)
        }
      })
    }
  })
}

const filename = (format) => {
  const pad = (n) => (n = n + '', n.length >= 2 ? n : `0${n}`)
  const ext = (format) => format === 'jpeg' ? 'jpg' : format === 'png' ? 'png' : 'png'
  const timestamp = (now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  return `Screenshot Capture - ${timestamp(new Date())}.${ext(format)}`
}

const save = (image, format, save) => {
  if (save === 'file') {
    const link = document.createElement('a')
    link.download = filename(format)
    link.href = image
    link.click()
  }
  else if (save === 'url') {
    navigator.clipboard.writeText(image).then(() => {
      alert([
        'Screenshot Capture:',
        'Data URL String',
        'Saved to Clipboard!'
      ].join('\n'))
    })
  }
  else if (save === 'binary') {
    const [header, base64] = image.split(',')
    const [_, type] = /data:(.*);base64/.exec(header)
    const binary = atob(base64)
    const array = Array.from({length: binary.length})
      .map((_, index) => binary.charCodeAt(index))
    navigator.clipboard.write([
      new ClipboardItem({
        // jpeg is not supported on write, though the encoding is preserved
        'image/png': new Blob([new Uint8Array(array)], {type: 'image/png'})
      })
    ]).then(() => {
      alert([
        'Screenshot Capture:',
        'Binary Image',
        'Saved to Clipboard!'
      ].join('\n'))
    })
  }
}

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'init') {
    res({}) // prevent re-injecting

    if (!jcrop) {
      image(() => init(() => {
        overlay()
        capture()
      }))
    }
    else {
      overlay()
      capture(true)
    }
  }
  return true
})
