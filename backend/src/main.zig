const std = @import("std");
const horizon = @import("horizon");

const config = @import("config.zig");
const App = @import("app.zig").App;
const state = @import("state.zig");
const DynamicCorsMiddleware = @import("middleware/dynamic_cors.zig").DynamicCorsMiddleware;
const health_route = @import("routes/health.zig");
const agent_route = @import("routes/agent.zig");
const auth_route = @import("routes/auth.zig");
const story_route = @import("routes/story.zig");
const image_route = @import("routes/images.zig");
const stories_route = @import("routes/stories.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    const allocator = gpa.allocator();

    var cfg = try config.load(allocator);
    defer cfg.deinit();

    var app = try App.init(allocator, &cfg);
    defer app.deinit();

    state.setApp(&app);

    var server = horizon.Server.init(allocator, try std.net.Address.parseIp4("0.0.0.0", cfg.port));
    defer server.deinit();

    server.show_routes_on_startup = true;

    const frontend_origins = cfg.env.get("APP_FRONTEND_ORIGIN") orelse "http://localhost:3000,https://maryannpielago.biz,https://www.maryannpielago.biz,https://maryannstories.paulanthonyarriola.workers.dev";
    var cors = DynamicCorsMiddleware.init(frontend_origins);
    try server.router.middlewares.use(&cors);

    try server.router.get("/api/health", health_route.health);
    try server.router.post("/api/agent", agent_route.agent);
    try server.router.post("/api/auth/register", auth_route.register);
    try server.router.post("/api/auth/login", auth_route.login);
    try server.router.post("/api/auth/logout", auth_route.logout);
    try server.router.get("/api/auth/session", auth_route.sessionStatus);
    try server.router.post("/api/story/generate", story_route.generate);
    try server.router.post("/api/stories/upsert", stories_route.upsert);
    try server.router.post("/api/stories/list", stories_route.list);
    try server.router.post("/api/stories/published/list", stories_route.listPublished);
    try server.router.post("/api/stories/delete", stories_route.delete);
    try server.router.post("/api/images/generate", image_route.generate);
    try server.router.post("/api/images/accept", image_route.accept);
    try server.router.post("/api/images/list", image_route.list);
    try server.router.post("/api/images/reset", image_route.reset);
    try server.router.get("/api/images/proxy", image_route.proxy);
    try server.router.post("/api/images/proxy", image_route.proxy);
    try server.router.post("/api/images/qa", image_route.qa);

    try server.listen();
}
