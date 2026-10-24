export const MAX_SLIP_BYTES = 5 * 1024 * 1024

export async function readRepaymentSlip(file?: File | null) {
  if (!file) return undefined
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_SLIP_BYTES) throw new Error('เลือกสลิป JPG, PNG หรือ PDF ขนาดไม่เกิน 5 MB')
  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null
  if (!mimeType) throw new Error('ชนิดไฟล์ไม่รองรับ กรุณาเลือก JPG, PNG หรือ PDF')
  return { originalName: file.name.slice(0, 240), mimeType, sizeBytes: bytes.length, fileData: new Uint8Array(bytes) }
}
