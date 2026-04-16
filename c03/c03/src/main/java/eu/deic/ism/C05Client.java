package eu.deic.ism;

import java.net.http.HttpClient;

public class C05Client {

    private HttpClient client;

    public C05Client() {
        client = HttpClient.newHttpClient();
    }

    public String upload(byte[] imageBytes, JobMessage job) {

    }
}
