const std = @import("std");
const horizon = @import("horizon");
const auth_route = @import("auth.zig");
const state = @import("../state.zig");

const ErrorResponse = struct {
    @"error": []const u8,
};

const StoryUpsertRequest = struct {
    id: ?[]const u8 = null,
    username: ?[]const u8 = null,
    title: ?[]const u8 = null,
    summary: ?[]const u8 = null,
    prompt: ?[]const u8 = null,
    status: ?[]const u8 = null,
    ready: ?bool = null,
    published: ?bool = null,
    builder: ?std.json.Value = null,
    image_settings: ?std.json.Value = null,
    story_plan: ?std.json.Value = null,
    final_story: ?std.json.Value = null,
    draft_response_text: ?[]const u8 = null,
    image_results: ?std.json.Value = null,
};

const StoryListRequest = struct {
    username: ?[]const u8 = null,
    page: ?i64 = null,
    page_size: ?i64 = null,
};

const StoryDeleteRequest = struct {
    id: ?[]const u8 = null,
    username: ?[]const u8 = null,
};

const StoryUpsertResponse = struct {
    status: []const u8,
    id: []const u8,
    created_at: []const u8,
    updated_at: []const u8,
};

const StoryListResponse = struct {
    status: []const u8,
    has_more: bool,
    stories: []const StoryResponse,
};

const StoryResponse = struct {
    id: []const u8,
    username: []const u8,
    title: ?[]const u8,
    summary: ?[]const u8,
    prompt: ?[]const u8,
    status: []const u8,
    ready: bool,
    published: bool,
    builder_json: ?[]const u8,
    image_settings_json: ?[]const u8,
    story_plan_json: ?[]const u8,
    final_story_json: ?[]const u8,
    draft_response_text: ?[]const u8,
    image_results_json: ?[]const u8,
    created_at: []const u8,
    updated_at: []const u8,
};

const SanitizedStoryJson = struct {
    image_settings_json: ?[]u8,
    image_results_json: ?[]u8,

    fn deinit(self: *SanitizedStoryJson, allocator: std.mem.Allocator) void {
        if (self.image_settings_json) |bytes| allocator.free(bytes);
        if (self.image_results_json) |bytes| allocator.free(bytes);
    }
};

