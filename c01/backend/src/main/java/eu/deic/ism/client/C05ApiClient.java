package eu.deic.ism.client;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import eu.deic.ism.dto.JobResponse;
import jakarta.annotation.PostConstruct;

@Component
public class C05ApiClient {

    @Value("${app.c05.host}")
    private String c05Host;

    @Value("${app.c05.internal-secret}")
    private String internalSecret;

    private RestClient restClient;

    @PostConstruct
    void init() {
        restClient = RestClient.builder()
                .baseUrl("http://" + c05Host + ":3001")
                .defaultHeader("X-Internal-Secret", internalSecret)
                .build();
    }

    public void createUser(String username, String passwordHash) {
        restClient.post()
                .uri("/users")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "passwordHash", passwordHash))
                .retrieve()
                .toBodilessEntity();
    }

    public Map<String, Object> getUserByUsername(String username) {
        try {
            return restClient.get()
                    .uri("/users/{username}", username)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        }
    }

    public void createJob(String jobId, Integer userId, String operation, String mode, String keyHex, String ivHex) {
        restClient.post()
                .uri("/jobs")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "jobId", jobId,
                        "userId", userId,
                        "operation", operation,
                        "mode", mode,
                        "keyHex", keyHex,
                        "ivHex", ivHex != null ? ivHex : ""))
                .retrieve()
                .toBodilessEntity();
    }

    public void markJobDone(String jobId, String status, String downloadUrl) {
        restClient.patch()
                .uri("/jobs/{jobId}", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("status", status, "downloadUrl", downloadUrl != null ? downloadUrl : ""))
                .retrieve()
                .toBodilessEntity();
    }

    public List<JobResponse> listJobsByUser(Integer userId) {
        return restClient.get()
                .uri("/jobs?user_id={userId}", userId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }
}
