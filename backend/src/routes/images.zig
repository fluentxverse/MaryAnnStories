const std = @import("std");
const horizon = @import("horizon");
const auth_route = @import("auth.zig");
const gemini = @import("../ai/gemini.zig");
const state = @import("../state.zig");

const ImageRequest = struct {
    prompt: ?[]const u8 = null,
    size: ?[]const u8 = null,
    aspect_ratio: ?[]const u8 = null,
    image_size: ?[]const u8 = null,
    negative_prompt: ?[]const u8 = null,
    reference_image: ?[]const u8 = null,
    reference_images: ?[][]const u8 = null,
    image_provider: ?[]const u8 = null,
    image_model: ?[]const u8 = null,
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

const ImageResetRequest = struct {
    story_id: ?[]const u8 = null,
};

const ImageProxyRequest = struct {
    url: ?[]const u8 = null,
    max_width: ?u32 = null,
    max_height: ?u32 = null,
    quality: ?u8 = null,
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

const ImageResetResponse = struct {
    status: []const u8,
    story_id: []const u8,
};

pub fn generate(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

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
    const negative_prompt = parsed.value.negative_prompt;
    const reference_image = parsed.value.reference_image;
    const reference_images = parsed.value.reference_images;
    const provider = resolveImageProvider(parsed.value.image_provider, app.image_provider);
    const requested_image_model = parsed.value.image_model;
    const use_gemini = isGeminiProvider(provider);
    if (use_gemini) {
        if (!app.gemini.isEnabled()) {
            try respondError(context, .internal_server_error, "Gemini API key is missing");
            return;
        }
    } else if (!app.openai.isEnabled()) {
        try respondError(context, .internal_server_error, "OpenAI API key is missing");
        return;
    }

    if (use_gemini) {
        const aspect_ratio = mapAspectRatioLabel(parsed.value.aspect_ratio) orelse mapSizeToAspectRatio(size);
        var reference_payloads = std.ArrayList(ImagePayload).init(context.allocator);
        defer {
            for (reference_payloads.items) |*payload| payload.deinit(context.allocator);
            reference_payloads.deinit();
        }
        var reference_inputs = std.ArrayList(gemini.ReferenceImage).init(context.allocator);
        defer reference_inputs.deinit();

        if (reference_images) |image_refs| {
            for (image_refs) |image_ref| {
                if (image_ref.len == 0) continue;
                const normalized_reference: ?[]u8 = normalizeSeaweedImageReference(
                    context.allocator,
                    app.seaweed.public_url,
                    app.seaweed.filer_endpoint,
                    image_ref,
                ) catch null;
                defer if (normalized_reference) |value| context.allocator.free(value);

                const effective_reference = normalized_reference orelse image_ref;
                const payload = loadImagePayload(context.allocator, effective_reference) catch |err| {
                    try respondErrorWithDetail(context, .bad_request, "Unable to read reference image", @errorName(err));
                    return;
                };
                try reference_payloads.append(payload);
                try reference_inputs.append(.{
                    .bytes = payload.bytes,
                    .mime_type = payload.content_type,
                });
            }
        } else if (reference_image) |image_ref| {
            if (image_ref.len > 0) {
                const normalized_reference: ?[]u8 = normalizeSeaweedImageReference(
                    context.allocator,
                    app.seaweed.public_url,
                    app.seaweed.filer_endpoint,
                    image_ref,
                ) catch null;
                defer if (normalized_reference) |value| context.allocator.free(value);

                const effective_reference = normalized_reference orelse image_ref;
                const payload = loadImagePayload(context.allocator, effective_reference) catch |err| {
                    try respondErrorWithDetail(context, .bad_request, "Unable to read reference image", @errorName(err));
                    return;
                };
                try reference_payloads.append(payload);
                try reference_inputs.append(.{
                    .bytes = payload.bytes,
                    .mime_type = payload.content_type,
                });
            }
        }

        const response_body = app.gemini.generateImage(
            context.allocator,
            prompt,
            aspect_ratio,
            parsed.value.image_size,
            negative_prompt,
            reference_inputs.items,
            requested_image_model,
        ) catch |err| {
            try respondErrorWithDetail(context, .internal_server_error, "Gemini request failed", @errorName(err));
            return;
        };
        defer context.allocator.free(response_body);

        if (normalizeGeminiImageResponse(context.allocator, response_body)) |normalized| {
            defer context.allocator.free(normalized);
            try context.response.json(normalized);
            return;
        }

        try context.response.json(response_body);
        return;
    }

    const response_body = app.openai.generateImage(
        context.allocator,
        prompt,
        size,
        requested_image_model,
    ) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "OpenAI request failed", @errorName(err));
        return;
    };
    defer context.allocator.free(response_body);

    try context.response.json(response_body);
}

