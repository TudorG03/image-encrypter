package eu.deic.ism.dto;

public record JobResponse(
        String jobId,
        Long userId,
        String operation,
        String mode,
        String keyHex,
        String ivHex,
        String status,
        String downloadUrl,
        String createdAt) {}
