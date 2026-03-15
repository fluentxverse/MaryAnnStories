const std = @import("std");
const pg = @import("pg");
const config = @import("../config.zig");

pub const Database = struct {
    pool: ?*pg.Pool,

    pub fn init(allocator: std.mem.Allocator, cfg: *const config.DbConfig) !Database {
        if (!cfg.enabled) {
            return .{ .pool = null };
        }

        if (cfg.database_url) |database_url| {
            const uri = try std.Uri.parse(database_url);
            const pool = try pg.Pool.initUri(allocator, uri, .{
                .size = cfg.pool_size,
                .timeout = cfg.pool_timeout_ms,
            });
            return .{ .pool = pool };
        }

        const pool = try pg.Pool.init(allocator, .{
            .size = cfg.pool_size,
            .timeout = cfg.pool_timeout_ms,
            .connect = .{
                .host = cfg.host,
                .port = cfg.port,
            },
            .auth = .{
                .username = cfg.user,
                .password = cfg.password,
                .database = cfg.database,
                .timeout = cfg.pool_timeout_ms,
            },
        });

        return .{ .pool = pool };
    }

    pub fn deinit(self: *Database) void {
        if (self.pool) |pool| {
            pool.deinit();
        }
    }

    pub fn isEnabled(self: *const Database) bool {
        return self.pool != null;
    }

    pub fn ping(self: *Database) !void {
        if (self.pool) |pool| {
            _ = try pool.exec("select 1", .{});
            return;
        }
        return error.DatabaseNotConfigured;
    }

    pub fn ensureSchema(self: *Database) !void {
        const pool = try self.requirePool();

        _ = try pool.exec(
            \\create table if not exists app_users (
            \\  id bigserial primary key,
            \\  username text not null unique,
            \\  password_hash text not null,
            \\  created_at timestamptz not null default now()
            \\)
        , .{});

        _ = try pool.exec(
            \\create table if not exists story_images (
            \\  id bigserial primary key,
            \\  story_id text not null,
            \\  file_path text not null,
            \\  source_url text,
            \\  kind text not null default 'cover',
            \\  page_index integer,
            \\  prompt text,
            \\  created_at timestamptz not null default now()
            \\)
        , .{});

        _ = try pool.exec(
            \\create table if not exists stories (
            \\  id text primary key,
            \\  username text not null,
            \\  title text,
            \\  summary text,
            \\  prompt text,
            \\  status text not null default 'draft',
            \\  ready boolean not null default false,
            \\  published boolean not null default false,
            \\  builder_json text,
            \\  image_settings_json text,
            \\  story_plan_json text,
            \\  final_story_json text,
            \\  draft_response_text text,
            \\  image_results_json text,
            \\  created_at timestamptz not null default now(),
            \\  updated_at timestamptz not null default now()
            \\)
        , .{});

        _ = try pool.exec(
            \\alter table story_images
            \\  add column if not exists kind text not null default 'cover',
            \\  add column if not exists page_index integer,
            \\  add column if not exists prompt text
        , .{});

        _ = try pool.exec(
            \\alter table stories
            \\  add column if not exists title text,
            \\  add column if not exists summary text,
            \\  add column if not exists prompt text,
            \\  add column if not exists status text not null default 'draft',
            \\  add column if not exists ready boolean not null default false,
            \\  add column if not exists published boolean not null default false,
            \\  add column if not exists builder_json text,
            \\  add column if not exists image_settings_json text,
            \\  add column if not exists story_plan_json text,
            \\  add column if not exists final_story_json text,
            \\  add column if not exists draft_response_text text,
            \\  add column if not exists image_results_json text,
            \\  add column if not exists updated_at timestamptz not null default now()
        , .{});
    }

    pub fn userExists(self: *Database, username: []const u8) !bool {
        const pool = try self.requirePool();
        const row = try pool.row("select 1 from app_users where username = $1", .{username});
        if (row) |row_result| {
            var result = row_result;
            defer result.deinit() catch {};
            return true;
        }
        return false;
    }

    pub fn createUser(self: *Database, username: []const u8, password_hash: []const u8) !i64 {
        const pool = try self.requirePool();
        if (try self.userExists(username)) {
            return error.UserAlreadyExists;
        }

        const row = try pool.row(
            "insert into app_users (username, password_hash) values ($1, $2) returning id",
            .{ username, password_hash },
        );
        if (row) |row_result| {
            var result = row_result;
            defer result.deinit() catch {};
            return try result.get(i64, 0);
        }
        return error.InsertFailed;
    }

    pub fn getUserAuth(self: *Database, allocator: std.mem.Allocator, username: []const u8) !?UserAuth {
        const pool = try self.requirePool();
        const row = try pool.row(
            "select id, username, password_hash from app_users where username = $1",
            .{username},
        );
        if (row) |row_result| {
            var result = row_result;
            defer result.deinit() catch {};
            const id = try result.get(i64, 0);
            const name = try result.get([]u8, 1);
            const hash = try result.get([]u8, 2);
            return UserAuth{
                .id = id,
                .username = try allocator.dupe(u8, name),
                .password_hash = try allocator.dupe(u8, hash),
            };
        }
        return null;
    }

    pub fn createStoryImage(
        self: *Database,
        story_id: []const u8,
        file_path: []const u8,
        source_url: ?[]const u8,
        kind: []const u8,
        page_index: ?i32,
        prompt: ?[]const u8,
    ) !i64 {
        const pool = try self.requirePool();
        const row = try pool.row(
            "insert into story_images (story_id, file_path, source_url, kind, page_index, prompt) values ($1, $2, $3, $4, $5, $6) returning id",
            .{ story_id, file_path, source_url, kind, page_index, prompt },
        );
        if (row) |row_result| {
            var result = row_result;
            defer result.deinit() catch {};
            return try result.get(i64, 0);
        }
        return error.InsertFailed;
    }

    pub fn listStoryImages(
        self: *Database,
        allocator: std.mem.Allocator,
        story_id: []const u8,
    ) ![]StoryImageRecord {
        const pool = try self.requirePool();
        var result = try pool.query(
            \\select id, story_id, file_path, source_url, kind, page_index, prompt, created_at
            \\from story_images
            \\where story_id = $1
            \\order by created_at asc
        , .{story_id});
        defer result.deinit();

        var items = std.ArrayList(StoryImageRecord).init(allocator);
        errdefer {
            for (items.items) |*item| item.deinit(allocator);
            items.deinit();
        }

        while (try result.next()) |row| {
            const record = try StoryImageRecord.fromRow(allocator, row);
            try items.append(record);
        }

        return try items.toOwnedSlice();
    }

    pub fn upsertStory(self: *Database, story: StoryUpsert) !StoryTimestamps {
        const pool = try self.requirePool();
        const row = try pool.row(
            \\insert into stories (
            \\  id, username, title, summary, prompt, status, ready, published,
            \\  builder_json, image_settings_json, story_plan_json, final_story_json,
            \\  draft_response_text, image_results_json
            \\) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            \\on conflict (id) do update set
            \\  username = excluded.username,
            \\  title = excluded.title,
            \\  summary = excluded.summary,
            \\  prompt = excluded.prompt,
            \\  status = excluded.status,
            \\  ready = excluded.ready,
            \\  published = excluded.published,
            \\  builder_json = excluded.builder_json,
            \\  image_settings_json = excluded.image_settings_json,
            \\  story_plan_json = excluded.story_plan_json,
            \\  final_story_json = excluded.final_story_json,
            \\  draft_response_text = excluded.draft_response_text,
            \\  image_results_json = excluded.image_results_json,
            \\  updated_at = now()
            \\returning created_at, updated_at
        , .{
            story.id,
            story.username,
            story.title,
            story.summary,
            story.prompt,
            story.status,
            story.ready,
            story.published,
            story.builder_json,
            story.image_settings_json,
            story.story_plan_json,
            story.final_story_json,
            story.draft_response_text,
            story.image_results_json,
        });
        if (row) |row_result| {
            var result = row_result;
            defer result.deinit() catch {};
            const created_at = try result.get([]u8, 0);
            const updated_at = try result.get([]u8, 1);
            return StoryTimestamps{
                .created_at = try story.allocator.dupe(u8, created_at),
                .updated_at = try story.allocator.dupe(u8, updated_at),
            };
        }
        return error.InsertFailed;
    }

    pub fn listStories(
        self: *Database,
        allocator: std.mem.Allocator,
        username: []const u8,
        limit: i64,
        offset: i64,
    ) !StoryList {
        const pool = try self.requirePool();
        const fetch_limit: i64 = if (limit < 1) 1 else limit + 1;
        var result = try pool.query(
            \\select id, username, title, summary, prompt, status, ready, published,
            \\  builder_json, image_settings_json, story_plan_json, final_story_json,
            \\  draft_response_text, image_results_json,
            \\  created_at, updated_at
            \\from stories
            \\where username = $1
            \\order by updated_at desc
            \\limit $2 offset $3
        , .{ username, fetch_limit, offset });
        defer result.deinit();

        var items = std.ArrayList(StoryRecord).init(allocator);
        errdefer {
            for (items.items) |*item| item.deinit(allocator);
            items.deinit();
        }

        while (try result.next()) |row| {
            const record = try StoryRecord.fromRow(allocator, row);
            try items.append(record);
        }

        var has_more = false;
        const max_items: usize = @intCast(fetch_limit - 1);
        if (items.items.len > max_items) {
            has_more = true;
            const last_index = items.items.len - 1;
            var mutable_last = items.items[last_index];
            mutable_last.deinit(allocator);
            _ = items.pop();
        }

        return StoryList{
            .items = try items.toOwnedSlice(),
            .has_more = has_more,
        };
    }

    pub fn deleteStory(self: *Database, id: []const u8, username: ?[]const u8) !void {
        const pool = try self.requirePool();
        if (username) |name| {
            _ = try pool.exec("delete from stories where id = $1 and username = $2", .{ id, name });
        } else {
            _ = try pool.exec("delete from stories where id = $1", .{id});
        }
    }

    fn requirePool(self: *Database) !*pg.Pool {
        return self.pool orelse error.DatabaseNotConfigured;
    }
};