pub fn upsert(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(StoryUpsertRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

    const id = parsed.value.id orelse "";
    const requested_username = parsed.value.username orelse "";
    if (id.len == 0) {
        try respondError(context, .bad_request, "Story id is required");
        return;
    }
    if (requested_username.len > 0 and !std.mem.eql(u8, requested_username, auth_user.username)) {
        try respondError(context, .forbidden, "You can only save stories for your own account");
        return;
    }

    const builder_json = try stringifyOptional(context.allocator, parsed.value.builder);
    defer freeOptional(context.allocator, builder_json);
    const image_settings_json = try stringifyOptional(context.allocator, parsed.value.image_settings);
    defer freeOptional(context.allocator, image_settings_json);
    const story_plan_json = try stringifyOptional(context.allocator, parsed.value.story_plan);
    defer freeOptional(context.allocator, story_plan_json);
    const final_story_json = try stringifyOptional(context.allocator, parsed.value.final_story);
    defer freeOptional(context.allocator, final_story_json);
    const image_results_json = try stringifyOptional(context.allocator, parsed.value.image_results);
    defer freeOptional(context.allocator, image_results_json);

    const status = parsed.value.status orelse "draft";
    const ready = parsed.value.ready orelse false;
    const published = parsed.value.published orelse false;

    var timestamps = app.db.upsertStory(.{
        .allocator = context.allocator,
        .id = id,
        .username = auth_user.username,
        .title = parsed.value.title,
        .summary = parsed.value.summary,
        .prompt = parsed.value.prompt,
        .status = status,
        .ready = ready,
        .published = published,
        .builder_json = builder_json,
        .image_settings_json = image_settings_json,
        .story_plan_json = story_plan_json,
        .final_story_json = final_story_json,
        .draft_response_text = parsed.value.draft_response_text,
        .image_results_json = image_results_json,
    }) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to save story", @errorName(err));
        return;
    };
    defer timestamps.deinit(context.allocator);

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        StoryUpsertResponse{
            .status = "ok",
            .id = id,
            .created_at = timestamps.created_at,
            .updated_at = timestamps.updated_at,
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

    var parsed = std.json.parseFromSlice(StoryListRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

    const requested_username = parsed.value.username orelse "";
    if (requested_username.len > 0 and !std.mem.eql(u8, requested_username, auth_user.username)) {
        try respondError(context, .forbidden, "You can only load stories for your own account");
        return;
    }

    const page = parsed.value.page orelse 0;
    const page_size = parsed.value.page_size orelse 12;
    const offset = if (page <= 0) 0 else page * page_size;

    var list_result = app.db.listStories(context.allocator, auth_user.username, page_size, offset) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to load stories", @errorName(err));
        return;
    };
    defer list_result.deinit(context.allocator);

    var stories = std.ArrayList(StoryResponse).init(context.allocator);
    defer stories.deinit();
    var sanitized_values = std.ArrayList(SanitizedStoryJson).init(context.allocator);
    defer {
        for (sanitized_values.items) |*value| value.deinit(context.allocator);
        sanitized_values.deinit();
    }

    for (list_result.items) |item| {
        const sanitized = try sanitizeStoryJsonForList(
            context.allocator,
            context,
            item.image_settings_json,
            item.image_results_json,
        );
        try sanitized_values.append(sanitized);

        try stories.append(.{
            .id = item.id,
            .username = item.username,
            .title = item.title,
            .summary = item.summary,
            .prompt = item.prompt,
            .status = item.status,
            .ready = item.ready,
            .published = item.published,
            .builder_json = item.builder_json,
            .image_settings_json = sanitized.image_settings_json,
            .story_plan_json = item.story_plan_json,
            .final_story_json = item.final_story_json,
            .draft_response_text = item.draft_response_text,
            .image_results_json = sanitized.image_results_json,
            .created_at = item.created_at,
            .updated_at = item.updated_at,
        });
    }

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        StoryListResponse{
            .status = "ok",
            .has_more = list_result.has_more,
            .stories = stories.items,
        },
        .{},
        buffer.writer(),
    );
    try context.response.json(buffer.items);
}

pub fn listPublished(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(StoryListRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    const page = parsed.value.page orelse 0;
    const page_size = parsed.value.page_size orelse 12;
    const offset = if (page <= 0) 0 else page * page_size;

    var list_result = app.db.listPublishedStories(context.allocator, page_size, offset) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to load published stories", @errorName(err));
        return;
    };
    defer list_result.deinit(context.allocator);

    var stories = std.ArrayList(StoryResponse).init(context.allocator);
    defer stories.deinit();
    var sanitized_values = std.ArrayList(SanitizedStoryJson).init(context.allocator);
    defer {
        for (sanitized_values.items) |*value| value.deinit(context.allocator);
        sanitized_values.deinit();
    }

    for (list_result.items) |item| {
        const sanitized = try sanitizeStoryJsonForList(
            context.allocator,
            context,
            item.image_settings_json,
            item.image_results_json,
        );
        try sanitized_values.append(sanitized);

        try stories.append(.{
            .id = item.id,
            .username = item.username,
            .title = item.title,
            .summary = item.summary,
            .prompt = item.prompt,
            .status = item.status,
            .ready = item.ready,
            .published = item.published,
            .builder_json = item.builder_json,
            .image_settings_json = sanitized.image_settings_json,
            .story_plan_json = item.story_plan_json,
            .final_story_json = item.final_story_json,
            .draft_response_text = item.draft_response_text,
            .image_results_json = sanitized.image_results_json,
            .created_at = item.created_at,
            .updated_at = item.updated_at,
        });
    }

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(
        StoryListResponse{
            .status = "ok",
            .has_more = list_result.has_more,
            .stories = stories.items,
        },
        .{},
        buffer.writer(),
    );
    try context.response.json(buffer.items);
}

