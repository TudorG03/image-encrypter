package eu.deic.ism;

import com.rabbitmq.client.ConnectionFactory;

import java.io.IOException;
import java.util.Base64;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;

public class JobConsumer implements Runnable {

    private Connection connection;
    private Channel channel;

    @Override
    public void run() {
        try {
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(System.getenv("RABBITMQ_HOST"));
            factory.setUsername("admin");
            factory.setPassword("admin");

            while (!Thread.currentThread().isInterrupted()) {
                try {
                    connection = factory.newConnection();
                } catch (Exception e) {
                    System.err.println("RabbitMQ broker not ready, retrying in 3s...");
                    Thread.sleep(3000);
                }
            }
            channel = connection.createChannel();

            channel.basicConsume(
                    "image.queue",
                    true,
                    (consumerTag, delivery) -> {
                        handleMessage(delivery.getBody());
                    },
                    consumerTag -> {
                    });

            while (!Thread.currentThread().isInterrupted()) {
                Thread.sleep(1000);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleMessage(byte[] body) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        JobMessage job = mapper.readValue(body, JobMessage.class);
        byte[] imageBytes = Base64.getDecoder().decode(job.image);
    }

    public void stop() {
        try {
            channel.close();
            connection.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