pub fn accept(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

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
    if (!try ensureStoryOwnership(context, story_id, auth_user.username)) {
        return;
    }

    const normalized_image_ref = normalizeSeaweedImageReference(
        context.allocator,
        app.seaweed.public_url,
        app.seaweed.filer_endpoint,
        image_ref,
    ) catch null;
    defer if (normalized_image_ref) |value| context.allocator.free(value);

    var payload = loadImagePayload(context.allocator, normalized_image_ref orelse image_ref) catch |err| {
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
    const client_url = buildClientImageUrl(context.allocator, context, stored.url) orelse stored.url;
    try std.json.stringify(
        AcceptResponse{
            .status = "ok",
            .story_id = story_id,
            .file_path = stored.path,
            .url = client_url,
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
    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

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
    if (!try ensureStoryOwnership(context, story_id, auth_user.username)) {
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
                if (buildClientImageUrl(context.allocator, context, value)) |client_value| {
                    try allocated_urls.append(client_value);
                    url = client_value;
                    context.allocator.free(value);
                } else {
                    try allocated_urls.append(value);
                    url = value;
                }
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

pub fn reset(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(ImageResetRequest, context.allocator, context.request.body, .{
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
    if (!try ensureStoryOwnership(context, story_id, auth_user.username)) {
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

    if (app.seaweed.isEnabled()) {
        for (records) |record| {
            app.seaweed.deleteStoryImage(context.allocator, record.file_path) catch {};
        }
    }

    app.db.resetStoryImages(story_id) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to reset images", @errorName(err));
        return;
    };

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        ImageResetResponse{
            .status = "ok",
            .story_id = story_id,
        },
        .{},
        buffer.writer(),
    );
    try context.response.json(buffer.items);
}

pub fn proxy(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

    var parsed: ?std.json.Parsed(ImageProxyRequest) = null;
    defer if (parsed) |*value| value.deinit();
    var decoded_query_url: ?[]u8 = null;
    defer if (decoded_query_url) |value| context.allocator.free(value);

    const url = blk: {
        if (context.request.method == .GET) {
            const raw_url = context.request.getQuery("url") orelse "";
            decoded_query_url = decodeQueryParamValue(context.allocator, raw_url) catch null;
            break :blk decoded_query_url orelse raw_url;
        }

        if (context.request.body.len == 0) {
            try respondError(context, .bad_request, "Missing JSON body");
            return;
        }

        parsed = std.json.parseFromSlice(ImageProxyRequest, context.allocator, context.request.body, .{
            .ignore_unknown_fields = true,
        }) catch {
            try respondError(context, .bad_request, "Invalid JSON body");
            return;
        };
        break :blk parsed.?.value.url orelse "";
    };
    if (url.len == 0) {
        try respondError(context, .bad_request, "Image url is required");
        return;
    }

    const max_width = blk: {
        if (context.request.method == .GET) {
            if (context.request.getQuery("max_width")) |value| {
                break :blk std.fmt.parseInt(u32, value, 10) catch null;
            }
            break :blk null;
        }
        break :blk parsed.?.value.max_width;
    };
    const max_height = blk: {
        if (context.request.method == .GET) {
            if (context.request.getQuery("max_height")) |value| {
                break :blk std.fmt.parseInt(u32, value, 10) catch null;
            }
            break :blk null;
        }
        break :blk parsed.?.value.max_height;
    };
    const quality = blk: {
        if (context.request.method == .GET) {
            if (context.request.getQuery("quality")) |value| {
                break :blk std.fmt.parseInt(u8, value, 10) catch null;
            }
            break :blk null;
        }
        break :blk parsed.?.value.quality;
    };

    const normalized_reference = normalizeSeaweedImageReference(
        context.allocator,
        app.seaweed.public_url,
        app.seaweed.filer_endpoint,
        url,
    ) catch null;
    defer if (normalized_reference) |value| context.allocator.free(value);

    const effective_url = normalized_reference orelse url;
    var payload = loadImagePayload(context.allocator, effective_url) catch |err| {
        try respondErrorWithDetail(context, .bad_request, "Unable to read proxied image", @errorName(err));
        return;
    };
    defer payload.deinit(context.allocator);

    var preview_payload: ?ImagePayload = null;
    defer if (preview_payload) |*value| value.deinit(context.allocator);

    if ((max_width orelse 0) > 0 or (max_height orelse 0) > 0) {
        preview_payload = resizeImagePreview(
            context.allocator,
            payload,
            max_width,
            max_height,
            quality,
        ) catch null;
    }

    const response_payload = if (preview_payload) |value| value else payload;

    try context.response.setHeader("Content-Type", response_payload.content_type);
    try context.response.setHeader(
        "Cache-Control",
        "private, max-age=86400, stale-while-revalidate=604800, immutable",
    );
    try context.response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    try context.response.setBody(response_payload.bytes);
}

fn ensureStoryOwnership(
    context: *horizon.Context,
    story_id: []const u8,
    username: []const u8,
) horizon.Errors.Horizon!bool {
    const app = state.getApp();
    const belongs_to_user = app.db.storyBelongsToUser(story_id, username) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to verify story ownership", @errorName(err));
        return false;
    };
    if (!belongs_to_user) {
        try respondError(context, .forbidden, "You can only access images for your own stories");
        return false;
    }
    return true;
}

const NormalizedImageEntry = struct {
    b64_json: []const u8,
};

const NormalizedImageResponse = struct {
    data: []const NormalizedImageEntry,
};

fn mapSizeToAspectRatio(size: []const u8) ?[]const u8 {
    if (size.len == 0) return null;
    if (std.mem.eql(u8, size, "1024x1792")) return "9:16";
    if (std.mem.eql(u8, size, "1792x1024")) return "16:9";
    if (std.mem.eql(u8, size, "1024x1024")) return "1:1";
    return null;
}

fn mapAspectRatioLabel(label: ?[]const u8) ?[]const u8 {
    const value = label orelse return null;
    if (value.len == 0) return null;
    if (containsIgnoreCase(value, "1:1")) return "1:1";
    if (containsIgnoreCase(value, "16:9")) return "16:9";
    if (containsIgnoreCase(value, "9:16")) return "9:16";
    if (containsIgnoreCase(value, "3:4")) return "3:4";
    if (containsIgnoreCase(value, "4:3")) return "4:3";
    if (containsIgnoreCase(value, "5:4")) return "4:3";
    if (containsIgnoreCase(value, "4:5")) return "3:4";
    if (containsIgnoreCase(value, "7:9")) return "3:4";
    if (containsIgnoreCase(value, "16:10")) return "3:2";
    if (containsIgnoreCase(value, "8:5")) return "3:2";
    if (containsIgnoreCase(value, "3:2")) return "3:2";
    if (containsIgnoreCase(value, "2:3")) return "2:3";
    return null;
}

fn containsIgnoreCase(haystack: []const u8, needle: []const u8) bool {
    if (needle.len == 0) return true;
    if (needle.len > haystack.len) return false;
    const max_start = haystack.len - needle.len;
    var i: usize = 0;
    while (i <= max_start) : (i += 1) {
        var matched = true;
        var j: usize = 0;
        while (j < needle.len) : (j += 1) {
            if (std.ascii.toLower(haystack[i + j]) != std.ascii.toLower(needle[j])) {
                matched = false;
                break;
            }
        }
        if (matched) return true;
    }
    return false;
}

fn resolveImageProvider(requested: ?[]const u8, fallback: []const u8) []const u8 {
    if (requested) |value| {
        if (isGeminiProvider(value) or isOpenAiProvider(value)) {
            return value;
        }
    }
    return fallback;
}

fn isGeminiProvider(value: []const u8) bool {
    return std.ascii.eqlIgnoreCase(value, "gemini");
}

fn isOpenAiProvider(value: []const u8) bool {
    return std.ascii.eqlIgnoreCase(value, "openai");
}

fn normalizeGeminiImageResponse(allocator: std.mem.Allocator, payload: []const u8) ?[]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, payload, .{
        .ignore_unknown_fields = true,
    }) catch return null;
    defer parsed.deinit();

    const base64 = extractGeminiBase64(parsed.value) orelse return null;

    var buffer = std.ArrayList(u8).init(allocator);
    errdefer buffer.deinit();

    const entries = [_]NormalizedImageEntry{.{ .b64_json = base64 }};
    std.json.stringify(
        NormalizedImageResponse{ .data = entries[0..] },
        .{},
        buffer.writer(),
    ) catch return null;

    return buffer.toOwnedSlice() catch null;
}

fn extractGeminiBase64(value: std.json.Value) ?[]const u8 {
    if (value != .object) return null;
    if (value.object.get("candidates")) |candidates| {
        if (candidates != .array or candidates.array.items.len == 0) return null;
        for (candidates.array.items) |candidate| {
            if (candidate != .object) continue;
            const content = candidate.object.get("content") orelse continue;
            if (content != .object) continue;
            const parts = content.object.get("parts") orelse continue;
            if (parts != .array) continue;
            for (parts.array.items) |part| {
                if (part != .object) continue;
                if (part.object.get("inlineData")) |inline_data| {
                    if (inline_data == .object) {
                        if (inline_data.object.get("data")) |bytes| {
                            if (bytes == .string) return bytes.string;
                        }
                    }
                }
            }
        }
    }
    if (value.object.get("predictions")) |predictions| {
        if (predictions != .array or predictions.array.items.len == 0) return null;
        const first = predictions.array.items[0];
        if (first != .object) return null;
        if (first.object.get("bytesBase64Encoded")) |bytes| {
            if (bytes == .string) return bytes.string;
        }
        if (first.object.get("imageBytes")) |bytes| {
            if (bytes == .string) return bytes.string;
        }
        if (first.object.get("image")) |image_obj| {
            if (image_obj == .object) {
                if (image_obj.object.get("bytesBase64Encoded")) |bytes| {
                    if (bytes == .string) return bytes.string;
                }
                if (image_obj.object.get("imageBytes")) |bytes| {
                    if (bytes == .string) return bytes.string;
                }
            }
        }
    }
    return null;
}

fn respondError(context: *horizon.Context, status: horizon.StatusCode, message: []const u8) horizon.Errors.Horizon!void {
    logRouteError(context, status, message, null);

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
    logRouteError(context, status, message, detail);

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(.{ .@"error" = message, .detail = detail }, .{}, buffer.writer());
    context.response.setStatus(status);
    try context.response.json(buffer.items);
}

fn logRouteError(
    context: *horizon.Context,
    status: horizon.StatusCode,
    message: []const u8,
    detail: ?[]const u8,
) void {
    if (detail) |value| {
        std.log.err("[images] {s} {s}: {s} ({s})", .{
            @tagName(context.request.method),
            @tagName(status),
            message,
            value,
        });
        return;
    }

    std.log.err("[images] {s} {s}: {s}", .{
        @tagName(context.request.method),
        @tagName(status),
        message,
    });
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

fn buildClientImageUrl(
    allocator: std.mem.Allocator,
    context: *horizon.Context,
    source_url: []const u8,
) ?[]u8 {
    if (source_url.len == 0) return null;
    if (!(std.mem.startsWith(u8, source_url, "http://") or std.mem.startsWith(u8, source_url, "https://"))) {
        return null;
    }

    const origin = resolveRequestOrigin(context) orelse return null;
    return std.fmt.allocPrint(
        allocator,
        "{s}/api/images/proxy?url={query}",
        .{ origin, std.Uri.Component{ .raw = source_url } },
    ) catch null;
}

fn resolveRequestOrigin(context: *horizon.Context) ?[]const u8 {
    const host = context.request.getHeader("Host") orelse context.request.getHeader("host") orelse return null;
    const forwarded_proto = context.request.getHeader("X-Forwarded-Proto") orelse
        context.request.getHeader("x-forwarded-proto");
    const origin_header = context.request.getHeader("Origin") orelse context.request.getHeader("origin");
    const scheme = blk: {
        if (forwarded_proto) |proto| {
            if (proto.len > 0) break :blk proto;
        }
        if (origin_header) |origin| {
            if (std.mem.startsWith(u8, origin, "https://")) break :blk "https";
            if (std.mem.startsWith(u8, origin, "http://")) break :blk "http";
        }
        break :blk "http";
    };

    return std.fmt.allocPrint(context.allocator, "{s}://{s}", .{ scheme, host }) catch null;
}

fn rewriteSeaweedPublicUrlToInternal(
    allocator: std.mem.Allocator,
    public_url: []const u8,
    filer_endpoint: []const u8,
    image_ref: []const u8,
) !?[]u8 {
    if (public_url.len == 0 or filer_endpoint.len == 0) return null;
    if (!std.mem.startsWith(u8, image_ref, public_url)) return null;

    var suffix = image_ref[public_url.len..];
    while (suffix.len > 0 and suffix[0] == '/') {
        suffix = suffix[1..];
    }
    if (suffix.len == 0) return null;

    return buildPublicUrl(allocator, filer_endpoint, suffix);
}

fn normalizeSeaweedImageReference(
    allocator: std.mem.Allocator,
    public_url: []const u8,
    filer_endpoint: []const u8,
    image_ref: []const u8,
) !?[]u8 {
    const raw_reference = if (extractProxyTargetUrl(allocator, image_ref)) |inner_ref|
        inner_ref
    else |err| switch (err) {
        error.NotProxyUrl => null,
        else => return err,
    };
    defer if (raw_reference) |value| allocator.free(value);

    const effective_reference = raw_reference orelse image_ref;

    if (try rewriteSeaweedPublicUrlToInternal(allocator, public_url, filer_endpoint, effective_reference)) |rewritten| {
        return rewritten;
    }

    if (try rewriteLocalSeaweedUrlToInternal(allocator, filer_endpoint, effective_reference)) |rewritten| {
        return rewritten;
    }

    return if (raw_reference) |value| try allocator.dupe(u8, value) else null;
}

fn rewriteLocalSeaweedUrlToInternal(
    allocator: std.mem.Allocator,
    filer_endpoint: []const u8,
    image_ref: []const u8,
) !?[]u8 {
    if (filer_endpoint.len == 0) return null;
    if (!(std.mem.startsWith(u8, image_ref, "http://") or std.mem.startsWith(u8, image_ref, "https://"))) {
        return null;
    }

    const uri = std.Uri.parse(image_ref) catch return null;
    const host = uri.host orelse return null;
    const host_value = switch (host) {
        .raw => |value| value,
        .percent_encoded => |value| value,
    };
    if (!(std.mem.eql(u8, host_value, "localhost") or std.mem.eql(u8, host_value, "127.0.0.1"))) {
        return null;
    }

    const port = uri.port orelse return null;
    if (port != 18888 and port != 8888) {
        return null;
    }

    const path = switch (uri.path) {
        .raw => |value| value,
        .percent_encoded => |value| value,
    };
    var suffix = path;
    while (suffix.len > 0 and suffix[0] == '/') {
        suffix = suffix[1..];
    }
    if (suffix.len == 0) return null;

    return buildPublicUrl(allocator, filer_endpoint, suffix);
}

const ImagePayload = struct {
    bytes: []u8,
    content_type: []const u8,

    pub fn deinit(self: *ImagePayload, allocator: std.mem.Allocator) void {
        allocator.free(self.bytes);
    }
};

fn loadImagePayload(allocator: std.mem.Allocator, image_ref: []const u8) !ImagePayload {
    if (extractProxyTargetUrl(allocator, image_ref)) |inner_ref| {
        defer allocator.free(inner_ref);
        return try loadImagePayload(allocator, inner_ref);
    } else |_| {}

    if (std.mem.startsWith(u8, image_ref, "data:")) {
        return try decodeDataUrl(allocator, image_ref);
    }

    if (std.mem.startsWith(u8, image_ref, "http://") or std.mem.startsWith(u8, image_ref, "https://")) {
        return try fetchImage(allocator, image_ref);
    }

    return error.InvalidImageReference;
}

fn extractProxyTargetUrl(allocator: std.mem.Allocator, image_ref: []const u8) ![]u8 {
    if (!(std.mem.startsWith(u8, image_ref, "http://") or std.mem.startsWith(u8, image_ref, "https://"))) {
        return error.NotProxyUrl;
    }

    const uri = std.Uri.parse(image_ref) catch return error.NotProxyUrl;
    const path = switch (uri.path) {
        .raw => |value| value,
        .percent_encoded => |value| value,
    };
    if (!std.mem.eql(u8, path, "/api/images/proxy")) {
        return error.NotProxyUrl;
    }

    const query_component = uri.query orelse return error.NotProxyUrl;
    const query = switch (query_component) {
        .raw => |value| value,
        .percent_encoded => |value| value,
    };
    const key_index = std.mem.indexOf(u8, query, "url=") orelse return error.NotProxyUrl;
    const encoded_value = query[key_index + 4 ..];
    const value_end = std.mem.indexOfScalar(u8, encoded_value, '&') orelse encoded_value.len;
    const encoded_slice = encoded_value[0..value_end];
    if (encoded_slice.len == 0) return error.NotProxyUrl;

    const buffer = try allocator.dupe(u8, encoded_slice);
    defer allocator.free(buffer);
    const decoded = std.Uri.percentDecodeInPlace(buffer);
    return try allocator.dupe(u8, decoded);
}

fn decodeQueryParamValue(allocator: std.mem.Allocator, value: []const u8) !?[]u8 {
    if (value.len == 0) return null;
    if (std.mem.indexOfScalar(u8, value, '%') == null and std.mem.indexOfScalar(u8, value, '+') == null) {
        return null;
    }

    const buffer = try allocator.dupe(u8, value);
    errdefer allocator.free(buffer);
    for (buffer) |*char| {
        if (char.* == '+') {
            char.* = ' ';
        }
    }
    const decoded = std.Uri.percentDecodeInPlace(buffer);
    if (decoded.len == 0) return null;
    return try allocator.dupe(u8, decoded);
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

fn resizeImagePreview(
    allocator: std.mem.Allocator,
    payload: ImagePayload,
    max_width: ?u32,
    max_height: ?u32,
    quality: ?u8,
) !ImagePayload {
    if (!(std.mem.startsWith(u8, payload.content_type, "image/"))) {
        return error.UnsupportedImageType;
    }

    const ext = extensionForContentType(payload.content_type);
    const token = std.crypto.random.int(u64);
    const input_path = try std.fmt.allocPrint(allocator, "/tmp/maryannstories-preview-{x}.{s}", .{ token, ext });
    defer allocator.free(input_path);
    const output_path = try std.fmt.allocPrint(allocator, "/tmp/maryannstories-preview-{x}.webp", .{ token });
    defer allocator.free(output_path);

    {
        const file = try std.fs.createFileAbsolute(input_path, .{ .truncate = true });
        defer file.close();
        try file.writeAll(payload.bytes);
    }
    defer std.fs.deleteFileAbsolute(input_path) catch {};
    defer std.fs.deleteFileAbsolute(output_path) catch {};

    const preview_max_bytes: usize = 2 * 1024 * 1024;
    var width = max_width orelse 0;
    var height = max_height orelse 0;
    var current_quality = clampQuality(quality orelse 72);
    var attempt: u8 = 0;

    while (attempt < 6) : (attempt += 1) {
        const resize_arg = if (width > 0 and height > 0)
            try std.fmt.allocPrint(allocator, "{d}x{d}>", .{ width, height })
        else if (width > 0)
            try std.fmt.allocPrint(allocator, "{d}x>", .{ width })
        else
            try std.fmt.allocPrint(allocator, "x{d}>", .{ height });
        defer allocator.free(resize_arg);

        const quality_arg = try std.fmt.allocPrint(allocator, "{d}", .{ current_quality });
        defer allocator.free(quality_arg);

        const run_result = std.process.Child.run(.{
            .allocator = allocator,
            .argv = &.{
                "convert",
                input_path,
                "-strip",
                "-auto-orient",
                "-resize",
                resize_arg,
                "-quality",
                quality_arg,
                output_path,
            },
            .max_output_bytes = 32 * 1024,
        }) catch return error.ResizeFailed;
        defer allocator.free(run_result.stdout);
        defer allocator.free(run_result.stderr);

        switch (run_result.term) {
            .Exited => |code| {
                if (code != 0) return error.ResizeFailed;
            },
            else => return error.ResizeFailed,
        }

        const output_file = try std.fs.openFileAbsolute(output_path, .{});
        defer output_file.close();
        const stat = try output_file.stat();

        if (stat.size <= preview_max_bytes or attempt == 5) {
            const output_bytes = try output_file.readToEndAlloc(allocator, @intCast(stat.size));
            return .{
                .bytes = output_bytes,
                .content_type = "image/webp",
            };
        }

        current_quality = if (current_quality > 56) current_quality - 10 else 46;
        width = scalePreviewDimension(width);
        height = scalePreviewDimension(height);
    }

    return error.ResizeFailed;
}

fn scalePreviewDimension(value: u32) u32 {
    if (value == 0) return 0;
    const scaled = @max(@as(u32, 320), (value * 85) / 100);
    return scaled;
}

fn extensionForContentType(content_type: []const u8) []const u8 {
    if (std.mem.eql(u8, content_type, "image/jpeg")) return "jpg";
    if (std.mem.eql(u8, content_type, "image/webp")) return "webp";
    if (std.mem.eql(u8, content_type, "image/gif")) return "gif";
    return "png";
}

fn clampQuality(value: u8) u8 {
    if (value < 20) return 20;
    if (value > 92) return 92;
    return value;
}
