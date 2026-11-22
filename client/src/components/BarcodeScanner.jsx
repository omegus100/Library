import React, { useEffect, useRef, useState } from 'react'
import styles from './BarcodeScanner.module.css'

export const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia)

// Scan a book's ISBN barcode with the camera (browser BarcodeDetector; Chrome/Edge/Android).
// Calls onDetect('978...') once, then closes.
export default function BarcodeScanner({ onDetect, onClose }) {
    const videoRef = useRef(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let stream
        let raf
        let stopped = false

        async function start() {
            try {
                const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] })
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
                const video = videoRef.current
                video.srcObject = stream
                await video.play()

                const tick = async () => {
                    if (stopped) return
                    try {
                        const codes = await detector.detect(video)
                        const isbn = codes.map((c) => c.rawValue).find((v) => /^97[89]\d{10}$/.test(v)) || codes[0]?.rawValue
                        if (isbn) { stopped = true; onDetect(isbn); return }
                    } catch { /* frame not ready */ }
                    raf = requestAnimationFrame(tick)
                }
                tick()
            } catch (err) {
                setError(err.name === 'NotAllowedError'
                    ? 'Camera access was blocked. Allow the camera for this site, or type the ISBN instead.'
                    : 'Couldn’t start the camera. Type the ISBN instead.')
            }
        }
        start()

        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => {
            stopped = true
            cancelAnimationFrame(raf)
            stream?.getTracks().forEach((t) => t.stop())
            document.removeEventListener('keydown', onKey)
        }
    }, [onDetect, onClose])

    return (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Scan a barcode">
            <div className={styles.dialog}>
                <p className={styles.title}>Point the camera at the barcode on the back of the book</p>
                {error ? <p className={styles.error}>{error}</p> : (
                    <div className={styles.viewport}>
                        <video ref={videoRef} className={styles.video} muted playsInline />
                        <span className={styles.guide} aria-hidden="true" />
                    </div>
                )}
                <button type="button" className={styles.close} onClick={onClose} autoFocus>Cancel</button>
            </div>
        </div>
    )
}
