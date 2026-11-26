"""Read and stage iFrame3 files through the existing, paired AFC2 service."""
import ctypes as c
import os


class Device:
    def __init__(self, suite, udid):
        self.search = os.add_dll_directory(str(suite))
        self.lib = c.CDLL(str(suite / "libimobiledevice-1.0.dll"))
        self.resources = []
        try:
            device = self.handle("idevice_free")
            self.check(self.lib.idevice_new(c.byref(device), udid.encode()))
            lockdown = self.handle("lockdownd_client_free")
            self.check(self.lib.lockdownd_client_new_with_handshake(device, c.byref(lockdown), b"iFrame3"))
            service = self.handle("lockdownd_service_descriptor_free")
            self.check(self.lib.lockdownd_start_service(lockdown, b"com.apple.afc2", c.byref(service)))
            self.client = self.handle("afc_client_free")
            self.check(self.lib.afc_client_new(device, service, c.byref(self.client)))
        except Exception:
            self.close()
            raise

    def handle(self, release):
        pointer = c.c_void_p()
        self.resources.append((release, pointer))
        return pointer

    @staticmethod
    def check(result):
        if result:
            raise OSError("iPad USB service error %d" % result)

    def close(self):
        for name, pointer in reversed(self.resources):
            if pointer:
                getattr(self.lib, name)(pointer)
        self.resources.clear()
        self.search.close()

    def read(self, path, limit=16 * 1024 * 1024):
        handle = c.c_uint64()
        code = self.lib.afc_file_open(self.client, path.encode(), c.c_uint64(1), c.byref(handle))
        if code == 8:
            return None
        self.check(code)
        try:
            output = bytearray()
            buf, count = c.create_string_buffer(65536), c.c_uint32()
            while len(output) <= limit:
                self.check(self.lib.afc_file_read(self.client, handle, buf, len(buf), c.byref(count)))
                if not count.value:
                    return bytes(output)
                output.extend(buf.raw[:count.value])
            raise ValueError("Device file exceeds size limit")
        finally:
            self.check(self.lib.afc_file_close(self.client, handle))

    def publish(self, path, data):
        temporary = (path + ".part").encode()
        handle = c.c_uint64()
        self.check(self.lib.afc_file_open(self.client, temporary, c.c_uint64(3), c.byref(handle)))
        try:
            offset = 0
            while offset < len(data):
                chunk = data[offset:offset + 65536]
                count = c.c_uint32()
                self.check(self.lib.afc_file_write(self.client, handle, chunk, len(chunk), c.byref(count)))
                if not count.value:
                    raise OSError("Incomplete USB write")
                offset += count.value
        finally:
            self.check(self.lib.afc_file_close(self.client, handle))
        if self.read(temporary.decode()) != data:
            raise OSError("USB read-back failed")
        self.check(self.lib.afc_rename_path(self.client, temporary, path.encode()))
