package eu.deic.ism;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class C05Client {

    private HttpClient client;

    public C05Client() {
        client = HttpClient.newHttpClient();
    }

    public String upload(byte[] imageBytes, JobMessage job) throws Exception {
        StringBuilder url = new StringBuilder(
                "http://" + System.getenv().getOrDefault("C05_HOST", "c05") + ":3001/image" +
                        "?job_id=" + job.jobId +
                        "&operation=" + job.operation +
                        "&mode=" + job.mode +
                        "&aes_key=" + job.keyHex);

        if (job.ivHex != null)
            url.append("&iv=").append(job.ivHex);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url.toString()))
                .header("Content-Type", "application/octet-stream")
                .POST(HttpRequest.BodyPublishers.ofByteArray(imageBytes))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 201)
            throw new Exception("C05 upload failed: " + response.statusCode() + " " + response.body());

        JsonNode node = new ObjectMapper().readTree(response.body());
        long id = node.get("id").asLong();

        return "http://" + System.getenv().getOrDefault("C05_HOST", "c05") + ":3001/image/" + id;
    }
}
