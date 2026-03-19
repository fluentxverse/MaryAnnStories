const std = @import("std");

const nano_banana_pro_model = "gemini-3-pro-image-preview";

pub const ReferenceImage = struct {
    bytes: []const u8,
    mime_type: []const u8,
};

pub const Client = struct {
    base_url: []const u8,
    api_key: ?[]const u8,
    image_model: []const u8,

    pub fn init(
        base_url: []const u8,
        api_key: ?[]const u8,
        image_model: []const u8,
    ) Client {
        return .{
            .base_url = base_url,
            .api_key = api_key,
            .image_model = image_model,
        };
    }

    pub fn isEnabled(self: *const Client) bool {
        return self.api_key != null;
    }

    pub fn generateImage(
        self: *const Client,
        allocator: std.mem.Allocator,
        prompt: []const u8,
        aspect_ratio: ?[]const u8,
        image_size: ?[]const u8,
        negative_prompt: ?[]const u8,
        reference_images: []const ReferenceImage,
        image_model_override: ?[]const u8,
    ) ![]u8 {
        const api_key = self.api_key orelse return error.GeminiApiKeyMissing;
        const configured_model = if (image_model_override) |model|
            if (model.len > 0) model else self.image_model
        else
            self.image_model;

        const has_reference = reference_images.len > 0;
        const use_generate_content = has_reference or !std.mem.startsWith(u8, configured_model, "imagen-");
        const effective_model = if (has_reference and std.mem.startsWith(u8, configured_model, "imagen-"))
            nano_banana_pro_model
        else
            configured_model;

        if (use_generate_content) {
            return generateWithContent(
                self,
                allocator,
                api_key,
                effective_model,
                prompt,
                aspect_ratio,
                image_size,
                negative_prompt,
                reference_images,
            );
        }

        return generateWithImagenPredict(
            self,
            allocator,
            api_key,
            effective_model,
            prompt,
            aspect_ratio,
            image_size,
            negative_prompt,
        );
    }
};

fn generateWithContent(
    self: *const Client,
    allocator: std.mem.Allocator,
    api_key: []const u8,
    model: []const u8,
    prompt: []const u8,
    aspect_ratio: ?[]const u8,
    image_size: ?[]const u8,
    negative_prompt: ?[]const u8,
    reference_images: []const ReferenceImage,
) ![]u8 {
    const path = try std.fmt.allocPrint(allocator, "models/{s}:generateContent", .{model});
    defer allocator.free(path);

    const url = try buildUrlWithKey(allocator, self.base_url, path, api_key);
    defer allocator.free(url);

    var payload = std.ArrayList(u8).init(allocator);
    defer payload.deinit();

    var encoded_references = std.ArrayList([]u8).init(allocator);
    defer {
        for (encoded_references.items) |encoded| allocator.free(encoded);
        encoded_references.deinit();
    }

    const has_reference = reference_images.len > 0;
    for (reference_images) |reference| {
        const encoded_len = std.base64.standard.Encoder.calcSize(reference.bytes.len);
        const encoded = try allocator.alloc(u8, encoded_len);
        _ = std.base64.standard.Encoder.encode(encoded, reference.bytes);
        try encoded_references.append(encoded);
    }

    const effective_prompt = try buildEffectivePrompt(
        allocator,
        prompt,
        aspect_ratio,
        negative_prompt,
        has_reference,
    );
    defer allocator.free(effective_prompt);

    var parts = std.ArrayList(GeminiContentPart).init(allocator);
    defer parts.deinit();
    for (reference_images, 0..) |reference, index| {
        try parts.append(.{
            .inlineData = .{
                .mimeType = if (reference.mime_type.len > 0) reference.mime_type else "image/png",
                .data = encoded_references.items[index],
            },
        });
    }
    try parts.append(.{ .text = effective_prompt });

    const contents = [_]GeminiContent{
        .{
            .parts = parts.items,
        },
    };
    const response_modalities = [_][]const u8{ "TEXT", "IMAGE" };
    const mapped_image_size = mapGeminiImageSize(image_size);

    try std.json.stringify(.{
        .contents = contents[0..],
        .generationConfig = GeminiGenerationConfig{
            .responseModalities = response_modalities[0..],
            .imageConfig = .{
                .aspectRatio = aspect_ratio,
                .imageSize = mapped_image_size,
            },
        },
    }, .{}, payload.writer());

    return try sendRequest(allocator, url, payload.items);
}

