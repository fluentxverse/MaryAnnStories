const std = @import("std");
const horizon = @import("horizon");
const state = @import("../state.zig");

const AuthRequest = struct {
    username: ?[]const u8 = null,
    password: ?[]const u8 = null,
};

const AuthResponse = struct {
    status: []const u8,
    user: UserSummary,
};

const UserSummary = struct {
    id: i64,
    username: []const u8,
};

const ErrorResponse = struct {
    @"error": []const u8,
};

pub fn register(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database not configured");
        return;
    }

    var payload = parseAuthPayload(context) catch return;
    defer payload.deinit(context.allocator);

    const username = payload.username;
    const password = payload.password;
    if (!isValidUsername(username) or !isValidPassword(password)) {
        try respondError(context, .bad_request, "Invalid username or password");
        return;
    }

    const password_hash = horizon.hashPassword(context.allocator, password) catch {
        try respondError(context, .internal_server_error, "Failed to hash password");
        return;
    };
    defer context.allocator.free(password_hash);

    const user_id = app.db.createUser(username, password_hash) catch |err| switch (err) {
        error.UserAlreadyExists => {
            try respondError(context, .bad_request, "Username already exists");
            return;
        },
        else => {
            try respondError(context, .internal_server_error, "Failed to create user");
            return;
        },
    };

    context.response.setStatus(.created);
    try respondAuth(context, user_id, username);
}

pub fn login(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    if (!app.db.isEnabled()) {
        try respondError(context, .internal_server_error, "Database not configured");
        return;
    }

    var payload = parseAuthPayload(context) catch return;
    defer payload.deinit(context.allocator);

    const username = payload.username;
    const password = payload.password;
    if (!isValidUsername(username) or !isValidPassword(password)) {
        try respondError(context, .bad_request, "Invalid username or password");
        return;
    }

    var user = app.db.getUserAuth(context.allocator, username) catch {
        try respondError(context, .internal_server_error, "Failed to load user");
        return;
    } orelse {
        try respondError(context, .unauthorized, "Invalid username or password");
        return;
    };
    defer user.deinit(context.allocator);

    if (!horizon.verifyPassword(password, user.password_hash)) {
        try respondError(context, .unauthorized, "Invalid username or password");
        return;
    }

    try respondAuth(context, user.id, user.username);
}

const AuthPayload = struct {
    username: []u8,
    password: []u8,

    pub fn deinit(self: *AuthPayload, allocator: std.mem.Allocator) void {
        allocator.free(self.username);
        allocator.free(self.password);
    }
};

fn parseAuthPayload(context: *horizon.Context) !AuthPayload {
    if (context.request.body.len == 0) {
        try respondError(context, .bad_request, "Missing JSON body");
        return error.InvalidPayload;
    }

    var parsed = std.json.parseFromSlice(AuthRequest, context.allocator, context.request.body, .{
        .ignore_unknown_fields = true,
    }) catch {
        try respondError(context, .bad_request, "Invalid JSON body");
        return error.InvalidPayload;
    };
    const username = parsed.value.username orelse "";
    const password = parsed.value.password orelse "";
    if (username.len == 0 or password.len == 0) {
        parsed.deinit();
        try respondError(context, .bad_request, "Username and password are required");
        return error.InvalidPayload;
    }

    const username_copy = try context.allocator.dupe(u8, username);
    errdefer context.allocator.free(username_copy);
    const password_copy = try context.allocator.dupe(u8, password);
    errdefer context.allocator.free(password_copy);

    parsed.deinit();

    return .{
        .username = username_copy,
        .password = password_copy,
    };
}

fn respondAuth(context: *horizon.Context, user_id: i64, username: []const u8) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    const payload = AuthResponse{
        .status = "ok",
        .user = .{
            .id = user_id,
            .username = username,
        },
    };

    try std.json.stringify(payload, .{}, buffer.writer());
    try context.response.json(buffer.items);
}

fn respondError(context: *horizon.Context, status: horizon.StatusCode, message: []const u8) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(ErrorResponse{ .@"error" = message }, .{}, buffer.writer());
    context.response.setStatus(status);
    try context.response.json(buffer.items);
}

fn isValidUsername(username: []const u8) bool {
    if (username.len < 3 or username.len > 48) return false;
    for (username) |c| {
        if (std.ascii.isAlphanumeric(c) or c == '_' or c == '-' or c == '.') continue;
        return false;
    }
    return true;
}

fn isValidPassword(password: []const u8) bool {
    return password.len >= 6 and password.len <= 128;
}