pub const StoryUpsert = struct {
    allocator: std.mem.Allocator,
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
};

pub const StoryTimestamps = struct {
    created_at: []u8,
    updated_at: []u8,

    pub fn deinit(self: *StoryTimestamps, allocator: std.mem.Allocator) void {
        allocator.free(self.created_at);
        allocator.free(self.updated_at);
    }
};

pub const StoryList = struct {
    items: []StoryRecord,
    has_more: bool,

    pub fn deinit(self: *StoryList, allocator: std.mem.Allocator) void {
        for (self.items) |*item| item.deinit(allocator);
        allocator.free(self.items);
    }
};

pub const StoryRecord = struct {
    id: []u8,
    username: []u8,
    title: ?[]u8,
    summary: ?[]u8,
    prompt: ?[]u8,
    status: []u8,
    ready: bool,
    published: bool,
    builder_json: ?[]u8,
    image_settings_json: ?[]u8,
    story_plan_json: ?[]u8,
    final_story_json: ?[]u8,
    draft_response_text: ?[]u8,
    image_results_json: ?[]u8,
    created_at: []u8,
    updated_at: []u8,

    pub fn fromRow(allocator: std.mem.Allocator, row: pg.Row) !StoryRecord {
        const id = try allocator.dupe(u8, try row.get([]u8, 0));
        const username = try allocator.dupe(u8, try row.get([]u8, 1));
        const title = try dupOptional(allocator, try row.get(?[]u8, 2));
        const summary = try dupOptional(allocator, try row.get(?[]u8, 3));
        const prompt = try dupOptional(allocator, try row.get(?[]u8, 4));
        const status = try allocator.dupe(u8, try row.get([]u8, 5));
        const ready = try row.get(bool, 6);
        const published = try row.get(bool, 7);
        const builder_json = try dupOptional(allocator, try row.get(?[]u8, 8));
        const image_settings_json = try dupOptional(allocator, try row.get(?[]u8, 9));
        const story_plan_json = try dupOptional(allocator, try row.get(?[]u8, 10));
        const final_story_json = try dupOptional(allocator, try row.get(?[]u8, 11));
        const draft_response_text = try dupOptional(allocator, try row.get(?[]u8, 12));
        const image_results_json = try dupOptional(allocator, try row.get(?[]u8, 13));
        const created_at = try allocator.dupe(u8, try row.get([]u8, 14));
        const updated_at = try allocator.dupe(u8, try row.get([]u8, 15));

        return StoryRecord{
            .id = id,
            .username = username,
            .title = title,
            .summary = summary,
            .prompt = prompt,
            .status = status,
            .ready = ready,
            .published = published,
            .builder_json = builder_json,
            .image_settings_json = image_settings_json,
            .story_plan_json = story_plan_json,
            .final_story_json = final_story_json,
            .draft_response_text = draft_response_text,
            .image_results_json = image_results_json,
            .created_at = created_at,
            .updated_at = updated_at,
        };
    }

    pub fn deinit(self: *StoryRecord, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.username);
        allocator.free(self.status);
        allocator.free(self.created_at);
        allocator.free(self.updated_at);
        if (self.title) |value| allocator.free(value);
        if (self.summary) |value| allocator.free(value);
        if (self.prompt) |value| allocator.free(value);
        if (self.builder_json) |value| allocator.free(value);
        if (self.image_settings_json) |value| allocator.free(value);
        if (self.story_plan_json) |value| allocator.free(value);
        if (self.final_story_json) |value| allocator.free(value);
        if (self.draft_response_text) |value| allocator.free(value);
        if (self.image_results_json) |value| allocator.free(value);
    }
};

