import { describe, expect, it } from 'vitest'
import { AUDIO_FILE_SIZE_LIMIT, validateAudioFile } from './audioFileValidation'

function file(bytes: number[], name: string): File {
  return new File([new Uint8Array(bytes)], name)
}

describe('audio file validation', () => {
  it('accepts supported files whose content matches the extension', async () => {
    await expect(
      validateAudioFile(
        file(
          [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45],
          'clip.wav',
        ),
      ),
    ).resolves.toBeUndefined()
    await expect(
      validateAudioFile(file([0x49, 0x44, 0x33, 0], 'clip.mp3')),
    ).resolves.toBeUndefined()
  })

  it('rejects unsupported extensions, empty files, and mismatched content', async () => {
    await expect(validateAudioFile(file([1], 'clip.txt'))).rejects.toThrow(
      'supported audio file',
    )
    await expect(validateAudioFile(file([], 'clip.wav'))).rejects.toThrow(
      'empty',
    )
    await expect(
      validateAudioFile(file([1, 2, 3, 4], 'clip.wav')),
    ).rejects.toThrow('do not match a valid WAV')
  })

  it('rejects oversized audio before reading its contents', async () => {
    const oversized = file([0], 'clip.wav')
    Object.defineProperty(oversized, 'size', {
      value: AUDIO_FILE_SIZE_LIMIT + 1,
    })
    await expect(validateAudioFile(oversized)).rejects.toThrow(
      '2 GB or smaller',
    )
  })
})
