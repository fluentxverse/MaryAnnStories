const std = @import("std");

pub const Client = struct {
    filer_endpoint: []const u8,
    public_url: []const u8,

    pub fn init(filer_endpoint: []const u8, public_url: []const u8) Client {
        return .{
            .filer_endpoint = filer_endpoint,
            .public_url = public_url,
        };
    }

    pub fn isEnabled(self: *const Client) bool {
        return self.filer_endpoint.len > 0;
    }

    pub fn storeStoryImage(
        self: *const Client,
        allocator: std.mem.Allocator,
        story_id: []const u8,
        bytes: []const u8,
        content_type: []const u8,
    ) !StoredImage {
        if (self.filer_endpoint.len == 0) {
            return error.SeaweedEndpointMissing;
        }

        const safe_story_id = try sanitizeSegment(allocator, story_id);
        defer allocator.free(safe_story_id);

        const image_id = try randomHexId(allocator);
        defer allocator.free(image_id);

        const path = try std.fmt.allocPrint(allocator, "stories/{s}/{s}.png", .{
            safe_story_id,
            image_id,
        });
        errdefer allocator.free(path);

        const upload_url = try buildUrl(allocator, self.filer_endpoint, path);
        defer allocator.free(upload_url);

        var headers = std.ArrayList(std.http.Header).init(allocator);
        defer headers.deinit();
        try headers.append(.{ .name = "Content-Type", .value = content_type });

        var client = std.http.Client{ .allocator = allocator };
        defer client.deinit();

        var response_body = std.ArrayList(u8).init(allocator);
        defer response_body.deinit();

        const response = try client.fetch(.{
            .location = .{ .url = upload_url },
            .method = .PUT,
            .payload = bytes,
            .extra_headers = headers.items,
            .response_storage = .{ .dynamic = &response_body },
            .max_append_size = 1024 * 1024,
        });

        if (response.status != .ok and response.status != .created) {
            return error.SeaweedUploadFailed;
        }

        const public_url = try buildUrl(allocator, self.public_url, path);

        return .{
            .path = path,
            .url = public_url,
        };
    }

    pub fn deleteStoryImage(
        self: *const Client,
        allocator: std.mem.Allocator,
        path: []const u8,
    ) !void {
        if (self.filer_endpoint.len == 0) {
            return error.SeaweedEndpointMissing;
        }
        if (path.len == 0) {
            return;
        }

        const delete_url = try buildUrl(allocator, self.filer_endpoint, path);
        defer allocator.free(delete_url);

        var client = std.http.Client{ .allocator = allocator };
        defer client.deinit();

        const response = try client.fetch(.{
            .location = .{ .url = delete_url },
            .method = .DELETE,
        });

        if (response.status != .ok and response.status != .no_content and response.status != .not_found) {
            return error.SeaweedDeleteFailed;
        }
    }
};

pub const StoredImage = struct {
    path: []u8,
    url: []u8,

    pub fn deinit(self: *StoredImage, allocator: std.mem.Allocator) void {
        allocator.free(self.path);
        allocator.free(self.url);
    }
};

fn buildUrl(allocator: std.mem.Allocator, base_url: []const u8, path: []const u8) ![]u8 {
    const needs_slash = base_url.len > 0 and base_url[base_url.len - 1] != '/';
    return std.fmt.allocPrint(allocator, "{s}{s}{s}", .{
        base_url,
        if (needs_slash) "/" else "",
        path,
    });
}

fn sanitizeSegment(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    var buffer = std.ArrayList(u8).init(allocator);
    errdefer buffer.deinit();

    for (value) |c| {
        if (std.ascii.isAlphanumeric(c) or c == '-' or c == '_') {
            try buffer.append(c);
        } else {
            try buffer.append('-');
        }
    }

    if (buffer.items.len == 0) {
        try buffer.appendSlice("story");
    }

    if (buffer.items.len > 64) {
        buffer.shrinkRetainingCapacity(64);
    }

    return buffer.toOwnedSlice();
}

fn randomHexId(allocator: std.mem.Allocator) ![]u8 {
    var bytes: [16]u8 = undefined;
    std.crypto.random.bytes(&bytes);
    return std.fmt.allocPrint(allocator, "{s}", .{std.fmt.fmtSliceHexLower(&bytes)});
}
