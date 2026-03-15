pub fn Counter(comptime T: type) type {
    return struct {
        pub const Impl = struct {
            value: T = 0,
            name: []const u8,

            pub fn init(name: []const u8, _: anytype) Impl {
                return .{ .name = name };
            }

            pub fn incr(self: *Impl) void {
                self.value += 1;
            }

            pub fn incrBy(self: *Impl, amount: T) void {
                self.value += amount;
            }

            pub fn write(self: *const Impl, _: anytype) !void {
                _ = self;
            }
        };
    };
}
