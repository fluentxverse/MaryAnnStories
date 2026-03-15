const std = @import("std");
const horizon = @import("horizon");
const state = @import("../state.zig");

const StoryRequest = struct {
    prompt: ?[]const u8 = null,
    input: ?[]const u8 = null,
    message: ?[]const u8 = null,
};

const ErrorResponse = struct {
    @"error": []const u8,
};

pub fn generate(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.openai.isEnabled()) {
        try respondError(context, .internal_server_error, "OpenAI API key is missing");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(StoryRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const prompt = parsed.value.prompt orelse parsed.value.input orelse parsed.value.message orelse "";
    if (prompt.len == 0) {
        try respondError(context, .bad_request, "Prompt is required");
        return;
    }

    const response_body = app.openai.generateStory(context.allocator, prompt) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "OpenAI request failed", @errorName(err));
        return;
    };
    defer context.allocator.free(response_body);

    try context.response.json(response_body);
}

fn respondError(context: *horizon.Context, status: horizon.StatusCode, message: []const u8) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(ErrorResponse{ .@"error" = message }, .{}, buffer.writer());
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

    try std.json.stringify(.{ .@"error" = message, .detail = detail }, .{}, buffer.writer());
    context.response.setStatus(status);
    try context.response.json(buffer.items);
}
