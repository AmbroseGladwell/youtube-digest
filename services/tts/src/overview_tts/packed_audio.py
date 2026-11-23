import struct

SAMPLES_PER_FRAME = 1024
TIMESTAMP_OWNER = b"com.apple.streaming.transportStreamTimestamp\x00"
MPEG_TS_CLOCK = 90_000


def split_adts(buffer: bytes) -> tuple[list[bytes], bytes]:
    frames = []
    position = 0
    while len(buffer) - position >= 7:
        if buffer[position] != 0xFF or buffer[position + 1] & 0xF0 != 0xF0:
            raise ValueError(f"Not an ADTS frame at byte {position}")
        length = ((buffer[position + 3] & 0x03) << 11) | (buffer[position + 4] << 3) | (buffer[position + 5] >> 5)
        if len(buffer) - position < length:
            break
        frames.append(buffer[position : position + length])
        position += length
    return frames, buffer[position:]


def _syncsafe(size: int) -> bytes:
    return bytes(((size >> shift) & 0x7F) for shift in (21, 14, 7, 0))


def _timestamp_tag(first_frame: int, sample_rate: int) -> bytes:
    ticks = (first_frame * SAMPLES_PER_FRAME * MPEG_TS_CLOCK // sample_rate) & ((1 << 33) - 1)
    frame_body = TIMESTAMP_OWNER + struct.pack(">Q", ticks)
    frame = b"PRIV" + struct.pack(">I", len(frame_body)) + b"\x00\x00" + frame_body
    return b"ID3\x04\x00\x00" + _syncsafe(len(frame)) + frame


# An HLS packed-audio segment: where it starts on the timeline, then its frames as they are.
def packed_audio_segment(frames: list[bytes], first_frame: int, sample_rate: int) -> bytes:
    return _timestamp_tag(first_frame, sample_rate) + b"".join(frames)