fn generateWithImagenPredict(
    self: *const Client,
    allocator: std.mem.Allocator,
    api_key: []const u8,
    model: []const u8,
    prompt: []const u8,
    aspect_ratio: ?[]const u8,
    image_size: ?[]const u8,
    negative_prompt: ?[]const u8,
) ![]u8 {
    const path = try std.fmt.allocPrint(allocator, "models/{s}:predict", .{model});
    defer allocator.free(path);

    const url = try buildUrlWithKey(allocator, self.base_url, path, api_key);
    defer allocator.free(url);

    var payload = std.ArrayList(u8).init(allocator);
    defer payload.deinit();

    const effective_prompt = try buildEffectivePrompt(
        allocator,
        prompt,
        aspect_ratio,
        negative_prompt,
        false,
    );
    defer allocator.free(effective_prompt);

    const instances = [_]GeminiInstance{
        .{
            .prompt = effective_prompt,
        },
    };
    const parameters = GeminiParameters{
        .sampleCount = 1,
        .aspectRatio = aspect_ratio,
        .sampleImageSize = mapGeminiImageSize(image_size),
    };

    try std.json.stringify(.{
        .instances = instances[0..],
        .parameters = parameters,
    }, .{}, payload.writer());

    return try sendRequest(allocator, url, payload.items);
}

fn buildEffectivePrompt(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    aspect_ratio: ?[]const u8,
    negative_prompt: ?[]const u8,
    has_reference: bool,
) ![]u8 {
    return if (has_reference)
        std.fmt.allocPrint(
            allocator,
            "Use the input reference image or images as continuity references for the same characters, same clothing, same palette, and same storybook art direction. {s}{s}{s}{s}{s}",
            .{
                prompt,
                if (aspect_ratio) |_| " Target composition ratio: " else "",
                aspect_ratio orelse "",
                if (negative_prompt) |_| " Avoid these elements: " else "",
                negative_prompt orelse "",
            },
        )
    else
        std.fmt.allocPrint(
            allocator,
            "{s}{s}{s}{s}{s}",
            .{
                prompt,
                if (aspect_ratio) |_| " Target composition ratio: " else "",
                aspect_ratio orelse "",
                if (negative_prompt) |_| " Avoid these elements: " else "",
                negative_prompt orelse "",
            },
        );
}

const GeminiInstance = struct {
    prompt: []const u8,
};

const GeminiParameters = struct {
    sampleCount: u8 = 1,
    aspectRatio: ?[]const u8 = null,
    sampleImageSize: ?[]const u8 = null,
};

const GeminiContent = struct {
    parts: []const GeminiContentPart,
};

const GeminiContentPart = struct {
    text: ?[]const u8 = null,
    inlineData: ?GeminiInlineData = null,
};

const GeminiInlineData = struct {
    mimeType: []const u8,
    data: []const u8,
};

const GeminiGenerationConfig = struct {
    responseModalities: []const []const u8,
    imageConfig: ?GeminiImageConfig = null,
};

const GeminiImageConfig = struct {
    aspectRatio: ?[]const u8 = null,
    imageSize: ?[]const u8 = null,
};

fn mapGeminiImageSize(label: ?[]const u8) ?[]const u8 {
    const value = label orelse return null;
    if (value.len == 0) return null;
    if (std.mem.indexOf(u8, value, "4096") != null) return "4K";
    if (std.mem.indexOf(u8, value, "2048") != null) return "2K";
    if (std.mem.indexOf(u8, value, "1536") != null) return "2K";
    if (std.mem.indexOf(u8, value, "1024") != null) return "1K";
    return null;
}

fn sendRequest(
    allocator: std.mem.Allocator,
    url: []const u8,
    payload: []const u8,
) ![]u8 {
    var headers = std.ArrayList(std.http.Header).init(allocator);
    defer headers.deinit();

    try headers.append(.{ .name = "Content-Type", .value = "application/json" });
    try headers.append(.{ .name = "Accept", .value = "application/json" });

    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    var response_body = std.ArrayList(u8).init(allocator);
    errdefer response_body.deinit();

    const max_attempts: usize = 3;
    var attempt: usize = 0;
    while (attempt < max_attempts) : (attempt += 1) {
        response_body.clearRetainingCapacity();
        const response = try client.fetch(.{
            .location = .{ .url = url },
            .method = .POST,
            .payload = payload,
            .extra_headers = headers.items,
            .response_storage = .{ .dynamic = &response_body },
            .max_append_size = 8 * 1024 * 1024,
        });

        const should_retry =
            (response.status == .service_unavailable or response.status == .too_many_requests) and
            attempt + 1 < max_attempts;
        if (should_retry) {
            std.time.sleep(@as(u64, @intCast(attempt + 1)) * std.time.ns_per_s);
            continue;
        }

        return response_body.toOwnedSlice();
    }

    return response_body.toOwnedSlice();
}

fn buildUrlWithKey(
    allocator: std.mem.Allocator,
    base_url: []const u8,
    path: []const u8,
    api_key: []const u8,
) ![]u8 {
    const needs_slash = base_url.len > 0 and base_url[base_url.len - 1] != '/';
    return std.fmt.allocPrint(allocator, "{s}{s}{s}?key={s}", .{
        base_url,
        if (needs_slash) "/" else "",
        path,
        api_key,
    });
}
