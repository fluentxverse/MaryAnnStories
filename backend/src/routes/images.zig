const std = @import("std");
const horizon = @import("horizon");
const state = @import("../state.zig");

const ImageRequest = struct {
    prompt: ?[]const u8 = null,
    size: ?[]const u8 = null,
};

const ImageAcceptRequest = struct {
    story_id: ?[]const u8 = null,
    image: ?[]const u8 = null,
    prompt: ?[]const u8 = null,
    kind: ?[]const u8 = null,
    page_index: ?i32 = null,
};

const ImageListRequest = struct {
    story_id: ?[]const u8 = null,
};

const ErrorResponse = struct {
    @"error": []const u8,
};

const AcceptResponse = struct {
    status: []const u8,
    story_id: []const u8,
    file_path: []const u8,
    url: []const u8,
    kind: []const u8,
    page_index: ?i32 = null,
    image_id: ?i64 = null,
};

const ImageListItem = struct {
    id: i64,
    story_id: []const u8,
    url: ?[]const u8,
    source_url: ?[]const u8,
    kind: []const u8,
    page_index: ?i32 = null,
    prompt: ?[]const u8,
    created_at: []const u8,
};

const ImageListResponse = struct {
    status: []const u8,
    images: []const ImageListItem,
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

    var parsed = std.json.parseFromSlice(ImageRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const prompt = parsed.value.prompt orelse "";
    if (prompt.len == 0) {
        try respondError(context, .bad_request, "Prompt is required");
        return;
    }

    const size = parsed.value.size orelse "1024x1024";

    const response_body = app.openai.generateImage(context.allocator, prompt, size) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "OpenAI request failed", @errorName(err));
        return;
    };
    defer context.allocator.free(response_body);

    try context.response.json(response_body);
}

pub fn accept(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.seaweed.isEnabled()) {
        try respondError(context, .internal_server_error, "Seaweed storage is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(ImageAcceptRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const story_id = parsed.value.story_id orelse "";
    const image_ref = parsed.value.image orelse "";
    const kind = parsed.value.kind orelse "cover";
    const page_index = parsed.value.page_index;
    const prompt = parsed.value.prompt;
    if (story_id.len == 0 or image_ref.len == 0) {
        try respondError(context, .bad_request, "Story id and image are required");
        return;
    }
    if (std.mem.eql(u8, kind, "page") and page_index == null) {
        try respondError(context, .bad_request, "Page index is required for page images");
        return;
    }

    var payload = loadImagePayload(context.allocator, image_ref) catch |err| {
        try respondErrorWithDetail(context, .bad_request, "Unable to read image payload", @errorName(err));
        return;
    };
    defer payload.deinit(context.allocator);

    var stored = app.seaweed.storeStoryImage(
        context.allocator,
        story_id,
        payload.bytes,
        payload.content_type,
    ) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to store image", @errorName(err));
        return;
    };
    defer stored.deinit(context.allocator);

    const source_url: ?[]const u8 = if (std.mem.startsWith(u8, image_ref, "http"))
        image_ref
    else
        null;
    var image_id: ?i64 = null;
    if (app.db.isEnabled()) {
        image_id = app.db.createStoryImage(story_id, stored.path, source_url, kind, page_index, prompt) catch null;
    }

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        AcceptResponse{
            .status = "ok",
            .story_id = story_id,
            .file_path = stored.path,
            .url = stored.url,
            .kind = kind,
            .page_index = page_index,
            .image_id = image_id,
        },
        .{},
        buffer.writer(),
    );
    try context.response.json(buffer.items);
}

pub fn list(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(ImageListRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const story_id = parsed.value.story_id orelse "";
    if (story_id.len == 0) {
        try respondError(context, .bad_request, "Story id is required");
        return;
    }

    const records = app.db.listStoryImages(context.allocator, story_id) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to load images", @errorName(err));
        return;
    };
    defer {
        for (records) |*record| record.deinit(context.allocator);
        context.allocator.free(records);
    }

    var items = std.ArrayList(ImageListItem).init(context.allocator);
    defer items.deinit();
    var allocated_urls = std.ArrayList([]u8).init(context.allocator);
    defer {
        for (allocated_urls.items) |url| {
            context.allocator.free(url);
        }
        allocated_urls.deinit();
    }

    for (records) |record| {
        var url: ?[]const u8 = null;
        if (record.file_path.len > 0) {
            if (buildPublicUrl(context.allocator, app.seaweed.public_url, record.file_path)) |value| {
                try allocated_urls.append(value);
                url = value;
            }
        }

        try items.append(.{
            .id = record.id,
            .story_id = record.story_id,
            .url = url,
            .source_url = record.source_url,
            .kind = record.kind,
            .page_index = record.page_index,
            .prompt = record.prompt,
            .created_at = record.created_at,
        });
    }

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        ImageListResponse{ .status = "ok", .images = items.items },
        .{},
        buffer.writer(),
    );
    try context.response.json(buffer.items);
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

fn buildPublicUrl(allocator: std.mem.Allocator, base_url: []const u8, path: []const u8) ?[]u8 {
    if (base_url.len == 0 or path.len == 0) {
        return null;
    }
    const needs_slash = base_url[base_url.len - 1] != '/';
    return std.fmt.allocPrint(allocator, "{s}{s}{s}", .{
        base_url,
        if (needs_slash) "/" else "",
        path,
    }) catch null;
}

const ImagePayload = struct {
    bytes: []u8,
    content_type: []const u8,

    pub fn deinit(self: *ImagePayload, allocator: std.mem.Allocator) void {
        allocator.free(self.bytes);
    }
};

fn loadImagePayload(allocator: std.mem.Allocator, image_ref: []const u8) !ImagePayload {
    if (std.mem.startsWith(u8, image_ref, "data:")) {
        return try decodeDataUrl(allocator, image_ref);
    }

    if (std.mem.startsWith(u8, image_ref, "http://") or std.mem.startsWith(u8, image_ref, "https://")) {
        return try fetchImage(allocator, image_ref);
    }

    return error.InvalidImageReference;
}

fn decodeDataUrl(allocator: std.mem.Allocator, data_url: []const u8) !ImagePayload {
    const comma_index = std.mem.indexOfScalar(u8, data_url, ',') orelse return error.InvalidDataUrl;
    const header = data_url[5..comma_index];
    const encoded = data_url[comma_index + 1 ..];

    var content_type: []const u8 = "image/png";
    if (std.mem.indexOfScalar(u8, header, ';')) |semi| {
        const mime = header[0..semi];
        if (mime.len > 0) {
            content_type = mime;
        }
    }

    const decoded_len = try std.base64.standard.Decoder.calcSizeForSlice(encoded);
    const buffer = try allocator.alloc(u8, decoded_len);
    try std.base64.standard.Decoder.decode(buffer, encoded);

    return .{
        .bytes = buffer,
        .content_type = content_type,
    };
}

fn fetchImage(allocator: std.mem.Allocator, url: []const u8) !ImagePayload {
    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    var response_body = std.ArrayList(u8).init(allocator);
    errdefer response_body.deinit();

    const response = try client.fetch(.{
        .location = .{ .url = url },
        .method = .GET,
        .response_storage = .{ .dynamic = &response_body },
        .max_append_size = 12 * 1024 * 1024,
    });

    if (response.status != .ok) {
        return error.ImageDownloadFailed;
    }

    return .{
        .bytes = try response_body.toOwnedSlice(),
        .content_type = "image/png",
    };
}
