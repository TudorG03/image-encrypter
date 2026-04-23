package eu.deic.ism.service;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import eu.deic.ism.client.C05ApiClient;
import eu.deic.ism.dto.JobDoneRequest;
import eu.deic.ism.dto.JobResponse;
import eu.deic.ism.dto.JobSubmitResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

@Service
public class JobService {

    private C05ApiClient c05ApiClient;

    private RabbitTemplate rabbitTemplate;

    private ObjectMapper objectMapper;

    private JobNotificationService jobNotificationService;

    public JobService(C05ApiClient c05ApiClient, RabbitTemplate rabbitTemplate, ObjectMapper objectMapper,
            JobNotificationService jobNotificationService) {
        this.c05ApiClient = c05ApiClient;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.jobNotificationService = jobNotificationService;
    }

    public JobSubmitResponse submit(String username, byte[] imageBytes, String operation, String mode, String keyHex,
            String ivHex) throws JsonProcessingException {
        int userId = (Integer) c05ApiClient.getUserByUsername(username).get("id");
        String jobId = UUID.randomUUID().toString();
        c05ApiClient.createJob(jobId, userId, operation, mode, keyHex, ivHex);
        Map<String, String> map = Map.of(
                "jobId", jobId,
                "operation", operation,
                "mode", mode,
                "keyHex", keyHex,
                "ivHex", ivHex != null ? ivHex : "",
                "image", Base64.getEncoder().encodeToString(imageBytes));

        rabbitTemplate.convertAndSend("image.exchange", "image.process", objectMapper.writeValueAsString(map));

        return new JobSubmitResponse(jobId);
    }

    public List<JobResponse> listForUser(String username) {
        int userId = (Integer) c05ApiClient.getUserByUsername(username).get("id");
        return c05ApiClient.listJobsByUser(userId);
    }

    public void handleJobDone(JobDoneRequest request) {
        c05ApiClient.markJobDone(request.jobId(), "done", request.downloadUrl());
        jobNotificationService.publish(request.jobId(), request.downloadUrl());
    }

    public SseEmitter handleStream(String jobId) {
        return jobNotificationService.subscribe(jobId);
    }
}
