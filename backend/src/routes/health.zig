const std = @import("std");
const horizon = @import("horizon");
const state = @import("../state.zig");

pub fn health(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();

    var db_status: []const u8 = "disabled";
    var response_status: horizon.StatusCode = .ok;

    if (app.db.isEnabled()) {
        if (app.db.ping()) |_| {
            db_status = "ok";
        } else |_| {
            db_status = "error";
            response_status = .internal_server_error;
        }
    }

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(.{
        .status = if (response_status == .ok) "ok" else "degraded",
        .db = db_status,
    }, .{}, buffer.writer());

    context.response.setStatus(response_status);
    try context.response.json(buffer.items);
}
