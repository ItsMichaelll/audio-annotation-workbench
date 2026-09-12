export const AUDIO_FILE_SIZE_LIMIT = 2 * 1024 * 1024 * 1024

const AUDIO_EXTENSIONS = new Set([
  '.aac',
  '.aif',
  '.aiff',
  '.flac',
  '.m4a',
  '.mp3',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.wave',
  '.webm',
])

export const AUDIO_FILE_ACCEPT =
  '.aac,.aif,.aiff,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav,.wave,.webm'

function extensionOf(filename: string): string {
  const period = filename.lastIndexOf('.')
  return period >= 0 ? filename.slice(period).toLowerCase() : ''
}

export function validateAudioFilename(filename: string): void {
  if (!AUDIO_EXTENSIONS.has(extensionOf(filename))) {
    throw new Error(
      'Choose a supported audio file: WAV, FLAC, MP3, AAC, M4A, AIFF, OGG, Opus, or WebM.',
    )
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

function hasAudioSignature(extension: string, bytes: Uint8Array): boolean {
  if (extension === '.wav' || extension === '.wave')
    return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE'
  if (extension === '.flac') return ascii(bytes, 0, 4) === 'fLaC'
  if (extension === '.ogg' || extension === '.oga' || extension === '.opus')
    return ascii(bytes, 0, 4) === 'OggS'
  if (extension === '.aif' || extension === '.aiff')
    return (
      ascii(bytes, 0, 4) === 'FORM' &&
      ['AIFF', 'AIFC'].includes(ascii(bytes, 8, 4))
    )
  if (extension === '.m4a') return ascii(bytes, 4, 4) === 'ftyp'
  if (extension === '.webm')
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    )
  if (extension === '.aac')
    return bytes[0] === 0xff && (bytes[1]! & 0xf6) === 0xf0
  if (extension === '.mp3')
    return (
      ascii(bytes, 0, 3) === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
    )
  return false
}

export async function validateAudioFile(file: File): Promise<void> {
  const extension = extensionOf(file.name)
  validateAudioFilename(file.name)
  if (file.size === 0) throw new Error('The selected audio file is empty.')
  if (file.size > AUDIO_FILE_SIZE_LIMIT) {
    throw new Error('Audio files must be 2 GB or smaller.')
  }
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  } catch {
    throw new Error('The selected audio file could not be read.')
  }
  if (!hasAudioSignature(extension, bytes)) {
    throw new Error(
      `The contents of “${file.name}” do not match a valid ${extension.slice(1).toUpperCase()} audio file.`,
    )
  }
}
