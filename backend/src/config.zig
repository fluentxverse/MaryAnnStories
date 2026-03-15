const std = @import("std");

pub const DbConfig = struct {
    enabled: bool,
    database_url: ?[]const u8,
    host: []const u8,
    port: u16,
    user: []const u8,
    password: ?[]const u8,
    database: ?[]const u8,
    pool_size: u16,
    pool_timeout_ms: u32,
};

pub const Config = struct {
    port: u16,
    nullclaw_url: []const u8,
    nullclaw_bearer_token: ?[]const u8,
    openai_api_key: ?[]const u8,
    openai_base_url: []const u8,
    openai_story_model: []const u8,
    openai_image_model: []const u8,
    seaweed_filer_endpoint: []const u8,
    seaweed_public_url: []const u8,
    db: DbConfig,
    env: std.process.EnvMap,

    pub fn deinit(self: *Config) void {
        self.env.deinit();
    }
};

pub fn load(allocator: std.mem.Allocator) !Config {
    var env = try std.process.getEnvMap(allocator);
    errdefer env.deinit();

    try loadDotEnv(&env, allocator, ".env");
    try loadDotEnv(&env, allocator, "../.env");

    const listen_port = parseU16(env.get("PORT") orelse "4000", 4000);
    const nullclaw_url = env.get("NULLCLAW_GATEWAY_URL") orelse "http://127.0.0.1:3000";
    const nullclaw_bearer_token = env.get("NULLCLAW_BEARER_TOKEN");
    const raw_openai_key = env.get("OPENAI_API_KEY");
    const openai_api_key = if (raw_openai_key) |key|
        if (key.len == 0) null else key
    else
        null;
    const openai_base_url = env.get("OPENAI_BASE_URL") orelse "https://api.openai.com/v1";
    const openai_story_model = env.get("OPENAI_STORY_MODEL") orelse "gpt-5.2";
    const openai_image_model = env.get("OPENAI_IMAGE_MODEL") orelse "dall-e-3";
    const seaweed_filer_endpoint = env.get("SEAWEED_FILER_ENDPOINT") orelse "";
    const seaweed_public_url = env.get("SEAWEED_PUBLIC_URL") orelse seaweed_filer_endpoint;

    const database_url = env.get("DATABASE_URL");
    const pg_host = env.get("PGHOST") orelse "127.0.0.1";
    const pg_port = parseU16(env.get("PGPORT") orelse "5432", 5432);
    const pg_user = env.get("PGUSER") orelse "postgres";
    const pg_password = env.get("PGPASSWORD");
    const pg_database = env.get("PGDATABASE");
    const pool_size = parseU16(env.get("PG_POOL_SIZE") orelse "5", 5);
    const pool_timeout_ms = parseU32(env.get("PG_POOL_TIMEOUT_MS") orelse "10000", 10_000);

    const db_enabled = if (env.get("DB_ENABLED")) |value|
        parseBool(value)
    else
        database_url != null or
            env.get("PGHOST") != null or
            env.get("PGPORT") != null or
            env.get("PGUSER") != null or
            env.get("PGPASSWORD") != null or
            env.get("PGDATABASE") != null;

    return .{
        .port = listen_port,
        .nullclaw_url = nullclaw_url,
        .nullclaw_bearer_token = nullclaw_bearer_token,
        .openai_api_key = openai_api_key,
        .openai_base_url = openai_base_url,
        .openai_story_model = openai_story_model,
        .openai_image_model = openai_image_model,
        .seaweed_filer_endpoint = seaweed_filer_endpoint,
        .seaweed_public_url = seaweed_public_url,
        .db = .{
            .enabled = db_enabled,
            .database_url = database_url,
            .host = pg_host,
            .port = pg_port,
            .user = pg_user,
            .password = pg_password,
            .database = pg_database,
            .pool_size = pool_size,
            .pool_timeout_ms = pool_timeout_ms,
        },
        .env = env,
    };
}

fn loadDotEnv(env: *std.process.EnvMap, allocator: std.mem.Allocator, path: []const u8) !void {
    var file = std.fs.cwd().openFile(path, .{}) catch |err| switch (err) {
        error.FileNotFound => return,
        else => return err,
    };
    defer file.close();

    const content = try file.readToEndAlloc(allocator, 1024 * 1024);
    defer allocator.free(content);

    var iter = std.mem.splitSequence(u8, content, "\n");
    var used_bare_key = false;

    while (iter.next()) |raw_line| {
        const line = std.mem.trim(u8, raw_line, " \t\r");
        if (line.len == 0 or line[0] == '#') {
            continue;
        }

        if (std.mem.indexOfScalar(u8, line, '=')) |eq| {
            const key = std.mem.trim(u8, line[0..eq], " \t");
            if (key.len == 0) {
                continue;
            }
            var value = std.mem.trim(u8, line[eq + 1 ..], " \t");
            value = stripQuotes(value);
            if (env.get(key) == null) {
                try env.put(key, value);
            }
            continue;
        }

        if (!used_bare_key and env.get("OPENAI_API_KEY") == null and isLikelyApiKey(line)) {
            try env.put("OPENAI_API_KEY", line);
            used_bare_key = true;
        }
    }
}

fn stripQuotes(value: []const u8) []const u8 {
    if (value.len >= 2) {
        if (value[0] == '"' and value[value.len - 1] == '"') {
            return value[1 .. value.len - 1];
        }
        if (value[0] == '\'' and value[value.len - 1] == '\'') {
            return value[1 .. value.len - 1];
        }
    }
    return value;
}

fn isLikelyApiKey(value: []const u8) bool {
    return std.mem.startsWith(u8, value, "sk-");
}

fn parseU16(value: []const u8, default: u16) u16 {
    return std.fmt.parseInt(u16, value, 10) catch default;
}

fn parseU32(value: []const u8, default: u32) u32 {
    return std.fmt.parseInt(u32, value, 10) catch default;
}

fn parseBool(value: []const u8) bool {
    return std.ascii.eqlIgnoreCase(value, "true") or
        std.ascii.eqlIgnoreCase(value, "1") or
        std.ascii.eqlIgnoreCase(value, "yes") or
        std.ascii.eqlIgnoreCase(value, "on");
}
