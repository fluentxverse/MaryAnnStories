const std = @import("std");

pub const Client = struct {
    base_url: []const u8,
    bearer_token: ?[]const u8,

    pub fn init(base_url: []const u8, bearer_token: ?[]const u8) Client {
        return .{
            .base_url = base_url,
            .bearer_token = bearer_token,
        };
    }

    pub fn sendMessage(self: *const Client, allocator: std.mem.Allocator, message: []const u8) ![]u8 {
        if (self.base_url.len == 0) {
            return error.NullclawUrlMissing;
        }

        const url = try buildWebhookUrl(allocator, self.base_url);
        defer allocator.free(url);

        var payload = std.ArrayList(u8).init(allocator);
        defer payload.deinit();
        try std.json.stringify(.{ .message = message }, .{}, payload.writer());

        var headers = std.ArrayList(std.http.Header).init(allocator);
        defer headers.deinit();

        try headers.append(.{ .name = "Content-Type", .value = "application/json" });
        try headers.append(.{ .name = "Accept", .value = "application/json" });

        var auth_header: ?[]u8 = null;
        defer {
            if (auth_header) |buffer| {
                allocator.free(buffer);
            }
        }

        if (self.bearer_token) |token| {
            auth_header = try std.fmt.allocPrint(allocator, "Bearer {s}", .{token});
            try headers.append(.{ .name = "Authorization", .value = auth_header.? });
        }

        var client = std.http.Client{ .allocator = allocator };
        defer client.deinit();

        var response_body = std.ArrayList(u8).init(allocator);
        errdefer response_body.deinit();

        _ = try client.fetch(.{
            .location = .{ .url = url },
            .method = .POST,
            .payload = payload.items,
            .extra_headers = headers.items,
            .response_storage = .{ .dynamic = &response_body },
            .max_append_size = 2 * 1024 * 1024,
        });

        return response_body.toOwnedSlice();
    }
};

fn buildWebhookUrl(allocator: std.mem.Allocator, base_url: []const u8) ![]u8 {
    const needs_slash = base_url.len > 0 and base_url[base_url.len - 1] != '/';
    return std.fmt.allocPrint(allocator, "{s}{s}webhook", .{
        base_url,
        if (needs_slash) "/" else "",
    });
}
