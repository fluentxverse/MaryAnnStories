const std = @import("std");

pub const Buffer = struct {
    allocator: std.mem.Allocator,
    buf: []u8,
    len: usize,

    pub fn init(allocator: std.mem.Allocator, capacity: usize) !Buffer {
        const storage = try allocator.alloc(u8, capacity);
        return .{
            .allocator = allocator,
            .buf = storage,
            .len = 0,
        };
    }

    pub fn deinit(self: *const Buffer) void {
        const mutable = @constCast(self);
        mutable.allocator.free(mutable.buf);
    }

    pub fn reset(self: *Buffer) void {
        self.len = 0;
    }

    pub fn resetRetainingCapacity(self: *Buffer) void {
        self.len = 0;
    }

    pub fn string(self: *const Buffer) []const u8 {
        return self.buf[0..self.len];
    }

    pub fn ensureTotalCapacity(self: *Buffer, needed: usize) !void {
        if (needed <= self.buf.len) {
            return;
        }

        var new_cap = self.buf.len;
        if (new_cap == 0) {
            new_cap = 8;
        }
        while (new_cap < needed) {
            new_cap *= 2;
        }
        self.buf = try self.allocator.realloc(self.buf, new_cap);
    }

    pub fn ensureUnusedCapacity(self: *Buffer, additional: usize) !void {
        try self.ensureTotalCapacity(self.len + additional);
    }

    pub fn truncate(self: *Buffer, new_len: usize) void {
        if (new_len <= self.len) {
            self.len = new_len;
            return;
        }
        self.ensureTotalCapacity(new_len) catch return;
        self.len = new_len;
    }

    pub fn write(self: *Buffer, data: []const u8) !void {
        try self.ensureTotalCapacity(self.len + data.len);
        std.mem.copyForwards(u8, self.buf[self.len .. self.len + data.len], data);
        self.len += data.len;
    }

    pub fn writeAssumeCapacity(self: *Buffer, data: []const u8) void {
        std.mem.copyForwards(u8, self.buf[self.len .. self.len + data.len], data);
        self.len += data.len;
    }

    pub fn writeByte(self: *Buffer, byte: u8) !void {
        try self.ensureTotalCapacity(self.len + 1);
        self.buf[self.len] = byte;
        self.len += 1;
    }

    pub fn writeByteAssumeCapacity(self: *Buffer, byte: u8) void {
        self.buf[self.len] = byte;
        self.len += 1;
    }

    pub fn writeByteNTimes(self: *Buffer, byte: u8, count: usize) !void {
        try self.ensureTotalCapacity(self.len + count);
        @memset(self.buf[self.len .. self.len + count], byte);
        self.len += count;
    }

    pub fn writeIntBig(self: *Buffer, comptime T: type, value: T) !void {
        var tmp: [@sizeOf(T)]u8 = undefined;
        std.mem.writeInt(T, &tmp, value, .big);
        try self.write(&tmp);
    }

    pub fn writeAt(self: *Buffer, data: []const u8, pos: usize) void {
        std.mem.copyForwards(u8, self.buf[pos .. pos + data.len], data);
    }

    pub fn skip(self: *Buffer, amount: usize) !View {
        const start = self.len;
        try self.ensureTotalCapacity(self.len + amount);
        self.len += amount;
        return .{
            .buf = self,
            .start = start,
            .len = amount,
            .pos = 0,
        };
    }

    pub fn writer(self: *Buffer) Writer {
        return Writer{ .context = self };
    }
};

pub const Writer = std.io.Writer(*Buffer, error{OutOfMemory}, writeToBuffer);

fn writeToBuffer(self: *Buffer, bytes: []const u8) error{OutOfMemory}!usize {
    try self.write(bytes);
    return bytes.len;
}

pub const View = struct {
    buf: *Buffer,
    start: usize,
    len: usize,
    pos: usize,

    pub fn write(self: *View, data: []const u8) void {
        std.debug.assert(self.pos + data.len <= self.len);
        std.mem.copyForwards(
            u8,
            self.buf.buf[self.start + self.pos .. self.start + self.pos + data.len],
            data,
        );
        self.pos += data.len;
    }

    pub fn writeByte(self: *View, byte: u8) void {
        std.debug.assert(self.pos + 1 <= self.len);
        self.buf.buf[self.start + self.pos] = byte;
        self.pos += 1;
    }

    pub fn writeIntBig(self: *View, comptime T: type, value: T) void {
        var tmp: [@sizeOf(T)]u8 = undefined;
        std.mem.writeInt(T, &tmp, value, .big);
        self.write(&tmp);
    }

    pub fn writeAt(self: *View, data: []const u8, offset: usize) void {
        std.debug.assert(offset + data.len <= self.len);
        std.mem.copyForwards(
            u8,
            self.buf.buf[self.start + offset .. self.start + offset + data.len],
            data,
        );
    }
};
