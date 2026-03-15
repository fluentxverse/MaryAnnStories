const std = @import("std");
const horizon = @import("horizon");
const state = @import("../state.zig");

const AgentRequest = struct {
    message: ?[]const u8 = null,
    input: ?[]const u8 = null,
};

pub fn agent(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(AgentRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const message = parsed.value.message orelse parsed.value.input orelse "";
    if (message.len == 0) {
        try respondError(context, .bad_request, "Missing message");
        return;
    }

    const response_body = app.nullclaw.sendMessage(context.allocator, message) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Nullclaw request failed", @errorName(err));
        return;
    };
    defer context.allocator.free(response_body);

    try context.response.json(response_body);
}

fn respondError(context: *horizon.Context, status: horizon.StatusCode, message: []const u8) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(ErrorPayload{ .@"error" = message }, .{}, buffer.writer());

    context.response.setStatus(status);
    try context.response.json(buffer.items);
}

fn respondErrorWithDetail(
    context: *horizon.Context,
    status: horizon.StatusCode,
    message: []const u8,
    detail: []const u8,
) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(ErrorPayload{ .@"error" = message, .detail = detail }, .{}, buffer.writer());

    context.response.setStatus(status);
    try context.response.json(buffer.items);
}

const ErrorPayload = struct {
    @"error": []const u8,
    detail: ?[]const u8 = null,
};
