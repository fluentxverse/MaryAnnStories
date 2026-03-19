const std = @import("std");

const SessionPayload = struct {
    sub: i64,
    usr: []const u8,
    exp: i64,
};

pub const SessionClaims = struct {
    user_id: i64,
    username: []u8,
    expires_at: i64,

    pub fn deinit(self: *SessionClaims, allocator: std.mem.Allocator) void {
        allocator.free(self.username);
    }
};

pub const IssuedSession = struct {
    token: []u8,
    expires_at: i64,

    pub fn deinit(self: *IssuedSession, allocator: std.mem.Allocator) void {
        allocator.free(self.token);
    }
};

pub fn issue(
    allocator: std.mem.Allocator,
    secret: []const u8,
    user_id: i64,
    username: []const u8,
    duration_seconds: i64,
) !IssuedSession {
    const now = std.time.timestamp();
    const expires_at = now + duration_seconds;
    const payload_json = try std.json.stringifyAlloc(
        allocator,
        SessionPayload{
            .sub = user_id,
            .usr = username,
            .exp = expires_at,
        },
        .{},
    );
    defer allocator.free(payload_json);

    const token = try signPayload(allocator, secret, payload_json);
    return .{
        .token = token,
        .expires_at = expires_at,
    };
}

pub fn verify(
    allocator: std.mem.Allocator,
    secret: []const u8,
    token: []const u8,
) !SessionClaims {
    const dot_index = std.mem.indexOfScalar(u8, token, '.') orelse return error.InvalidToken;
    const payload_part = token[0..dot_index];
    const signature_part = token[dot_index + 1 ..];
    if (payload_part.len == 0 or signature_part.len == 0) return error.InvalidToken;

    const payload_len = try std.base64.url_safe_no_pad.Decoder.calcSizeForSlice(payload_part);
    const payload_json = try allocator.alloc(u8, payload_len);
    defer allocator.free(payload_json);
    _ = try std.base64.url_safe_no_pad.Decoder.decode(payload_json, payload_part);

    const signature_len = try std.base64.url_safe_no_pad.Decoder.calcSizeForSlice(signature_part);
    if (signature_len != 32) return error.InvalidToken;
    var actual_signature: [32]u8 = undefined;
    _ = try std.base64.url_safe_no_pad.Decoder.decode(actual_signature[0..], signature_part);

    var expected_signature: [32]u8 = undefined;
    std.crypto.auth.hmac.sha2.HmacSha256.create(&expected_signature, payload_json, secret);
    if (!std.crypto.timing_safe.eql([32]u8, actual_signature, expected_signature)) {
        return error.InvalidToken;
    }

    var parsed = try std.json.parseFromSlice(SessionPayload, allocator, payload_json, .{
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    if (parsed.value.usr.len == 0 or parsed.value.exp <= std.time.timestamp()) {
        return error.ExpiredToken;
    }

    return .{
        .user_id = parsed.value.sub,
        .username = try allocator.dupe(u8, parsed.value.usr),
        .expires_at = parsed.value.exp,
    };
}

fn signPayload(
    allocator: std.mem.Allocator,
    secret: []const u8,
    payload_json: []const u8,
) ![]u8 {
    const payload_len = std.base64.url_safe_no_pad.Encoder.calcSize(payload_json.len);
    const payload_encoded = try allocator.alloc(u8, payload_len);
    defer allocator.free(payload_encoded);
    _ = std.base64.url_safe_no_pad.Encoder.encode(payload_encoded, payload_json);

    var signature: [32]u8 = undefined;
    std.crypto.auth.hmac.sha2.HmacSha256.create(&signature, payload_json, secret);

    const signature_len = std.base64.url_safe_no_pad.Encoder.calcSize(signature.len);
    const signature_encoded = try allocator.alloc(u8, signature_len);
    defer allocator.free(signature_encoded);
    _ = std.base64.url_safe_no_pad.Encoder.encode(signature_encoded, signature[0..]);

    return std.fmt.allocPrint(allocator, "{s}.{s}", .{
        payload_encoded,
        signature_encoded,
    });
}

test "issue and verify session token" {
    const allocator = std.testing.allocator;
    var issued = try issue(allocator, "unit-test-secret", 42, "maryann", 3600);
    defer issued.deinit(allocator);

    var claims = try verify(allocator, "unit-test-secret", issued.token);
    defer claims.deinit(allocator);

    try std.testing.expectEqual(@as(i64, 42), claims.user_id);
    try std.testing.expectEqualStrings("maryann", claims.username);
    try std.testing.expect(claims.expires_at > std.time.timestamp());
}

test "rejects tampered session token" {
    const allocator = std.testing.allocator;
    var issued = try issue(allocator, "unit-test-secret", 7, "maryann", 3600);
    defer issued.deinit(allocator);

    const tampered = try std.fmt.allocPrint(allocator, "{s}x", .{issued.token});
    defer allocator.free(tampered);

    try std.testing.expectError(error.InvalidToken, verify(allocator, "unit-test-secret", tampered));
}
