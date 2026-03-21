const std = @import("std");

pub const Client = struct {
    base_url: []const u8,
    api_key: ?[]const u8,
    story_model: []const u8,
    image_model: []const u8,

    pub fn init(
        base_url: []const u8,
        api_key: ?[]const u8,
        story_model: []const u8,
        image_model: []const u8,
    ) Client {
        return .{
            .base_url = base_url,
            .api_key = api_key,
            .story_model = story_model,
            .image_model = image_model,
        };
    }

    pub fn isEnabled(self: *const Client) bool {
        return self.api_key != null;
    }

    pub fn generateStory(self: *const Client, allocator: std.mem.Allocator, input: []const u8) ![]u8 {
        const api_key = self.api_key orelse return error.OpenAiApiKeyMissing;

        const url = try buildUrl(allocator, self.base_url, "responses");
        defer allocator.free(url);

        var payload = std.ArrayList(u8).init(allocator);
        defer payload.deinit();
        try std.json.stringify(.{
            .model = self.story_model,
            .input = input,
        }, .{}, payload.writer());

        return try sendRequest(allocator, url, api_key, payload.items);
    }

    pub fn generateImage(
        self: *const Client,
        allocator: std.mem.Allocator,
        prompt: []const u8,
        size: []const u8,
        image_model_override: ?[]const u8,
    ) ![]u8 {
        const api_key = self.api_key orelse return error.OpenAiApiKeyMissing;
        const image_model = if (image_model_override) |model|
            if (model.len > 0) model else self.image_model
        else
            self.image_model;

        const url = try buildUrl(allocator, self.base_url, "images/generations");
        defer allocator.free(url);

        var payload = std.ArrayList(u8).init(allocator);
        defer payload.deinit();
        try std.json.stringify(.{
            .model = image_model,
            .prompt = prompt,
            .size = size,
            .n = 1,
        }, .{}, payload.writer());

        return try sendRequest(allocator, url, api_key, payload.items);
    }

};

fn sendRequest(
    allocator: std.mem.Allocator,
    url: []const u8,
    api_key: []const u8,
    payload: []const u8,
) ![]u8 {
    var headers = std.ArrayList(std.http.Header).init(allocator);
    defer headers.deinit();

    try headers.append(.{ .name = "Content-Type", .value = "application/json" });
    try headers.append(.{ .name = "Accept", .value = "application/json" });

    const auth_header = try std.fmt.allocPrint(allocator, "Bearer {s}", .{api_key});
    defer allocator.free(auth_header);
    try headers.append(.{ .name = "Authorization", .value = auth_header });

    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    var response_body = std.ArrayList(u8).init(allocator);
    errdefer response_body.deinit();

    _ = try client.fetch(.{
        .location = .{ .url = url },
        .method = .POST,
        .payload = payload,
        .extra_headers = headers.items,
        .response_storage = .{ .dynamic = &response_body },
        .max_append_size = 8 * 1024 * 1024,
    });

    return response_body.toOwnedSlice();
}

fn buildUrl(allocator: std.mem.Allocator, base_url: []const u8, path: []const u8) ![]u8 {
    const needs_slash = base_url.len > 0 and base_url[base_url.len - 1] != '/';
    return std.fmt.allocPrint(allocator, "{s}{s}{s}", .{
        base_url,
        if (needs_slash) "/" else "",
        path,
    });
}

fn buildDataUrl(
    allocator: std.mem.Allocator,
    image_bytes: []const u8,
    mime_type: []const u8,
) ![]u8 {
    const encoded_len = std.base64.standard.Encoder.calcSize(image_bytes.len);
    const encoded = try allocator.alloc(u8, encoded_len);
    defer allocator.free(encoded);
    _ = std.base64.standard.Encoder.encode(encoded, image_bytes);
    return std.fmt.allocPrint(allocator, "data:{s};base64,{s}", .{
        if (mime_type.len > 0) mime_type else "image/png",
        encoded,
    });
}
