const App = @import("app.zig").App;

pub var app: ?*App = null;

pub fn setApp(new_app: *App) void {
    app = new_app;
}

pub fn getApp() *App {
    return app.?;
}
