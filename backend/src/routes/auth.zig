const std = @import("std");
const horizon = @import("horizon");
const session = @import("../auth/session.zig");
const state = @import("../state.zig");

const AuthRequest = struct {
    username: ?[]const u8 = null,
    password: ?[]const u8 = null,
};

const AuthResponse = struct {
    status: []const u8,
    user: UserSummary,
    session: SessionSummary,
};

const SessionStatusResponse = struct {
    status: []const u8,
    valid: bool,
    user: ?UserSummary = null,
    session: ?SessionSummary = null,
};

const UserSummary = struct {
    id: i64,
    username: []const u8,
};

const SessionSummary = struct {
    token: []const u8,
    expires_at: i64,
};

const ErrorResponse = struct {
    @"error": []const u8,
};

pub const AuthenticatedUser = session.SessionClaims;
const session_cookie_name = "maryannstories_session";

pub fn sessionStatus(context: *horizon.Context) horizon.Errors.Horizon!void {
    const app = state.getApp();
    const token = extractSessionToken(context) orelse {
        try respondSessionStatus(context, false, null);
        return;
    };

    var claims = session.verify(context.allocator, app.config.session_secret, token) catch {
        try respondSessionStatus(context, false, null);
        return;
    };
    defer claims.deinit(context.allocator);

    try respondSessionStatus(context, true, claims);
}

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
    if (!isValidUsername(username)) {
        try respondError(context, .bad_request, "Username must be 3-48 characters and use only letters, numbers, dot, dash, or underscore");
        return;
    }
    if (passwordValidationMessage(password)) |message| {
        try respondError(context, .bad_request, message);
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
    if (!isValidUsername(username) or !isValidLoginPassword(password)) {
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

pub fn requireAuthenticatedUser(context: *horizon.Context) horizon.Errors.Horizon!?AuthenticatedUser {
    const app = state.getApp();
    const token = extractSessionToken(context) orelse {
        try respondError(context, .unauthorized, "Please sign in to continue");
        return null;
    };

    return session.verify(context.allocator, app.config.session_secret, token) catch |err| switch (err) {
        error.ExpiredToken => {
            try respondError(context, .unauthorized, "Your session expired. Please sign in again");
            return null;
        },
        else => {
            try respondError(context, .unauthorized, "Invalid session token");
            return null;
        },
    };
}

pub fn logout(context: *horizon.Context) horizon.Errors.Horizon!void {
    try context.response.setHeader("Set-Cookie", clearedSessionCookie());

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    try std.json.stringify(.{
        .status = "ok",
    }, .{}, buffer.writer());
    try context.response.json(buffer.items);
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
    const app = state.getApp();
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();
    var issued = session.issue(
        context.allocator,
        app.config.session_secret,
        user_id,
        username,
        app.config.session_duration_seconds,
    ) catch {
        try respondError(context, .internal_server_error, "Failed to create session");
        return;
    };
    defer issued.deinit(context.allocator);

    const payload = AuthResponse{
        .status = "ok",
        .user = .{
            .id = user_id,
            .username = username,
        },
        .session = .{
            .token = issued.token,
            .expires_at = issued.expires_at,
        },
    };

    const cookie = try buildSessionCookie(context.allocator, issued.token, app.config.session_duration_seconds);
    defer context.allocator.free(cookie);
    try context.response.setHeader("Set-Cookie", cookie);

    try std.json.stringify(payload, .{}, buffer.writer());
    try context.response.json(buffer.items);
}

fn respondSessionStatus(
    context: *horizon.Context,
    valid: bool,
    claims: ?session.SessionClaims,
) horizon.Errors.Horizon!void {
    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    const payload = SessionStatusResponse{
        .status = "ok",
        .valid = valid,
        .user = if (claims) |value|
            .{
                .id = value.user_id,
                .username = value.username,
            }
        else
            null,
        .session = if (claims) |value|
            .{
                .token = "",
                .expires_at = value.expires_at,
            }
        else
            null,
    };

    try std.json.stringify(payload, .{}, buffer.writer());
    try context.response.json(buffer.items);
}

fn respondError(context: *horizon.Context, status: horizon.StatusCode, message: []const u8) horizon.Errors.Horizon!void {
    logRouteError(context, status, message, null);

    var buffer = std.ArrayList(u8).init(context.allocator);
    defer buffer.deinit();

    try std.json.stringify(ErrorResponse{ .@"error" = message }, .{}, buffer.writer());
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
        std.log.err("[auth] {s} {s}: {s} ({s})", .{
            @tagName(context.request.method),
            @tagName(status),
            message,
            value,
        });
        return;
    }

    std.log.err("[auth] {s} {s}: {s}", .{
        @tagName(context.request.method),
        @tagName(status),
        message,
    });
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
    return passwordValidationMessage(password) == null;
}

fn isValidLoginPassword(password: []const u8) bool {
    return password.len >= 1 and password.len <= 128;
}

fn passwordValidationMessage(password: []const u8) ?[]const u8 {
    if (password.len < 8 or password.len > 128) {
        return "Password must be between 8 and 128 characters";
    }

    var has_upper = false;
    var has_lower = false;
    var has_digit = false;
    var has_symbol = false;
    for (password) |c| {
        if (std.ascii.isUpper(c)) {
            has_upper = true;
            continue;
        }
        if (std.ascii.isLower(c)) {
            has_lower = true;
            continue;
        }
        if (std.ascii.isDigit(c)) {
            has_digit = true;
            continue;
        }
        if (!std.ascii.isWhitespace(c)) {
            has_symbol = true;
        }
    }

    if (!has_upper or !has_lower or !has_digit or !has_symbol) {
        return "Password must include uppercase, lowercase, number, and symbol characters";
    }
    return null;
}

fn parseBearerToken(header: []const u8) ?[]const u8 {
    const prefix = "Bearer ";
    if (!std.mem.startsWith(u8, header, prefix)) return null;
    const token = std.mem.trim(u8, header[prefix.len..], " \t\r\n");
    if (token.len == 0) return null;
    return token;
}

fn extractSessionToken(context: *horizon.Context) ?[]const u8 {
    if (context.request.getHeader("Authorization")) |auth_header| {
        if (parseBearerToken(auth_header)) |token| {
            return token;
        }
    }

    if (context.request.getHeader("Cookie")) |cookie_header| {
        return parseCookie(cookie_header, session_cookie_name);
    }

    return null;
}

fn parseCookie(cookie_header: []const u8, name: []const u8) ?[]const u8 {
    var iter = std.mem.splitScalar(u8, cookie_header, ';');
    while (iter.next()) |part| {
        const cookie = std.mem.trim(u8, part, " \t");
        if (cookie.len <= name.len + 1) continue;
        if (!std.mem.startsWith(u8, cookie, name)) continue;
        if (cookie[name.len] != '=') continue;
        const value = std.mem.trim(u8, cookie[name.len + 1 ..], " \t");
        if (value.len == 0) return null;
        return value;
    }
    return null;
}

fn buildSessionCookie(
    allocator: std.mem.Allocator,
    token: []const u8,
    max_age_seconds: i64,
) ![]u8 {
    return std.fmt.allocPrint(
        allocator,
        "{s}={s}; Path=/; HttpOnly; SameSite=Lax; Max-Age={d}",
        .{ session_cookie_name, token, max_age_seconds },
    );
}

fn clearedSessionCookie() []const u8 {
    return session_cookie_name ++ "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
