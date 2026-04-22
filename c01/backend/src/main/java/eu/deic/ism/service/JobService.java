package eu.deic.ism.service;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import eu.deic.ism.client.C05ApiClient;
import eu.deic.ism.dto.JobResponse;
import eu.deic.ism.dto.JobSubmitResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

@Service
public class JobService {

    private C05ApiClient c05ApiClient;

    private RabbitTemplate rabbitTemplate;

    private ObjectMapper objectMapper;

    public JobService(C05ApiClient c05ApiClient, RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.c05ApiClient = c05ApiClient;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
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
}
