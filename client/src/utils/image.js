// Shrink an image before upload: max width/height, re-encoded as JPEG. Returns a data URL.
// Keeps covers small (~50–150 KB) instead of multi-megabyte originals.
export async function resizeImage(source, { maxSize = 800, quality = 0.85 } = {}) {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = () => reject(new Error('That file isn’t an image we can read.'))
            el.src = url
        })
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF' // transparent PNGs get a white background in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', quality)
    } finally {
        if (typeof source !== 'string') URL.revokeObjectURL(url)
    }
}