pub fn delete(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database is not configured");
        return;
    }

    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return;
    }

    var parsed = std.json.parseFromSlice(StoryDeleteRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return;
    };
    defer parsed.deinit();

    var auth_user = (try auth_route.requireAuthenticatedUser(context)) orelse return;
    defer auth_user.deinit(context.allocator);

    const id = parsed.value.id orelse "";
    if (id.len == 0) {
        try respondError(context, .bad_request, "Story id is required");
        return;
    }

    if (parsed.value.username) |requested_username| {
        if (requested_username.len > 0 and !std.mem.eql(u8, requested_username, auth_user.username)) {
            try respondError(context, .forbidden, "You can only delete your own stories");
            return;
        }
    }

    app.db.deleteStory(id, auth_user.username) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to delete story", @errorName(err));
        return;
    };

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(.{ .status = "ok" }, .{}, buffer.writer());
    try context.response.json(buffer.items);
}

fn stringifyOptional(allocator: std.mem.Allocator, value: ?std.json.Value) !?[]const u8 {
    if (value == null) return null;
    var buffer = std.ArrayList(u8).init(allocator);
    errdefer buffer.deinit();
    try std.json.stringify(value.?, .{}, buffer.writer());
    const owned = try buffer.toOwnedSlice();
    return @as([]const u8, owned);
}

fn freeOptional(allocator: std.mem.Allocator, value: ?[]const u8) void {
    if (value) |bytes| {
        allocator.free(bytes);
    }
}

fn sanitizeStoryJsonForList(
    allocator: std.mem.Allocator,
    context: *horizon.Context,
    image_settings_json: ?[]const u8,
    image_results_json: ?[]const u8,
) !SanitizedStoryJson {
    return .{
        .image_settings_json = try stripStoryListImageSettings(allocator, image_settings_json),
        .image_results_json = try stripStoryListImageResults(allocator, context, image_results_json),
    };
}

fn stripStoryListImageSettings(
    allocator: std.mem.Allocator,
    raw_json: ?[]const u8,
) !?[]u8 {
    const value = raw_json orelse return null;
    if (value.len == 0) return null;

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, value, .{
        .ignore_unknown_fields = true,
    }) catch return try allocator.dupe(u8, value);
    defer parsed.deinit();

    if (parsed.value != .object) {
        return try allocator.dupe(u8, value);
    }

    _ = parsed.value.object.swapRemove("imageHistory");
    _ = parsed.value.object.swapRemove("qaReviewNotes");

    var buffer = std.ArrayList(u8).init(allocator);
    errdefer buffer.deinit();
    try std.json.stringify(parsed.value, .{}, buffer.writer());
    return try buffer.toOwnedSlice();
}

fn stripStoryListImageResults(
    allocator: std.mem.Allocator,
    context: *horizon.Context,
    raw_json: ?[]const u8,
) !?[]u8 {
    const value = raw_json orelse return null;
    if (value.len == 0) return null;

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, value, .{
        .ignore_unknown_fields = true,
    }) catch return try allocator.dupe(u8, value);
    defer parsed.deinit();

    if (parsed.value != .object) {
        return try allocator.dupe(u8, value);
    }

    var iterator = parsed.value.object.iterator();
    while (iterator.next()) |entry| {
        if (entry.value_ptr.* != .object) continue;
        if (entry.value_ptr.object.getPtr("imageUrl")) |image_url| {
            if (image_url.* == .string and std.mem.startsWith(u8, image_url.string, "data:")) {
                image_url.* = .null;
            } else if (image_url.* == .string) {
                if (buildClientImageProxyUrl(allocator, context, image_url.string)) |client_url| {
                    image_url.* = .{ .string = client_url };
                }
            }
        }
        if (entry.value_ptr.object.getPtr("storedUrl")) |stored_url| {
            if (stored_url.* == .string) {
                if (buildClientImageProxyUrl(allocator, context, stored_url.string)) |client_url| {
                    stored_url.* = .{ .string = client_url };
                }
            }
        }
    }

    var buffer = std.ArrayList(u8).init(allocator);
    errdefer buffer.deinit();
    try std.json.stringify(parsed.value, .{}, buffer.writer());
    return try buffer.toOwnedSlice();
}

fn buildClientImageProxyUrl(
    allocator: std.mem.Allocator,
    context: *horizon.Context,
    source_url: []const u8,
) ?[]u8 {
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
