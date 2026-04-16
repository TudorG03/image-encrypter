package eu.deic.ism;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;

public class C01Client {

    private HttpClient client;

    public C01Client() {
        client = HttpClient.newHttpClient();
    }

    public void notify(String jobId, String downloadUrl) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String body = mapper.writeValueAsString(Map.of(
                "jobId", jobId,
                "downloadUrl", downloadUrl));

        StringBuilder url = new StringBuilder(
                "http://" + System.getenv().getOrDefault("C01_HOST", "c01") + ":8080/api/jobs/done");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url.toString()))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() > 299 || response.statusCode() < 200) {
            throw new Exception("C05 notification failed: " + response.statusCode() + " " + response.body());
        }
    }
}
