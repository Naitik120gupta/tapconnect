// src/lib/tap.js
// ─────────────────────────────────────────────────────────────
// tap.connect — Smart Tap Engine
// Tries NFC first (Android Chrome), falls back to QR, then code
// ─────────────────────────────────────────────────────────────

// Detect what's available on this device
export const getTapCapability = () => {
  const hasNFC = 'NDEFReader' in window
  const hasCamera = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'

  return {
    nfc: hasNFC && isSecure,        // Android Chrome on HTTPS only
    qr: hasCamera,                   // Any phone with camera
    code: true,                      // Always available
    recommended: hasNFC && isSecure ? 'nfc' : hasCamera ? 'qr' : 'code'
  }
}

// ─── NFC SENDER (creates room, writes code to NFC) ────────────
export class NFCSender {
  constructor() {
    this.reader = null
    this.abortController = null
  }

  async writeCode(code) {
    if (!('NDEFReader' in window)) throw new Error('NFC not supported')

    this.abortController = new AbortController()
    const ndef = new window.NDEFReader()

    // Write the tap code into the NFC field
    // The other phone reads it and auto-joins
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

// ─── NFC RECEIVER (scans, reads code, joins room) ─────────────
export class NFCReceiver {
  constructor() {
    this.abortController = null
  }

  async startScan(onCodeReceived) {
    if (!('NDEFReader' in window)) throw new Error('NFC not supported')

    this.abortController = new AbortController()
    const ndef = new window.NDEFReader()

    await ndef.scan({ signal: this.abortController.signal })

    ndef.addEventListener('reading', ({ message }) => {
      for (const record of message.records) {
        if (record.recordType === 'url') {
          const decoder = new TextDecoder()
          const url = decoder.decode(record.data)
          // Extract the 6-digit code from the URL
          const match = url.match(/\/join\/(\d{6})/)
          if (match) {
            onCodeReceived(match[1])
            this.cancel()
          }
        }
      }
    })

    ndef.addEventListener('readingerror', () => {
      console.warn('NFC read error')
    })
  }

  cancel() {
    this.abortController?.abort()
  }
}

// ─── QR CODE SCANNER (uses camera) ────────────────────────────
// We use a dynamic import of jsQR for lightweight bundle
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
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      this.video.srcObject = this.stream
      this.video.play()
      this.active = true

      // Dynamic import jsQR
      const { default: jsQR } = await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js')

      const scan = () => {
        if (!this.active) return
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
          const ctx = this.canvas.getContext('2d')
          this.canvas.width = this.video.videoWidth
          this.canvas.height = this.video.videoHeight
          ctx.drawImage(this.video, 0, 0)
          const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            // Could be a URL like /join/123456 or just the 6-digit code
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
      throw new Error('Camera access denied or unavailable')
    }
  }

  stop() {
    this.active = false
    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
  }
}
