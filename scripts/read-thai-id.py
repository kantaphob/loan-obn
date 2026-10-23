#!/usr/bin/env python3
"""Read a Thai citizen card via macOS PC/SC. No disk storage or third-party packages.
APDU offsets: https://github.com/chakphanu/ThaiNationalIDCard/blob/master/APDU.md
Only JSON is written to stdout. Never log card contents.
"""
import base64
import ctypes as c
import json
import sys


class ReaderError(Exception):
    pass


class IORequest(c.Structure):
    _fields_ = [('protocol', c.c_uint32), ('length', c.c_uint32)]


class ReaderState(c.Structure):
    _fields_ = [
        ('reader', c.c_char_p), ('user_data', c.c_void_p),
        ('current_state', c.c_uint32), ('event_state', c.c_uint32),
        ('atr_length', c.c_uint32), ('atr', c.c_ubyte * 36),
    ]


class CardReader:
    def __init__(self):
        if sys.platform != 'darwin':
            raise ReaderError('บริการอ่านบัตรนี้รองรับ macOS เท่านั้น')
        self.lib = c.CDLL('/System/Library/Frameworks/PCSC.framework/PCSC')
        self.context = c.c_int32()
        self.card = c.c_int32()
        self.protocol = c.c_uint32()
        self.connected = False
        # macOS PC/SC handles are 32-bit, including on Apple Silicon.
        signatures = {
            'SCardEstablishContext': [c.c_uint32, c.c_void_p, c.c_void_p, c.POINTER(c.c_int32)],
            'SCardReleaseContext': [c.c_int32],
            'SCardListReaders': [c.c_int32, c.c_char_p, c.c_void_p, c.POINTER(c.c_uint32)],
            'SCardConnect': [c.c_int32, c.c_char_p, c.c_uint32, c.c_uint32, c.POINTER(c.c_int32), c.POINTER(c.c_uint32)],
            'SCardDisconnect': [c.c_int32, c.c_uint32],
            'SCardBeginTransaction': [c.c_int32],
            'SCardEndTransaction': [c.c_int32, c.c_uint32],
            'SCardStatus': [c.c_int32, c.c_void_p, c.POINTER(c.c_uint32), c.POINTER(c.c_uint32), c.POINTER(c.c_uint32), c.c_void_p, c.POINTER(c.c_uint32)],
            'SCardTransmit': [c.c_int32, c.POINTER(IORequest), c.c_void_p, c.c_uint32, c.c_void_p, c.c_void_p, c.POINTER(c.c_uint32)],
            'SCardGetStatusChange': [c.c_int32, c.c_uint32, c.POINTER(ReaderState), c.c_uint32],
        }
        for name, args in signatures.items():
            function = getattr(self.lib, name)
            function.argtypes = args
            function.restype = c.c_int32
        self.check(self.lib.SCardEstablishContext(0, None, None, c.byref(self.context)))

    @staticmethod
    def check(result):
        code = result & 0xffffffff
        if code:
            messages = {
                0x8010002e: 'ไม่พบเครื่องอ่าน ACS กรุณาตรวจสอบการเชื่อมต่อและไดรเวอร์ PC/SC',
                0x8010000c: 'ยังไม่พบบัตรในเครื่องอ่าน',
                0x80100017: 'เครื่องอ่านไม่พร้อมใช้งาน กรุณาเชื่อมต่อใหม่',
                0x80100069: 'บัตรถูกนำออกก่อนอ่านเสร็จ กรุณาลองใหม่',
                0x8010001d: 'บริการ PC/SC ยังไม่พร้อม กรุณาตรวจสอบเครื่องอ่านหรือไดรเวอร์',
            }
            raise ReaderError(messages.get(code, 'สื่อสารกับเครื่องอ่านไม่ได้ (PC/SC %08X)' % code))

    def readers(self):
        size = c.c_uint32()
        self.check(self.lib.SCardListReaders(self.context, None, None, c.byref(size)))
        if size.value < 2:
            raise ReaderError('ไม่พบเครื่องอ่าน ACS')
        names = c.create_string_buffer(size.value)
        self.check(self.lib.SCardListReaders(self.context, None, names, c.byref(size)))
        return [name.decode('utf-8') for name in names.raw.split(b'\0') if name]

    def wait_for_card(self, timeout_ms=20000):
        """Wait for a card insertion event; also reports cards already present."""
        names = self.readers()
        names.sort(key=lambda name: ('PICC' in name.upper(), 'ACS' not in name.upper()))
        state = ReaderState()
        state.reader = names[0].encode('utf-8')
        state.current_state = 0  # SCARD_STATE_UNAWARE: query current availability first.
        result = self.lib.SCardGetStatusChange(self.context, 0, c.byref(state), 1)
        if result:
            self.check(result)
        if state.event_state & 0x20:  # SCARD_STATE_PRESENT
            return True

        state.current_state = state.event_state
        result = self.lib.SCardGetStatusChange(self.context, timeout_ms, c.byref(state), 1)
        if (result & 0xffffffff) == 0x8010000a:  # SCARD_E_TIMEOUT
            return False
        if result:
            self.check(result)
        return bool(state.event_state & 0x20)

    def transmit(self, command):
        send = (c.c_ubyte * len(command))(*command)
        receive = (c.c_ubyte * 4096)()
        size = c.c_uint32(len(receive))
        pci = IORequest(self.protocol.value, c.sizeof(IORequest))
        self.check(self.lib.SCardTransmit(self.card, c.byref(pci), send, len(command), None, receive, c.byref(size)))
        response = bytes(receive[:size.value])
        if len(response) < 2:
            raise ReaderError('ข้อมูลตอบกลับจากบัตรไม่ครบ กรุณาอ่านใหม่')
        return response[:-2], response[-2], response[-1]

    def exchange(self, command, response_p2=0):
        output = b''
        for _ in range(6):
            data, sw1, sw2 = self.transmit(command)
            output += data
            if sw1 == 0x90 and sw2 == 0:
                return output
            if sw1 == 0x61:
                command = [0x00, 0xc0, 0x00, response_p2, sw2]
            elif sw1 == 0x6c:
                command = command[:-1] + [sw2]
                output = b''
            else:
                raise ReaderError('บัตรไม่รองรับคำสั่ง หรืออ่านไม่สำเร็จ (%02X%02X)' % (sw1, sw2))
        raise ReaderError('อ่านข้อมูลบัตรไม่ครบ กรุณาอ่านใหม่')

    def read(self):
        readers = self.readers()
        # Prefer a contact interface when a multi-interface ACS device is attached.
        readers.sort(key=lambda name: ('PICC' in name.upper(), 'ACS' not in name.upper()))
        reader = readers[0]
        self.check(self.lib.SCardConnect(self.context, reader.encode(), 2, 3, c.byref(self.card), c.byref(self.protocol)))
        self.connected = True
        self.check(self.lib.SCardBeginTransaction(self.card))
        try:
            atr, atr_size = (c.c_ubyte * 64)(), c.c_uint32(64)
            name_size, name_buf = c.c_uint32(1024), c.create_string_buffer(1024)
            state, protocol = c.c_uint32(), c.c_uint32()
            self.check(self.lib.SCardStatus(self.card, name_buf, c.byref(name_size), c.byref(state), c.byref(protocol), atr, c.byref(atr_size)))
            response_p2 = 1 if bytes(atr[:2]) == b'\x3b\x67' else 0
            self.exchange([0, 0xa4, 4, 0, 8, 0xa0, 0, 0, 0, 0x54, 0x48, 0, 1], response_p2)

            def read_bytes(offset, length):
                return self.exchange([0x80, 0xb0, offset >> 8, offset & 255, 2, 0, length], response_p2)

            def text(offset, length):
                return read_bytes(offset, length).decode('tis-620').replace('\x00', '').strip()

            national_id = text(0x04, 13)
            if len(national_id) != 13 or not national_id.isdigit():
                raise ReaderError('ไม่พบเลขบัตรประชาชนที่ถูกต้อง')
            thai_name = text(0x11, 100).split('#')
            english_name = text(0x75, 100).split('#')
            address = ' '.join(part.strip() for part in text(0x1579, 100).split('#') if part.strip())
            photo = b''.join(read_bytes(0x17b + part * 255, 255) for part in range(20))
            start, end = photo.find(b'\xff\xd8'), photo.rfind(b'\xff\xd9')
            if start < 0 or end < start:
                raise ReaderError('อ่านรูปจากบัตรไม่สำเร็จ กรุณาลองใหม่')
            return {
                'nationalId': national_id, 'titleTh': thai_name[0].strip(),
                'firstName': thai_name[1].strip() if len(thai_name) > 1 else '',
                'lastName': thai_name[-1].strip() if len(thai_name) > 2 else '',
                'middleNameTh': ' '.join(p.strip() for p in thai_name[2:-1] if p.strip()),
                'titleEn': english_name[0].strip(),
                'firstNameEn': english_name[1].strip() if len(english_name) > 1 else '',
                'middleNameEn': ' '.join(p.strip() for p in english_name[2:-1] if p.strip()),
                'lastNameEn': english_name[-1].strip() if len(english_name) > 2 else '',
                'fullNameTh': ' '.join(part.strip() for part in thai_name if part.strip()),
                'fullNameEn': ' '.join(part.strip() for part in english_name if part.strip()),
                'birthDate': text(0xd9, 8), 'gender': text(0xe1, 1), 'issuer': text(0xf6, 100),
                'issueDate': text(0x167, 8), 'expiryDate': text(0x16f, 8), 'address': address,
                'photo': 'data:image/jpeg;base64,' + base64.b64encode(photo[start:end + 2]).decode(),
                'reader': reader,
            }
        finally:
            self.lib.SCardEndTransaction(self.card, 0)

    def close(self):
        if self.connected:
            self.lib.SCardDisconnect(self.card, 0)
        self.lib.SCardReleaseContext(self.context)


def main():
    reader = None
    try:
        reader = CardReader()
        if '--list' in sys.argv:
            result = {'readers': reader.readers()}
        elif '--wait' in sys.argv:
            result = {'cardPresent': reader.wait_for_card()}
        else:
            result = {'card': reader.read()}
        print(json.dumps(result, ensure_ascii=False))
    except ReaderError as error:
        print(json.dumps({'message': str(error)}, ensure_ascii=False))
        return 1
    except Exception:
        print(json.dumps({'message': 'อ่านข้อมูลบัตรไม่สำเร็จ กรุณาตรวจสอบเครื่องอ่านและบัตร'}, ensure_ascii=False))
        return 1
    finally:
        if reader:
            reader.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
