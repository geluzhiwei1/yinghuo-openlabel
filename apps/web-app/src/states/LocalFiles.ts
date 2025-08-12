import { reactive } from 'vue'
import { fileOpen, directoryOpen, fileSave, supported } from 'browser-fs-access'
export const pathBlobMap = reactive(new Map<string, Blob>())

export const fileTypes = {
  images: ['.png', '.jpg'],
  videos: ['.mp4', '.avi', '.wmv'],
  audios: ['mp3', 'wav'],
  documents: ['pdf', 'docx', 'txt'],
  pointcloud: ['.pcd', '.ply', '.las', '.laz']
}

const listDirectory = (blobs) => {
  if (blobs.length && !(blobs[0] instanceof File)) {
    return 'No files in directory.'
  }
  // blobs
  //   .sort((a, b) => a.webkitRelativePath.localeCompare(b))
  //   .forEach((blob) => {
  //     // The File System Access API currently reports the `webkitRelativePath`
  //     // as empty string `''`.
  //     fileStructure += `${blob.webkitRelativePath}\n`;
  //   });

  const imageBlobs = [] as any[]
  const imagePaths = [] as string[]
  blobs
    .filter((blob) => {
      return blob.type.startsWith('image/')
    })
    .sort((a, b) => a.webkitRelativePath.localeCompare(b))
    .forEach((blob) => {
      // appendImage(blob);
      imagePaths.push(`${blob.webkitRelativePath}`)
      imageBlobs.push(blob)
    })
  return [imageBlobs, imagePaths]
}

const appendImage = (blob) => {
  const img = document.createElement('img')
  img.src = URL.createObjectURL(blob)
  document.body.append(img)
  img.onload = img.onerror = () => URL.revokeObjectURL(img.src)
}
export const openImagesFromDir = async (cb) => {
  try {
    const blobs = await directoryOpen({
      recursive: true
    })
    const [imageBlobs, imagePaths] = listDirectory(blobs)
    if (cb) {
      cb(imagePaths, imageBlobs)
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      return console.error(err)
    }
  }
}

export const openFilesFromDir = (opts: any) => {
  return new Promise((resolve, reject) => {
    try {
      directoryOpen({
        recursive: true
      })
        .then((blobs) => {
          if (blobs.length && !(blobs[0] instanceof File)) {
            reject('No files in directory.')
          }

          const imageBlobs = [] as any[]
          const imagePaths = [] as string[]

          let filterd = blobs
          if (opts.fileExts) {
            if (opts.fileExts.length > 0) {
              filterd = blobs.filter((blob) => {
                for (const t of opts.fileExts) {
                  if (blob.webkitRelativePath.endsWith(t)) {
                    return true
                  }
                }
              })
            }
          }
          filterd
            .sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath))
            .forEach((blob) => {
              imagePaths.push(`${blob.webkitRelativePath}`)
              imageBlobs.push(blob)
            })
          resolve({ filePaths: imagePaths, blobs: imageBlobs })
        })
        .catch((err) => {
          reject(err)
        })
    } catch (err) {
      reject(err)
    }
  })
}
