"""Protocol tests with synthetic card bytes; no hardware or personal data required."""
import ctypes as c
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('thai_id', Path(__file__).with_name('read-thai-id.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakePCSC:
    def SCardConnect(self, context, name, share, protocols, handle, protocol):
        handle._obj.value, protocol._obj.value = 1, 1
        return 0

    def SCardBeginTransaction(self, card):
        return 0

    def SCardEndTransaction(self, card, disposition):
        return 0

    def SCardStatus(self, card, names, name_size, state, protocol, atr, atr_size):
        atr[0], atr[1], atr_size._obj.value = 0x3b, 0x67, 2
        return 0


class ReaderTests(unittest.TestCase):
    def reader(self):
        reader = module.CardReader.__new__(module.CardReader)
        reader.lib, reader.card, reader.context, reader.protocol = FakePCSC(), c.c_int32(), c.c_int32(), c.c_uint32()
        reader.connected = False
        return reader

    def test_get_response_uses_atr_p2(self):
        reader = self.reader()
        commands = []
        responses = iter([(b'', 0x61, 13), (b'9999999999999', 0x90, 0)])
        def transmit(command):
            commands.append(command)
            return next(responses)
        reader.transmit = transmit
        self.assertEqual(reader.exchange([0x80, 0xb0, 0, 4, 2, 0, 13], 1), b'9999999999999')
        self.assertEqual(commands[-1], [0, 0xc0, 0, 1, 13])

    def test_apdu_error_is_not_silent(self):
        reader = self.reader()
        reader.transmit = lambda command: (b'', 0x6a, 0x82)
        with self.assertRaises(module.ReaderError):
            reader.exchange([0])

    def test_text_and_photo_read(self):
        reader = self.reader()
        reader.readers = lambda: ['ACS TEST PICC', 'ACS TEST ICC']
        text = {4: '9999999999999', 0x11: 'นาย#ทดสอบ##ระบบ', 0x75: 'Mr.#TEST##ONLY', 0xd9: '25400101', 0xe1: '1', 0xf6: 'TEST', 0x167: '25600101', 0x16f: '25700101', 0x1579: '1#ถนนทดสอบ#กรุงเทพมหานคร'}
        photo = (b'\xff\xd8TEST\xff\xd9').ljust(5100, b'\0')
        def exchange(command, response_p2=0):
            self.assertEqual(response_p2, 1)
            if command[1] == 0xa4:
                return b''
            offset = command[2] * 256 + command[3]
            if offset in text:
                return text[offset].encode('tis-620')
            start = offset - 0x17b
            return photo[start:start + 255]
        reader.exchange = exchange
        card = reader.read()
        self.assertEqual(card['reader'], 'ACS TEST ICC')
        self.assertEqual(card['firstName'], 'ทดสอบ')
        self.assertEqual(card['lastName'], 'ระบบ')
        self.assertEqual(card['address'], '1 ถนนทดสอบ กรุงเทพมหานคร')
        self.assertEqual(card['photo'], 'data:image/jpeg;base64,/9hURVNU/9k=')

    def test_no_reader_message(self):
        with self.assertRaisesRegex(module.ReaderError, 'ไม่พบเครื่องอ่าน'):
            module.CardReader.check(0x8010002e)


if __name__ == '__main__':
    unittest.main()