pub const StoryImageRecord = struct {
    id: i64,
    story_id: []u8,
    file_path: []u8,
    source_url: ?[]u8,
    kind: []u8,
    page_index: ?i32,
    prompt: ?[]u8,
    created_at: []u8,

    pub fn fromRow(allocator: std.mem.Allocator, row: pg.Row) !StoryImageRecord {
        const id = try row.get(i64, 0);
        const story_id = try allocator.dupe(u8, try row.get([]u8, 1));
        const file_path = try allocator.dupe(u8, try row.get([]u8, 2));
        const source_url = try dupOptional(allocator, try row.get(?[]u8, 3));
        const kind = try allocator.dupe(u8, try row.get([]u8, 4));
        const page_index = try row.get(?i32, 5);
        const prompt = try dupOptional(allocator, try row.get(?[]u8, 6));
        const created_at = try allocator.dupe(u8, try row.get([]u8, 7));

        return StoryImageRecord{
            .id = id,
            .story_id = story_id,
            .file_path = file_path,
            .source_url = source_url,
            .kind = kind,
            .page_index = page_index,
            .prompt = prompt,
            .created_at = created_at,
        };
    }

    pub fn deinit(self: *StoryImageRecord, allocator: std.mem.Allocator) void {
        allocator.free(self.story_id);
        allocator.free(self.file_path);
        allocator.free(self.kind);
        allocator.free(self.created_at);
        if (self.source_url) |value| allocator.free(value);
        if (self.prompt) |value| allocator.free(value);
    }
};

fn dupOptional(allocator: std.mem.Allocator, value: ?[]u8) !?[]u8 {
    if (value) |bytes| {
        return try allocator.dupe(u8, bytes);
    }
    return null;
}

pub const UserAuth = struct {
    id: i64,
    username: []u8,
    password_hash: []u8,

    pub fn deinit(self: *UserAuth, allocator: std.mem.Allocator) void {
        allocator.free(self.username);
        allocator.free(self.password_hash);
    }
};
