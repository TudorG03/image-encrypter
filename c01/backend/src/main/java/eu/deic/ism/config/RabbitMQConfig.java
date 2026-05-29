package eu.deic.ism.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.databind.ObjectMapper;

import eu.deic.ism.dto.JobDoneRequest;

@Configuration
public class RabbitMQConfig {

    @Bean
    ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

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

    @Bean
    TopicExchange jobEventsExchange() {
        return new TopicExchange("job.events.exchange", true, false);
    }

    @Bean
    Queue jobDoneQueue() {
        return new Queue("job.done.queue", true);
    }

    @Bean
    Binding jobDoneBinding(Queue jobDoneQueue, TopicExchange jobEventsExchange) {
        return BindingBuilder
                .bind(jobDoneQueue)
                .to(jobEventsExchange)
                .with("job.done");
    }

    // Scope the JSON converter inside the listener factory only. Exposing it
    // as a top-level @Bean would let Spring Boot's RabbitAutoConfiguration
    // pick it up as the global RabbitTemplate MessageConverter, which would
    // double-encode the JSON string JobService.submit publishes for image
    // jobs. C03 sends plain JSON without a __TypeId__ header, so the
    // class mapper pins the deserialized type to JobDoneRequest.
    @Bean
    SimpleRabbitListenerContainerFactory jsonRabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(JobDoneRequest.class);
        converter.setClassMapper(classMapper);

        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(converter);
        return factory;
    }
}
