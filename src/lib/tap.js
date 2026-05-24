// src/lib/tap.js
import jsQR from 'jsqr'   // ← proper npm import, works in production

// ─── CAPABILITY DETECTION ─────────────────────────────────────
export const getTapCapability = () => {
  const hasNFC = 'NDEFReader' in window
  const hasCamera = !!(navigator.mediaDevices?.getUserMedia)
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
  const isAndroid = /android/i.test(navigator.userAgent)
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent)

  // NFC only works: Android + Chrome + HTTPS
  const nfcAvailable = hasNFC && isSecure && isAndroid && isChrome

  return {
    nfc: nfcAvailable,
    qr: hasCamera,
    code: true,
    isSecure,
    isAndroid,
    isChrome,
    recommended: nfcAvailable ? 'nfc' : hasCamera ? 'qr' : 'code'
  }
}

// ─── NFC SENDER ───────────────────────────────────────────────
export class NFCSender {
  constructor() {
    this.abortController = null
  }

  async writeCode(code) {
    if (!('NDEFReader' in window)) throw new Error('NFC not supported on this device/browser')
    this.abortController = new AbortController()
    const ndef = new window.NDEFReader()
    await ndef.write({
      records: [{
        recordType: 'url',
        data: `${window.location.origin}/join/${code}`
      }]
    }, { signal: this.abortController.signal })
    return true
  }

  cancel() {
    this.abortController?.abort()
  }
}

// ─── NFC RECEIVER ─────────────────────────────────────────────
export class NFCReceiver {
  constructor() {
    this.abortController = null
  }

  async startScan(onCodeReceived) {
    if (!('NDEFReader' in window)) throw new Error('NFC not supported on this device/browser')
    this.abortController = new AbortController()
    const ndef = new window.NDEFReader()
    await ndef.scan({ signal: this.abortController.signal })

    ndef.addEventListener('reading', ({ message }) => {
      for (const record of message.records) {
        if (record.recordType === 'url') {
          const url = new TextDecoder().decode(record.data)
          const match = url.match(/\/join\/(\d{6})/)
          if (match) {
            onCodeReceived(match[1])
            this.cancel()
          }
        }
      }
    })
  }

  cancel() {
    this.abortController?.abort()
  }
}

// ─── QR SCANNER ───────────────────────────────────────────────
export class QRScanner {
  constructor(videoElement, canvasElement) {
    this.video = videoElement
    this.canvas = canvasElement
    this.stream = null
    this.animFrame = null
    this.active = false
  }

  async start(onCodeFound) {
    try {
      // Request back camera first (environment), fall back to any
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      this.video.srcObject = this.stream
      await this.video.play()
      this.active = true

      const scan = () => {
        if (!this.active) return

        if (this.video.readyState >= this.video.HAVE_ENOUGH_DATA
          && this.video.videoWidth > 0) {
          const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
          this.canvas.width = this.video.videoWidth
          this.canvas.height = this.video.videoHeight
          ctx.drawImage(this.video, 0, 0)

          const imageData = ctx.getImageData(
            0, 0, this.canvas.width, this.canvas.height
          )

          // jsQR imported from npm — works in production
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          })

          if (code?.data) {
            // Handle both full URL and raw 6-digit code
            const match = code.data.match(/(\d{6})/)
            if (match) {
              onCodeFound(match[1])
              this.stop()
              return
            }
          }
        }

        this.animFrame = requestAnimationFrame(scan)
      }

      this.animFrame = requestAnimationFrame(scan)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Camera permission denied. Please allow camera access and try again.')
      }
      throw new Error('Could not start camera: ' + err.message)
    }
  }

  stop() {
    this.active = false
    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    if (this.video) this.video.srcObject = null
  }
}