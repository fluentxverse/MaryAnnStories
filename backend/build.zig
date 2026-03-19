const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const zts_module = b.addModule("zts", .{
        .root_source_file = b.path("src/zts.zig"),
        .target = target,
        .optimize = optimize,
    });

    const horizon_module = b.addModule("horizon", .{
        .root_source_file = b.path("vendor/horizon/src/horizon.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    });
    horizon_module.addImport("zts", zts_module);
    horizon_module.linkSystemLibrary("pcre2-8", .{});

    const pg_module = b.addModule("pg", .{
        .root_source_file = b.path("vendor/pg/src/pg.zig"),
        .target = target,
        .optimize = optimize,
    });

    const pg_config_module = b.addModule("pg_config", .{
        .root_source_file = b.path("src/pg_config.zig"),
        .target = target,
        .optimize = optimize,
    });
    pg_module.addImport("config", pg_config_module);

    const pg_buffer_module = b.addModule("pg_buffer", .{
        .root_source_file = b.path("src/pg_buffer.zig"),
        .target = target,
        .optimize = optimize,
    });
    pg_module.addImport("buffer", pg_buffer_module);

    const pg_metrics_module = b.addModule("pg_metrics", .{
        .root_source_file = b.path("src/pg_metrics.zig"),
        .target = target,
        .optimize = optimize,
    });
    pg_module.addImport("metrics", pg_metrics_module);

    const exe = b.addExecutable(.{
        .name = "maryannstories-backend",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    exe.root_module.addImport("horizon", horizon_module);
    exe.root_module.addImport("pg", pg_module);

    exe.linkLibC();
    exe.linkSystemLibrary("pcre2-8");

    b.installArtifact(exe);

    const session_tests = b.addTest(.{
        .root_source_file = b.path("src/auth/session.zig"),
        .target = target,
        .optimize = optimize,
    });
    const run_session_tests = b.addRunArtifact(session_tests);
    b.step("test", "Run backend unit tests").dependOn(&run_session_tests.step);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    b.step("run", "Run the backend server").dependOn(&run_cmd.step);
}
