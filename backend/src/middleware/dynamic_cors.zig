const std = @import("std");
const horizon = @import("horizon");

const Request = horizon.Request;
const Response = horizon.Response;
const Middleware = horizon.Middleware;
const Errors = horizon.Errors;

pub const DynamicCorsMiddleware = struct {
    const Self = @This();

    allowed_origins_csv: []const u8,
    allow_methods: []const u8 = "GET, POST, PUT, DELETE, OPTIONS",
    allow_headers: []const u8 = "Content-Type, Authorization",
    allow_credentials: bool = true,
    max_age: ?u32 = 86400,

    pub fn init(allowed_origins_csv: []const u8) Self {
        return .{
            .allowed_origins_csv = allowed_origins_csv,
        };
    }

    pub fn middleware(
        self: *const Self,
        allocator: std.mem.Allocator,
        req: *Request,
        res: *Response,
        ctx: *Middleware.Context,
    ) Errors.Horizon!void {
        const request_origin = req.getHeader("Origin") orelse req.getHeader("origin");

        if (request_origin) |origin| {
            if (self.isAllowedOrigin(origin)) {
                try res.setHeader("Access-Control-Allow-Origin", origin);
                try res.setHeader("Vary", "Origin");
                try res.setHeader("Access-Control-Allow-Methods", self.allow_methods);
                try res.setHeader("Access-Control-Allow-Headers", self.allow_headers);

                if (self.allow_credentials) {
                    try res.setHeader("Access-Control-Allow-Credentials", "true");
                }

                if (self.max_age) |seconds| {
                    const max_age_str = try std.fmt.allocPrint(res.allocator, "{d}", .{seconds});
                    try res.setHeader("Access-Control-Max-Age", max_age_str);
                }
            }
        }

        if (req.method == .OPTIONS) {
            res.setStatus(.no_content);
            return;
        }

        try ctx.next(allocator, req, res);
    }

    fn isAllowedOrigin(self: *const Self, origin: []const u8) bool {
        var iter = std.mem.splitScalar(u8, self.allowed_origins_csv, ',');
        while (iter.next()) |entry| {
            const candidate = std.mem.trim(u8, entry, " \t\r\n");
            if (candidate.len == 0) continue;
            if (std.mem.eql(u8, candidate, origin)) return true;
        }
        return false;
    }
};
