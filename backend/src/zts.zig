const std = @import("std");

pub fn print(template: []const u8, section: ?[]const u8, args: anytype, writer: anytype) !void {
    _ = section;
    _ = args;
    try writer.writeAll(template);
}

pub fn printHeader(template: []const u8, args: anytype, writer: anytype) !void {
    _ = args;
    try writer.writeAll(template);
}

pub fn s(template: []const u8, section: ?[]const u8) []const u8 {
    _ = section;
    return template;
}
