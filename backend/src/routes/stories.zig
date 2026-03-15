const std = @import("std");
const horizon = @import("horizon");
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

    const id = parsed.value.id orelse "";
    const username = parsed.value.username orelse "";
    if (id.len == 0 or username.len == 0) {
        try respondError(context, .bad_request, "Story id and username are required");
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
        .username = username,
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

    const username = parsed.value.username orelse "";
    if (username.len == 0) {
        try respondError(context, .bad_request, "Username is required");
        return;
    }

    const page = parsed.value.page orelse 0;
    const page_size = parsed.value.page_size orelse 12;
    const offset = if (page <= 0) 0 else page * page_size;

    var list_result = app.db.listStories(context.allocator, username, page_size, offset) catch |err| {
        try respondErrorWithDetail(context, .internal_server_error, "Failed to load stories", @errorName(err));
        return;
    };
    defer list_result.deinit(context.allocator);

    var stories = std.ArrayList(StoryResponse).init(context.allocator);
    defer stories.deinit();

    for (list_result.items) |item| {
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
            .image_settings_json = item.image_settings_json,
            .story_plan_json = item.story_plan_json,
            .final_story_json = item.final_story_json,
            .draft_response_text = item.draft_response_text,
            .image_results_json = item.image_results_json,
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

    const id = parsed.value.id orelse "";
    if (id.len == 0) {
        try respondError(context, .bad_request, "Story id is required");
        return;
    }

    app.db.deleteStory(id, parsed.value.username) catch |err| {
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
