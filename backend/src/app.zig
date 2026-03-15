const std = @import("std");
const horizon = @import("horizon");
const config = @import("config.zig");
const db = @import("db/postgres.zig");
const nullclaw = @import("ai/nullclaw.zig");
const openai = @import("ai/openai.zig");
const seaweed = @import("storage/seaweed.zig");

pub const App = struct {
    allocator: std.mem.Allocator,
    config: *const config.Config,
    db: db.Database,
    nullclaw: nullclaw.Client,
    openai: openai.Client,
    seaweed: seaweed.Client,

    pub fn init(allocator: std.mem.Allocator, cfg: *const config.Config) !App {
        var database = try db.Database.init(allocator, &cfg.db);
        if (database.isEnabled()) {
            try database.ensureSchema();
            try ensureSeedUser(allocator, &database);
        }
        errdefer database.deinit();

        return .{
            .allocator = allocator,
            .config = cfg,
            .db = database,
            .nullclaw = nullclaw.Client.init(cfg.nullclaw_url, cfg.nullclaw_bearer_token),
            .openai = openai.Client.init(
                cfg.openai_base_url,
                cfg.openai_api_key,
                cfg.openai_story_model,
                cfg.openai_image_model,
            ),
            .seaweed = seaweed.Client.init(cfg.seaweed_filer_endpoint, cfg.seaweed_public_url),
        };
    }

    pub fn deinit(self: *App) void {
        self.db.deinit();
    }
};

fn ensureSeedUser(allocator: std.mem.Allocator, database: *db.Database) !void {
    const seed_username = "maryann";
    const seed_password = "maryann#1101";

    if (try database.userExists(seed_username)) {
        return;
    }

    const password_hash = try horizon.hashPassword(allocator, seed_password);
    defer allocator.free(password_hash);

    _ = try database.createUser(seed_username, password_hash);
    std.debug.print("Seed user created: {s}\n", .{seed_username});
}
