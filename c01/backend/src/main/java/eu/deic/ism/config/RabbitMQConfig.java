package eu.deic.ism.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    @Bean
    DirectExchange imageExchange() {
        return new DirectExchange("image.exchange", true, false);
    }

    @Bean
    Queue imageQueue() {
        return new Queue("image.queue", true);
    }

    @Bean
    Binding imageBinding(Queue imageQueue, DirectExchange imageExchange) {
        return BindingBuilder
                .bind(imageQueue)
                .to(imageExchange)
                .with("image.process");
    }
}
