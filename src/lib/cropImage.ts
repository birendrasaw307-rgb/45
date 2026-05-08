export const createImage = async (url: string): Promise<HTMLImageElement> => {
  let objectUrl = url
  let isFetched = false

  if (url.startsWith('http')) {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      isFetched = true
    } catch (e) {
      console.warn('Could not fetch image directly for cropping, relying on standard loading', e)
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => {
      if (isFetched) URL.revokeObjectURL(objectUrl)
      resolve(image)
    })
    image.addEventListener('error', (error) => {
      if (isFetched) URL.revokeObjectURL(objectUrl)
      reject(error)
    })
    if (!objectUrl.startsWith('blob:') && !objectUrl.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous')
    }
    image.src = objectUrl
  })
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // set canvas size to match the bounding box
  canvas.width = image.width
  canvas.height = image.height

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(image.width / 2, image.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  const croppedCanvas = document.createElement('canvas')

  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) {
    return null
  }

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width
  croppedCanvas.height = pixelCrop.height

  // Draw the cropped image onto the new canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // As a blob
  return new Promise((resolve) => {
    croppedCanvas.toBlob((file) => {
      if (file) {
        resolve(new File([file], 'cropped.jpeg', { type: 'image/jpeg' }))
      } else {
        resolve(null)
      }
    }, 'image/jpeg')
  })
}
